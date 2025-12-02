import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Bell,
  BarChart,
  Building2,
  CheckCircle,
  Clock3,
  Edit3,
  ChevronRight,
  Flame,
  FileText,
  Loader,
  LogOut,
  Mail,
  MessageCircle,
  Save,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserEnrollments, getUserStats, upsertUserProfile } from '@/lib/firestore';

type NotificationKey = 'emailNotifications' | 'moduleReminders' | 'progressUpdates';

const PROFILE_NAV_ITEMS = [
  { label: 'Edit profile', active: true },
  { label: 'My stats', active: false },
  { label: 'Contact support', active: false },
];

const SETTINGS_NAV_ITEMS = [
  { label: 'Security', active: false },
  { label: 'Email notifications', active: false },
  { label: 'Report an issue', active: false },
  { label: 'Privacy statement', active: false },
];



const MOBILE_MENU_GROUPS = [
  {
    title: 'General',
    items: [
      { key: 'Edit profile', label: 'Edit profile', icon: User },
      { key: 'My stats', label: 'My stats', icon: BarChart },
      { key: 'Security', label: 'Security', icon: Shield },
      { key: 'Email notifications', label: 'Email notifications', icon: Bell },
    ],
  },
  {
    title: 'Support',
    items: [
      { key: 'Report an issue', label: 'Report an issue', icon: MessageCircle },
      { key: 'Contact support', label: 'Contact support', icon: MessageCircle },
    ],
  },
  {
    title: 'Legal',
    items: [
      { key: 'Privacy statement', label: 'Privacy statement', icon: FileText },
      { key: 'Change password', label: 'Change password', icon: Shield },
    ],
  },
];

const normalizeDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileSection, setMobileSection] = useState<string>('Edit profile');
  const [mobileMode, setMobileMode] = useState<'list' | 'detail'>('list');

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    moduleReminders: true,
    progressUpdates: true,
  });

  const [userStats, setUserStats] = useState({
    completedModules: 0,
    totalModules: 0,
    completionRate: 0,
    averageScore: 0,
    currentStreak: 0,
    totalLearningHours: 0,
    joinDate: 'N/A',
    lastActivity: 'N/A',
  });

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;

      setIsLoadingStats(true);

      try {
        const enrollments = await getUserEnrollments(user.id);
        const stats = await getUserStats(user.id);

        const completedModules = enrollments.filter((e) => e.status === 'completed').length;
        const totalModules = enrollments.length;
        const completionRate = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

        const lastAccessDates = enrollments
          .map((e) => normalizeDate((e as any).lastAccessedAt))
          .filter((date): date is Date => !!date)
          .sort((a, b) => b.getTime() - a.getTime());

        const lastActivity = lastAccessDates.length > 0 ? formatDate(lastAccessDates[0]) : 'No activity yet';
        const joinDate = 'N/A'; // TODO: Add createdAt to User type once available

        setUserStats({
          completedModules,
          totalModules,
          completionRate,
          averageScore: stats.averageScore,
          currentStreak: stats.currentStreak,
          totalLearningHours: stats.totalLearningHours,
          joinDate,
          lastActivity,
        });
      } catch (error) {
        console.error('[Profile] Failed to load stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, [user]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      await upsertUserProfile(user.id, {
        name: profileData.name.trim(),
        department: profileData.department.trim() || null,
      });

      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error('[Profile] Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && mobileMode === 'detail') {
      setMobileMode('list');
      return;
    }
    navigate(-1);
  };

  const handleCancelEdit = () => {
    setProfileData({
      name: user?.name || '',
      email: user?.email || '',
      department: user?.department || '',
    });
    setIsEditing(false);
  };

  const notificationToggles: Array<{ key: NotificationKey; title: string; description: string }> = [
    { key: 'emailNotifications', title: 'Email notifications', description: 'Receive updates via email' },
    { key: 'moduleReminders', title: 'Module reminders', description: 'Stay on track with modules' },
    { key: 'progressUpdates', title: 'Progress updates', description: 'Weekly summaries in your inbox' },
  ];

  const progressBadges = [
    {
      label: 'Completed modules',
      value: `${userStats.completedModules}/${userStats.totalModules}`,
      icon: CheckCircle,
    },
    { label: 'Completion rate', value: `${userStats.completionRate}%`, icon: Award },
    { label: 'Current streak', value: `${userStats.currentStreak} days`, icon: Flame },
    { label: 'Learning time', value: `${userStats.totalLearningHours}h`, icon: Clock3 },
  ];

  const renderActionButtons = () => (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {!isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:border-white/30 hover:bg-white/10"
        >
          <Edit3 size={16} />
          Edit profile
        </button>
      ) : (
        <>
          <button
            onClick={handleCancelEdit}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/10"
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? (
              <>
                <Loader size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save changes
              </>
            )}
          </button>
        </>
      )}
    </div>
  );

  const renderMainContent = () => (
    <div className="relative rounded-2xl bg-[#090909] p-6 shadow-sm space-y-8">
      <div className="flex flex-wrap items-start gap-6 -mt-20">
        <div className="h-28 w-28 rounded-2xl border-4 border-[#050608] bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-300 text-3xl font-semibold text-white shadow-lg flex items-center justify-center">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="min-w-[240px] flex-1 space-y-2">
          <h2 className="text-xl font-semibold text-white">{profileData.name || 'Your name'}</h2>
          <p className="text-sm text-white/70">{profileData.email || 'your.email@company.com'}</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
              <User size={14} />
              {user?.role || 'Employee'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
              <Building2 size={14} />
              {profileData.department || 'Department'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              Active
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Full name</p>
              <p className="text-xs text-white/60">Your display name</p>
            </div>
          </div>
          <input
            type="text"
            value={profileData.name}
            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
            disabled={!isEditing}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/50"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Email</p>
              <p className="text-xs text-white/60">Where you receive notifications</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white">
              <CheckCircle size={14} />
              Verified
            </span>
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              disabled
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white/60 placeholder:text-white/50 focus:border-white/30 focus:ring-2 focus:ring-white/15"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-white">Department</p>
            <p className="text-xs text-white/60">Where you sit in the org</p>
          </div>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              value={profileData.department}
              onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
              disabled={!isEditing}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/50"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-white">Role</p>
            <p className="text-xs text-white/60">This is managed by your admin</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 capitalize">
            {user?.role || 'Employee'}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Your progress</p>
            <p className="text-xs text-white/60">Live snapshot from your enrollments</p>
          </div>
          {isLoadingStats ? <Loader className="h-5 w-5 animate-spin text-white" /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {progressBadges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white"
            >
              <badge.icon size={14} className="text-white" />
              <span className="text-sm font-semibold text-white">{badge.value}</span>
              <span className="text-xs text-white/60">{badge.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-white" />
          <div>
            <p className="text-sm font-semibold text-white">Notification preferences</p>
            <p className="text-xs text-white/60">Choose how you want to stay in the loop</p>
          </div>
        </div>
        <div className="space-y-0 rounded-2xl border border-white/10 overflow-hidden">
          {notificationToggles.map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-center justify-between px-4 py-4 bg-[#111] border-b border-white/5 last:border-b-0"
            >
              <div>
                <p className="text-sm font-semibold text-white">{toggle.title}</p>
                <p className="text-xs text-white/60">{toggle.description}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={notifications[toggle.key]}
                  onChange={(e) =>
                    setNotifications({ ...notifications, [toggle.key]: e.target.checked })
                  }
                />
                <div className="h-6 w-11 rounded-full bg-white/20 transition peer-checked:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-white/30" />
                <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-checked:bg-[#0c0c0c]" />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Account activity</p>
          <div className="mt-3 space-y-2 text-sm text-white">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Member since</span>
              <span className="font-medium text-white">{userStats.joinDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Last activity</span>
              <span className="font-medium text-white">{userStats.lastActivity}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Completion rate</span>
              <span className="font-medium text-white">{userStats.completionRate}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Learning cadence</p>
          <div className="mt-3 space-y-2 text-sm text-white">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Current streak</span>
              <span className="font-semibold text-white">{userStats.currentStreak} days</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Average score</span>
              <span className="font-medium text-white">{userStats.averageScore}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Learning time</span>
              <span className="font-medium text-white">{userStats.totalLearningHours}h</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white/5 p-4">
        <p className="text-sm font-semibold text-white">My stats</p>
        <p className="mt-2 text-sm text-white/60">We’ll add detailed analytics and insights here soon.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <Shield className="h-4 w-4 text-white" />
        <div>
          <p className="text-sm font-semibold text-white">Security</p>
          <p className="text-xs text-white/60">Manage password and sign-in protection</p>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#050608] text-white">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBackClick}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:border-white/30 hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        {/* Desktop layout */}
        <div className="hidden lg:flex gap-8">
          <aside className="w-64 space-y-4">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Profile</p>
                <div className="mt-3 space-y-1">
                  {PROFILE_NAV_ITEMS.map((item) => {
                    const isActive = item.active;
                    return (
                      <button
                        key={item.label}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608] ${isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Settings</p>
                  <div className="mt-3 space-y-1">
                    {SETTINGS_NAV_ITEMS.map((item) => {
                      const isActive = item.active;
                      return (
                        <button
                          key={item.label}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608] ${isActive ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                        >
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm font-medium text-white/60 transition-all hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608]">
                      <span>Change password</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            </div>
          </aside>

          <div className="w-px bg-white/5 rounded-full self-stretch" />

          <main className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-3">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:border-white/30 hover:bg-white/10"
                >
                  <Edit3 size={16} />
                  Edit profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/10"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save changes
                      </>
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="relative rounded-2xl bg-[#090909] p-6 shadow-sm space-y-8">
              <div className="flex flex-wrap items-start gap-6 -mt-20">
                <div className="h-28 w-28 rounded-2xl border-4 border-[#050608] bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-300 text-3xl font-semibold text-white shadow-lg flex items-center justify-center">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-[240px] flex-1 space-y-2">
                  <h2 className="text-xl font-semibold text-white">{profileData.name || 'Your name'}</h2>
                  <p className="text-sm text-white/70">{profileData.email || 'your.email@company.com'}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                      <User size={14} />
                      {user?.role || 'Employee'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                      <Building2 size={14} />
                      {profileData.department || 'Department'}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                      Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Full name</p>
                      <p className="text-xs text-white/60">Your display name</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    disabled={!isEditing}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/50"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Email</p>
                      <p className="text-xs text-white/60">Where you receive notifications</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white">
                      <CheckCircle size={14} />
                      Verified
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      disabled
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white/60 placeholder:text-white/50 focus:border-white/30 focus:ring-2 focus:ring-white/15"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-white">Department</p>
                    <p className="text-xs text-white/60">Where you sit in the org</p>
                  </div>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                    <input
                      type="text"
                      value={profileData.department}
                      onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                      disabled={!isEditing}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-white">Role</p>
                    <p className="text-xs text-white/60">This is managed by your admin</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 capitalize">
                    {user?.role || 'Employee'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Your progress</p>
                    <p className="text-xs text-white/60">Live snapshot from your enrollments</p>
                  </div>
                  {isLoadingStats ? (
                    <Loader className="h-5 w-5 animate-spin text-white" />
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {progressBadges.map((badge) => (
                    <span
                      key={badge.label}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white"
                    >
                      <badge.icon size={14} className="text-white" />
                      <span className="text-sm font-semibold text-white">{badge.value}</span>
                      <span className="text-xs text-white/60">{badge.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-white" />
                  <div>
                    <p className="text-sm font-semibold text-white">Notification preferences</p>
                    <p className="text-xs text-white/60">Choose how you want to stay in the loop</p>
                  </div>
                </div>
                <div className="space-y-0 rounded-2xl border border-white/10 overflow-hidden">
                  {notificationToggles.map((toggle) => (
                    <div
                      key={toggle.key}
                      className="flex items-center justify-between px-4 py-4 bg-[#111] border-b border-white/5 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{toggle.title}</p>
                        <p className="text-xs text-white/60">{toggle.description}</p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={notifications[toggle.key]}
                          onChange={(e) =>
                            setNotifications({ ...notifications, [toggle.key]: e.target.checked })
                          }
                        />
                        <div className="h-6 w-11 rounded-full bg-white/20 transition peer-checked:bg-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-white/30" />
                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-checked:bg-[#0c0c0c]" />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Account activity</p>
                  <div className="mt-3 space-y-2 text-sm text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Member since</span>
                      <span className="font-medium text-white">{userStats.joinDate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Last activity</span>
                      <span className="font-medium text-white">{userStats.lastActivity}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Completion rate</span>
                      <span className="font-medium text-white">{userStats.completionRate}%</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Learning cadence</p>
                  <div className="mt-3 space-y-2 text-sm text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Current streak</span>
                      <span className="font-semibold text-white">{userStats.currentStreak} days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Average score</span>
                      <span className="font-medium text-white">{userStats.averageScore}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Learning time</span>
                      <span className="font-medium text-white">{userStats.totalLearningHours}h</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">My stats</p>
                <p className="mt-2 text-sm text-white/60">We’ll add detailed analytics and insights here soon.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <Shield className="h-4 w-4 text-white" />
                <div>
                  <p className="text-sm font-semibold text-white">Security</p>
                  <p className="text-xs text-white/60">Manage password and sign-in protection</p>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden space-y-4">
          {mobileMode === 'list' ? (
            <>
              <div className="flex items-center gap-3 pt-2">
                <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-amber-300 flex items-center justify-center text-xl font-semibold text-white shadow-lg">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">{profileData.name || 'Your name'}</p>
                  <p className="text-xs text-white/60">{profileData.email || 'your.email@company.com'}</p>
                </div>
              </div>
              <div className="rounded-3xl overflow-hidden">
                {MOBILE_MENU_GROUPS.map((group) => (
                  <div key={group.title} className="px-4 py-3">
                    <div className="flex items-center justify-between pb-2">
                      <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">{group.title}</p>
                      <div className="flex-1 ml-3 h-px bg-white/10" />
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = mobileSection === item.key;
                        return (
                          <button
                            key={item.key}
                            onClick={() => {
                              setMobileSection(item.key);
                              setMobileMode('detail');
                            }}
                            className={`w-full flex items-center justify-between py-3 text-left transition transform ${isActive ? 'text-white' : 'text-white/80'
                              } hover:bg-white/5 active:scale-[0.99]`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                                <Icon size={16} />
                              </span>
                              <span className="text-sm font-semibold">{item.label}</span>
                            </div>
                            <ChevronRight size={16} className="text-white/50" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between px-4 py-4 text-left text-sm font-semibold text-red-400 transition hover:bg-white/5 active:scale-[0.99] border-t border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                      <LogOut size={16} />
                    </span>
                    <span>Logout</span>
                  </div>
                  <ChevronRight size={16} className="text-red-400/80" />
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">

              {mobileSection === 'Edit profile' && (
                <>
                  {renderActionButtons()}
                  {renderMainContent()}
                </>
              )}

              {mobileSection === 'My stats' && (
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">My stats</p>
                  <p className="mt-2 text-sm text-white/60">We’ll add detailed analytics and insights here soon.</p>
                </div>
              )}

              {mobileSection !== 'Edit profile' && mobileSection !== 'My stats' && mobileSection !== 'Logout' && (
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{mobileSection}</p>
                  <p className="mt-2 text-sm text-white/60">Content coming soon for this section.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
