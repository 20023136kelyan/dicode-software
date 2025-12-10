import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ArrowLeft, Shield, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import ProfileLayout from '@/components/desktop/ProfileLayout';

// Hook to detect if we're on desktop
const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return isDesktop;
};

const RedirectToProfile = ({ section }: { section: string }) => {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    // Only redirect on desktop
    if (isDesktop) {
      navigate('/employee/profile', { state: { activeSection: section } });
    }
  }, [navigate, section, isDesktop]);

  return null;
};

const Security: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Password validation
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleSubmit = async () => {
    if (!isPasswordValid || !passwordsMatch || !currentPassword) {
      setError('Please fill in all fields correctly');
      return;
    }

    if (!auth.currentUser || !user?.email) {
      setError('Not authenticated. Please log in again.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Update password
      await updatePassword(auth.currentUser, newPassword);

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        navigate(-1);
      }, 2000);
    } catch (err: any) {
      console.error('Error changing password:', err);
      if (err.code === 'auth/wrong-password') {
        setError('Current password is incorrect');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Please log out and log in again to change your password');
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const RequirementItem = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-400' : 'text-white/40'}`}>
      <Check size={12} className={met ? 'opacity-100' : 'opacity-30'} />
      <span>{label}</span>
    </div>
  );

  return (
    <>
      {/* Desktop View - Redirect to Profile Dashboard */}
      <div className="hidden lg:block">
        <div className="min-h-screen bg-[#050608] flex items-center justify-center">
          <p className="text-white/50">Redirecting to profile...</p>
          {/* Effect to redirect */}
          <RedirectToProfile section="security" />
        </div>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden min-h-screen bg-black pb-8">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
            <h1 className="text-lg font-semibold text-white">Security</h1>
            <div className="w-10" />
          </div>
        </header>

        {/* Content */}
        <div className="px-4 py-6 space-y-6">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#00A3FF]/20 to-[#00A3FF]/5 rounded-2xl p-6 text-center"
          >
            <div className="w-16 h-16 bg-[#00A3FF]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-[#00A3FF]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Change Password</h2>
            <p className="text-white/60 text-sm">
              Keep your account secure with a strong password
            </p>
          </motion.div>

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/20 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check size={20} className="text-green-400" />
              </div>
              <div>
                <p className="text-green-400 font-medium">Password changed!</p>
                <p className="text-green-400/70 text-sm">Redirecting...</p>
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Form */}
          {!success && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              {/* Current Password */}
              <div className="bg-[#1a1a1a] rounded-2xl p-4">
                <label className="block text-white/50 text-sm mb-2">Current Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                    placeholder="Enter current password"
                    className="w-full bg-transparent text-white text-lg outline-none pl-7 pr-10 placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="bg-[#1a1a1a] rounded-2xl p-4">
                <label className="block text-white/50 text-sm mb-2">New Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Enter new password"
                    className="w-full bg-transparent text-white text-lg outline-none pl-7 pr-10 placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Requirements */}
                {newPassword.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                    <RequirementItem met={hasMinLength} label="At least 8 characters" />
                    <RequirementItem met={hasUppercase} label="One uppercase letter" />
                    <RequirementItem met={hasLowercase} label="One lowercase letter" />
                    <RequirementItem met={hasNumber} label="One number" />
                    <RequirementItem met={hasSpecial} label="One special character" />
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="bg-[#1a1a1a] rounded-2xl p-4">
                <label className="block text-white/50 text-sm mb-2">Confirm New Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Confirm new password"
                    className="w-full bg-transparent text-white text-lg outline-none pl-7 pr-10 placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/50"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-2 text-red-400 text-xs">Passwords do not match</p>
                )}
                {passwordsMatch && (
                  <p className="mt-2 text-green-400 text-xs flex items-center gap-1">
                    <Check size={12} /> Passwords match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={handleSubmit}
                disabled={isSubmitting || !isPasswordValid || !passwordsMatch || !currentPassword}
                className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${isSubmitting || !isPasswordValid || !passwordsMatch || !currentPassword
                  ? 'bg-white/10 text-white/30 cursor-not-allowed'
                  : 'bg-[#00A3FF] text-white hover:bg-[#0090e0] active:scale-[0.98]'
                  }`}
              >
                {isSubmitting ? 'Changing Password...' : 'Change Password'}
              </motion.button>
            </motion.div>
          )}

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/30 text-xs text-center px-4"
          >
            After changing your password, you may need to log in again on other devices.
          </motion.p>
        </div>
      </div>
    </>
  );
};

export default Security;

