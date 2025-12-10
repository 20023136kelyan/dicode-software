'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import MainLayout from '@/components/Layout/MainLayout';
import {
  User,
  Mail,
  Shield,
  Bell,
  Palette,
  Monitor,
  Moon,
  Sun,
  Key,
  Clock,
  Globe,
  Check,
  ChevronRight,
  Camera,
  LogOut,
  AlertTriangle,
  Loader2,
  CheckCircle,
  X,
} from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

interface NotificationSetting {
  id: 'campaign_updates' | 'video_generation' | 'team_activity' | 'system_alerts';
  label: string;
  description: string;
  enabled: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationSetting[] = [
  {
    id: 'campaign_updates',
    label: 'Campaign Updates',
    description: 'Get notified when campaigns are published or updated',
    enabled: true,
  },
  {
    id: 'video_generation',
    label: 'Video Generation',
    description: 'Receive alerts when video generation completes',
    enabled: true,
  },
  {
    id: 'team_activity',
    label: 'Team Activity',
    description: 'Stay informed about team member actions',
    enabled: false,
  },
  {
    id: 'system_alerts',
    label: 'System Alerts',
    description: 'Important system notifications and updates',
    enabled: true,
  },
];

export default function SettingsPage() {
  const { 
    user, 
    userProfile, 
    profileLoading, 
    signOut, 
    updateDisplayName, 
    updateAvatar, 
    updateNotificationPreferences 
  } = useAuth();
  const { info: showInfo } = useNotification();
  
  const [activeSection, setActiveSection] = useState('profile');
  const [theme, setTheme] = useState<Theme>('light');
  
  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  
  // Avatar state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Notification state
  const [notifications, setNotifications] = useState<NotificationSetting[]>(DEFAULT_NOTIFICATIONS);
  const [savingNotifications, setSavingNotifications] = useState<string | null>(null);
  
  // Browser notifications state
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [requestingBrowserNotifications, setRequestingBrowserNotifications] = useState(false);

  // Load initial data from userProfile
  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || user?.displayName || '');
      
      // Map notification preferences to state
      const prefs = userProfile.notificationPreferences;
      setNotifications(prev => prev.map(n => ({
        ...n,
        enabled: prefs[n.id] ?? n.enabled,
      })));
      
      setBrowserNotificationsEnabled(prefs.browser_notifications ?? false);
    } else if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [userProfile, user]);

  // Check browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      setProfileError('Display name is required');
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      await updateDisplayName(displayName.trim());
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setAvatarProgress(0);
    setAvatarError(null);

    try {
      await updateAvatar(file, (progress) => {
        setAvatarProgress(progress);
      });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      setAvatarProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleNotification = async (id: NotificationSetting['id']) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    const newValue = !notification.enabled;
    
    // Optimistic update
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, enabled: newValue } : n
    ));
    
    setSavingNotifications(id);

    try {
      await updateNotificationPreferences({ [id]: newValue });
    } catch (error) {
      // Revert on error
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, enabled: !newValue } : n
      ));
      console.error('Failed to update notification preference:', error);
    } finally {
      setSavingNotifications(null);
    }
  };

  const requestBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      showInfo('Not Supported', 'Your browser does not support notifications.');
      return;
    }

    setRequestingBrowserNotifications(true);

    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setBrowserNotificationsEnabled(granted);
      
      // Save preference to Firestore
      await updateNotificationPreferences({ browser_notifications: granted });
      
      if (granted) {
        new Notification('Notifications Enabled', {
          body: 'You will now receive browser notifications from DiCode.',
          icon: '/favicon.png',
        });
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setRequestingBrowserNotifications(false);
    }
  };

  const themeOptions: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  // Get current avatar URL
  const avatarUrl = userProfile?.photoURL || user?.photoURL;

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Sidebar Navigation */}
            <nav className="w-full shrink-0 lg:w-56">
              <div className="rounded-xl border border-slate-200 bg-white p-1.5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Content Area */}
            <div className="flex-1">
              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  {/* Profile Card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-6 text-lg font-semibold text-slate-900">
                      Profile Information
                    </h2>

                    <div className="flex flex-col items-start gap-6 sm:flex-row">
                      {/* Avatar */}
                      <div className="relative">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                        />
                        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 text-3xl font-bold text-white shadow-lg shadow-violet-500/20 overflow-hidden">
                          {uploadingAvatar ? (
                            <div className="flex flex-col items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin" />
                              <span className="text-xs mt-1">{Math.round(avatarProgress)}%</span>
                            </div>
                          ) : avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName || 'User'}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (displayName || user?.email)?.[0]?.toUpperCase() || '?'
                          )}
                        </div>
                        <button 
                          onClick={handleAvatarClick}
                          disabled={uploadingAvatar}
                          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-lg border-2 border-white bg-slate-900 text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 space-y-4">
                        {avatarError && (
                          <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            <X className="h-4 w-4" />
                            {avatarError}
                          </div>
                        )}
                        
                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Display Name
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder="Your name"
                              className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                            />
                          </div>
                          {profileError && (
                            <p className="mt-1.5 text-xs text-rose-600">{profileError}</p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                            Email Address
                          </label>
                          <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-600">
                              {user?.email}
                            </span>
                            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Verified
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">
                            Email is managed by Google and cannot be changed
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                      {profileSaved && (
                        <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                          <CheckCircle className="h-4 w-4" />
                          Saved successfully
                        </div>
                      )}
                      <button 
                        onClick={handleSaveProfile}
                        disabled={savingProfile || profileLoading}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        {savingProfile ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Account Info */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-4 text-lg font-semibold text-slate-900">
                      Account Details
                    </h2>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200">
                            <Key className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              User ID
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {user?.uid?.slice(0, 20)}...
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200">
                            <Clock className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              Account Created
                            </p>
                            <p className="text-xs text-slate-500">
                              {user?.metadata?.creationTime
                                ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })
                                : 'Unknown'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200">
                            <Globe className="h-4 w-4 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              Last Sign In
                            </p>
                            <p className="text-xs text-slate-500">
                              {user?.metadata?.lastSignInTime
                                ? new Date(user.metadata.lastSignInTime).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Unknown'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === 'notifications' && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 className="mb-2 text-lg font-semibold text-slate-900">
                    Notification Preferences
                  </h2>
                  <p className="mb-6 text-sm text-slate-500">
                    Choose what notifications you want to receive
                  </p>

                  <div className="space-y-4">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition hover:border-slate-300"
                      >
                        <div className="flex-1 pr-4">
                          <p className="text-sm font-medium text-slate-900">
                            {notification.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {notification.description}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleNotification(notification.id)}
                          disabled={savingNotifications === notification.id}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                            notification.enabled
                              ? 'bg-emerald-500'
                              : 'bg-slate-200'
                          }`}
                        >
                          {savingNotifications === notification.id ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                            </span>
                          ) : (
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                notification.enabled
                                  ? 'left-[22px]'
                                  : 'left-0.5'
                              }`}
                            />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-lg bg-sky-50 p-4">
                    <div className="flex gap-3">
                      <Bell className="h-5 w-5 shrink-0 text-sky-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-sky-900">
                          Browser Notifications
                        </p>
                        <p className="mt-0.5 text-xs text-sky-700">
                          Enable browser notifications to receive real-time updates even when the app is in the background.
                        </p>
                        {browserNotificationsEnabled ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Browser notifications enabled
                          </div>
                        ) : (
                          <button 
                            onClick={requestBrowserNotifications}
                            disabled={requestingBrowserNotifications}
                            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
                          >
                            {requestingBrowserNotifications ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Requesting permission...
                              </>
                            ) : (
                              'Enable Browser Notifications →'
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Section */}
              {activeSection === 'appearance' && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">
                      Theme
                    </h2>
                    <p className="mb-6 text-sm text-slate-500">
                      Select your preferred color theme
                    </p>

                    <div className="grid grid-cols-3 gap-3">
                      {themeOptions.map((option) => {
                        const Icon = option.icon;
                        const isSelected = theme === option.value;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setTheme(option.value)}
                            className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition ${
                              isSelected
                                ? 'border-slate-900 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {isSelected && (
                              <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                                isSelected
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <Icon className="h-6 w-6" />
                            </div>
                            <span
                              className={`text-sm font-medium ${
                                isSelected ? 'text-slate-900' : 'text-slate-600'
                              }`}
                            >
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-6 rounded-lg bg-amber-50 p-4">
                      <div className="flex gap-3">
                        <Palette className="h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-sm font-medium text-amber-900">
                            Theme Support Coming Soon
                          </p>
                          <p className="mt-0.5 text-xs text-amber-700">
                            Dark mode and system theme support are currently in development. Stay tuned!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Mode */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Compact Mode
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Reduce spacing and padding for a denser interface
                        </p>
                      </div>
                      <button className="relative h-6 w-11 shrink-0 rounded-full bg-slate-200 transition-colors">
                        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Section */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  {/* Authentication Method */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">
                      Authentication
                    </h2>
                    <p className="mb-6 text-sm text-slate-500">
                      How you sign in to your account
                    </p>

                    <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-200">
                          <svg className="h-6 w-6" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Google Account
                          </p>
                          <p className="text-xs text-slate-500">
                            Signed in via Google OAuth
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        Connected
                      </span>
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-2 text-lg font-semibold text-slate-900">
                      Active Sessions
                    </h2>
                    <p className="mb-6 text-sm text-slate-500">
                      Devices where you're currently signed in
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                            <Monitor className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900">
                                Current Session
                              </p>
                              <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                                THIS DEVICE
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Last active: Just now
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
                    <h2 className="mb-2 text-lg font-semibold text-rose-900">
                      Danger Zone
                    </h2>
                    <p className="mb-6 text-sm text-rose-700">
                      Irreversible and destructive actions
                    </p>

                    <div className="space-y-3">
                      <button
                        onClick={() => signOut()}
                        className="flex w-full items-center justify-between rounded-lg border border-rose-200 bg-white p-4 text-left transition hover:border-rose-300 hover:bg-rose-50"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut className="h-5 w-5 text-rose-600" />
                          <div>
                            <p className="text-sm font-medium text-rose-900">
                              Sign Out
                            </p>
                            <p className="text-xs text-rose-600">
                              Sign out of your current session
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-rose-400" />
                      </button>

                      <button className="flex w-full items-center justify-between rounded-lg border border-rose-200 bg-white p-4 text-left transition hover:border-rose-300 hover:bg-rose-50">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-rose-600" />
                          <div>
                            <p className="text-sm font-medium text-rose-900">
                              Delete Account
                            </p>
                            <p className="text-xs text-rose-600">
                              Permanently delete your account and all data
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-rose-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
