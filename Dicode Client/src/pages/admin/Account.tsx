import React, { useState } from 'react';
import { User, Mail, Lock, Bell, Shield, Camera, Building2, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Account = () => {
  const { user } = useAuth();

  // Form state
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

  const panelClass = 'card';

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement profile update logic
    console.log('Profile updated:', profileData);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement password change logic
    console.log('Password change requested');
  };

  const handleNotificationUpdate = () => {
    // TODO: Implement notification preferences update
    console.log('Notifications updated:', notifications);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Profile & Security */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information */}
          <div className={panelClass}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <User size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-dark-text">Profile Information</h2>
            </div>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              {/* Profile Picture */}
              <div className="flex items-center gap-4 pb-4 border-b border-dark-border">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-primary to-blue-light flex items-center justify-center text-white text-2xl font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-dark-text hover:bg-dark-bg transition-colors"
                  >
                    <Camera size={16} />
                    Change Photo
                  </button>
                  <p className="text-xs text-dark-text-muted mt-1">JPG, PNG or GIF. Max 2MB</p>
                </div>
              </div>

              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Full Name
                </label>
                <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                <input
                  type="text"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  placeholder="Enter your full name"
                />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Email Address
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                  <Mail size={18} className="text-dark-text-muted" />
                  <input
                    type="email"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    placeholder="your.email@company.com"
                  />
                </div>
              </div>

              {/* Department Field */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Department
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                  <Building2 size={18} className="text-dark-text-muted" />
                  <input
                    type="text"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                    value={profileData.department}
                    onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                    placeholder="e.g., Marketing, HR, IT"
                  />
                </div>
              </div>

              {/* Role Display (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Role
                </label>
                <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3 text-dark-text capitalize cursor-not-allowed">
                  {user?.role || 'Admin'}
                </div>
                <p className="text-xs text-dark-text-muted mt-1">Contact your system administrator to change roles</p>
              </div>

              <div className="pt-4">
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Security Settings */}
          <div className={panelClass}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Lock size={24} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-dark-text">Security</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Current Password
                </label>
                <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                <input
                  type="password"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  New Password
                </label>
                <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                <input
                  type="password"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
                </div>
                <p className="text-xs text-dark-text-muted mt-1">
                  Must be at least 8 characters with uppercase, lowercase, and numbers
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Confirm New Password
                </label>
                <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                <input
                  type="password"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <Shield size={18} />
                  Update Password
                </button>
              </div>
            </form>

            {/* Two-Factor Authentication */}
            <div className="mt-6 pt-6 border-t border-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-dark-text mb-1">Two-Factor Authentication</h3>
                  <p className="text-xs text-dark-text-muted">Add an extra layer of security to your account</p>
                </div>
                <button className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-dark-text hover:bg-dark-bg transition-colors text-sm">
                  Enable
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Notifications & Preferences */}
        <div className="space-y-6">
          {/* Account Overview */}
          <div className={panelClass}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-primary/10 rounded-lg">
                <User size={20} className="text-blue-primary" />
              </div>
              <h3 className="text-lg font-semibold text-dark-text">Account Overview</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-dark-border">
                <span className="text-sm text-dark-text-muted">Account ID</span>
                <span className="text-sm text-dark-text font-mono">{user?.id || 'admin-001'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dark-border">
                <span className="text-sm text-dark-text-muted">Member Since</span>
                <span className="text-sm text-dark-text">Jan 2024</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-dark-text-muted">Last Login</span>
                <span className="text-sm text-dark-text">Today, 9:42 AM</span>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className={panelClass}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bell size={20} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-dark-text">Notifications</h3>
            </div>

            <div className="space-y-4">
              {/* Email Notifications Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dark-text">Email Notifications</p>
                  <p className="text-xs text-dark-text-muted">Receive updates via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications.emailNotifications}
                    onChange={(e) => setNotifications({ ...notifications, emailNotifications: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Campaign Updates */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dark-text">Campaign Updates</p>
                  <p className="text-xs text-dark-text-muted">News about campaigns</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications.campaignUpdates}
                    onChange={(e) => setNotifications({ ...notifications, campaignUpdates: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Analytics Reports */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dark-text">Analytics Reports</p>
                  <p className="text-xs text-dark-text-muted">Weekly performance reports</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications.analyticsReports}
                    onChange={(e) => setNotifications({ ...notifications, analyticsReports: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {/* Security Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-dark-text">Security Alerts</p>
                  <p className="text-xs text-dark-text-muted">Critical security updates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={notifications.securityAlerts}
                    onChange={(e) => setNotifications({ ...notifications, securityAlerts: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-dark-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleNotificationUpdate}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Preferences
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className={`${panelClass} border-red-500/30`}>
            <h3 className="text-lg font-semibold text-red-500 mb-4">Danger Zone</h3>
            <div className="space-y-3">
              <button className="w-full px-4 py-2 bg-dark-card border border-red-500/50 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors text-sm">
                Deactivate Account
              </button>
              <p className="text-xs text-dark-text-muted text-center">
                This action cannot be undone
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
