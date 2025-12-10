import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Mail,
  Lock,
  Bell,
  Shield,
  Camera,
  Building2,
  Save,
  Loader2,
  X,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import {
  updateProfile,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { upsertUserProfile } from '@/lib/firestore';

import { useAuth } from '../../contexts/AuthContext';
import Avatar from '@/components/shared/Avatar';
import Modal from '@/components/shared/Modal';

const Account = () => {
  const { user, updateAvatar, refreshUser } = useAuth();

  // Organization Name State
  const [organizationName, setOrganizationName] = useState<string>('');

  // Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  useEffect(() => {
    const fetchOrgName = async () => {
      if (user?.organization) {
        try {
          // Check organizations collection
          const orgDocRef = doc(db, 'organizations', user.organization);
          const orgDoc = await getDoc(orgDocRef);

          if (orgDoc.exists()) {
            setOrganizationName(orgDoc.data()?.name || user.organization);
          } else {
            // Fallback: check companies collection just in case
            const companyDocRef = doc(db, 'companies', user.organization);
            const companyDoc = await getDoc(companyDocRef);
            if (companyDoc.exists()) {
              setOrganizationName(companyDoc.data()?.name || user.organization);
            } else {
              setOrganizationName(user.organization);
            }
          }
        } catch (error) {
          console.error('Error fetching organization name:', error);
          setOrganizationName(user.organization);
        }
      }
    };

    fetchOrgName();
  }, [user?.organization]);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  // We'll treat this as "view only" primarily, similar to employee profile unless we add edit mode toggles
  // But for now, we'll keep the simple state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    campaignUpdates: true,
    analyticsReports: false,
    securityAlerts: true,
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      // 1. Update Firestore
      await upsertUserProfile(user.id, {
        name: profileData.name,
        department: profileData.department,
        email: user.email // Ensure email stays consistent
      });

      // 2. Update Firebase Auth Profile
      if (auth.currentUser && profileData.name !== user.name) {
        await updateProfile(auth.currentUser, {
          displayName: profileData.name
        });
      }

      await refreshUser();
      setIsEditingProfile(false);
      // Optional: Success feedback
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!updateAvatar) {
      setAvatarError('Avatar upload not supported');
      return;
    }

    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      await updateAvatar(file);
    } catch (error) {
      console.error('Error updating avatar:', error);
      setAvatarError(error instanceof Error ? error.message : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("Passwords don't match");
      return;
    }

    if (!auth.currentUser || !user?.email) return;

    try {
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordData.newPassword);

      alert('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error updating password:', error);
      alert('Failed to update password. Please check your current password.');
    }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState('general');

  const NAV_ITEMS = [
    { id: 'general', label: 'General', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="relative space-y-8">
            <div className="flex flex-wrap items-start gap-6">
              <div className="relative group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <Avatar
                  src={user?.avatar}
                  name={user?.name}
                  email={user?.email}
                  size="xxl"
                  className="h-28 w-28 rounded-2xl border-4 border-[#050608] shadow-lg text-3xl"
                />
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl border-4 border-transparent">
                    <Loader2 size={24} className="text-white animate-spin" />
                  </div>
                )}
                {!uploadingAvatar && (
                  <button
                    onClick={handleAvatarClick}
                    className="absolute bottom-0 right-[-10px] p-2 bg-blue-600 rounded-full border-4 border-[#050608] hover:bg-blue-500 transition-colors shadow-sm"
                  >
                    <Camera size={16} className="text-white" />
                  </button>
                )}
              </div>

              <div className="min-w-[240px] flex-1 space-y-2 pt-10 sm:pt-0">
                <h2 className="text-2xl font-semibold text-white">{profileData.name || 'Admin User'}</h2>
                <p className="text-sm text-white/70">{profileData.email || 'admin@company.com'}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                    <User size={14} />
                    {user?.role || 'Admin'}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                    <Building2 size={14} />
                    {profileData.department || 'HQ'}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                    Active
                  </span>
                </div>
                {avatarError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <X size={12} /> {avatarError}
                  </p>
                )}
              </div>

              <div className="w-full sm:w-auto flex items-center gap-3 mt-4 sm:mt-0">
                {!isEditingProfile ? (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/10"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleProfileUpdate}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-white/90"
                    >
                      <Save size={16} /> Save
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Information inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">Full Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  disabled={!isEditingProfile}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:text-white/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white/50 cursor-not-allowed"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <CheckCircle size={10} /> Verified
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">Department</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                  <input
                    type="text"
                    value={profileData.department}
                    onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                    disabled={!isEditingProfile}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:text-white/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white block">Role</label>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 capitalize cursor-not-allowed">
                  {user?.role || 'Admin'}
                </div>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Lock size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Security</h3>
                <p className="text-xs text-white/60">Manage your password</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="text-xs text-white/60 uppercase font-semibold mb-1.5 block">Current Password</label>
                <input
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/15"
                  placeholder="Enter current password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/60 uppercase font-semibold mb-1.5 block">New Password</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/15"
                    placeholder="New password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 uppercase font-semibold mb-1.5 block">Confirm</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:ring-2 focus:ring-white/15"
                    placeholder="Confirm password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full btn-primary flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 transition-colors">
                  <Shield size={16} />
                  Update Security
                </button>
              </div>
            </form>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Bell size={20} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Notifications</h3>
                <p className="text-xs text-white/60">Manage your alerts</p>
              </div>
            </div>

            <div className="space-y-0 rounded-2xl border border-white/10 overflow-hidden">
              {notificationToggles.map((toggle) => (
                <div
                  key={toggle.key}
                  className="flex items-center justify-between px-4 py-4 bg-[#111] border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{toggle.title}</p>
                    <p className="text-xs text-white/60">{toggle.description}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={(notifications as any)[toggle.key]}
                      onChange={(e) =>
                        setNotifications({ ...notifications, [toggle.key]: e.target.checked })
                      }
                    />
                    <div className="h-6 w-11 rounded-full bg-white/20 transition peer-checked:bg-blue-600 peer-focus:outline-none" />
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <button
                onClick={async () => {
                  if (!user) return;
                  // Just saving to Firestore profile for persistence if possible, though fields might not exist in type
                  // Using upsertUserProfile to merge data
                  try {
                    await upsertUserProfile(user.id, {
                      // @ts-ignore - Dynamic fields
                      notifications: notifications
                    });
                    alert('Preferences saved');
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        );

      case 'danger':
        return (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-400">Danger Zone</h3>
                <p className="text-xs text-red-400/70">Irreversible actions</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/10">
              <div>
                <p className="text-sm font-medium text-white">Deactivate Account</p>
                <p className="text-xs text-white/50">This will permanently delete your account and all data.</p>
              </div>
              <button
                onClick={async () => {
                  if (confirm('Are you absolutely sure? This cannot be undone.')) {
                    if (auth.currentUser) {
                      try {
                        await deleteUser(auth.currentUser);
                      } catch (e) {
                        alert('Failed to delete. Try logging in again.');
                      }
                    }
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors shadow-sm whitespace-nowrap"
              >
                Deactivate
              </button>
            </div>

            {/* Organization Deletion - Admin Only */}
            {user?.role === 'admin' && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/10 mt-4">
                <div>
                  <p className="text-sm font-medium text-white">Delete Organization</p>
                  <p className="text-xs text-white/50">
                    DANGER: Recursively deletes all employees, campaigns, and data for <span className="font-bold text-white/70">{organizationName || '...'}</span>.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 rounded-lg bg-transparent border border-red-500/50 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors shadow-sm whitespace-nowrap"
                >
                  Delete Org
                </button>
              </div>
            )}

            <Modal
              isOpen={showDeleteModal}
              onClose={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
              }}
              title="Delete Organization"
              size="md"
            >
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-4">
                  <div className="p-2 rounded-lg bg-red-500/20 h-fit">
                    <AlertTriangle size={24} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-500 mb-1">Warning: Irreversible Action</h3>
                    <p className="text-xs text-red-400/80 leading-relaxed">
                      You are about to permanently delete <strong className="text-white">{organizationName}</strong>.
                      This will remove all associated data including:
                    </p>
                    <ul className="list-disc list-inside text-xs text-red-400/80 mt-2 space-y-1">
                      <li>All employee accounts and their progress</li>
                      <li>All campaigns and learning data</li>
                      <li>All uploaded videos and assets</li>
                      <li>Your own admin account</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Type <span className="font-mono text-red-400">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all font-mono"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteConfirmation('');
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (deleteConfirmation !== 'DELETE') return;

                      setIsDeletingOrg(true);
                      try {
                        const { httpsCallable } = await import('firebase/functions');
                        const { functions } = await import('@/lib/firebase');
                        const deleteOrgFn = httpsCallable(functions, 'deleteOrganization');

                        await deleteOrgFn({ organizationId: user?.organization });

                        auth.signOut();
                        window.location.href = '/login';
                      } catch (e) {
                        console.error(e);
                        alert('Failed to delete organization. Ensure you are an Admin.');
                        setIsDeletingOrg(false);
                      }
                    }}
                    disabled={deleteConfirmation !== 'DELETE' || isDeletingOrg}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600/20 border border-red-500/20 text-red-500 font-bold hover:bg-red-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isDeletingOrg ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>Delete Organization</>
                    )}
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        );

      default:
        return null;
    }
  };

  const notificationToggles = [
    { key: 'emailNotifications', title: 'Email Notifications', description: 'Receive updates via email' },
    { key: 'campaignUpdates', title: 'Campaign Updates', description: 'News about campaigns' },
    { key: 'analyticsReports', title: 'Analytics Reports', description: 'Weekly performance reports' },
    { key: 'securityAlerts', title: 'Security Alerts', description: 'Critical security updates' },
  ];

  return (
    <div className="text-white p-6 md:p-10 min-h-[calc(100vh-140px)] flex flex-col">
      <div className="max-w-6xl mx-auto flex-1 flex flex-col w-full">
        <div className="flex flex-col lg:flex-row gap-8 flex-1">

          {/* Internal Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-8 lg:sticky lg:top-0 h-fit">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 px-3 mb-3">Settings</p>
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Divider (Desktop) */}
          <div className="hidden lg:block w-px bg-white/5 rounded-full self-stretch" />

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 max-w-3xl flex flex-col">
            {renderContent()}
          </main>

        </div>
      </div>
    </div>
  );
};

export default Account;
