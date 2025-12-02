import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { updatePassword } from 'firebase/auth';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { upsertUserProfile, updateInvitationStatus } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import { validatePasswordStrength } from '@/utils/passwordUtils';

const ChangePassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fromInvite = location.state?.fromInvite;
  const invitationId = location.state?.invitationId;

  // Validate password in real-time
  const handlePasswordChange = (value: string) => {
    setNewPassword(value);
    setError(null);

    if (value.length > 0) {
      const validation = validatePasswordStrength(value);
      setValidationErrors(validation.errors);
    } else {
      setValidationErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      setError(validation.errors[0]);
      setValidationErrors(validation.errors);
      return;
    }

    if (!user || !auth.currentUser) {
      setError('Not authenticated. Please log in again.');
      return;
    }

    setIsChanging(true);

    try {
      // Update password in Firebase Auth
      await updatePassword(auth.currentUser, newPassword);
      console.log('[ChangePassword] Password updated in Firebase Auth');

      // Update user profile - remove requirePasswordChange flag
      await upsertUserProfile(user.id, {
        requirePasswordChange: false
      });
      console.log('[ChangePassword] User profile updated');

      // Mark invitation as accepted if this came from invite flow
      if (fromInvite && invitationId) {
        await updateInvitationStatus(invitationId, 'accepted');
        console.log('[ChangePassword] Invitation marked as accepted');
      }

      // Refresh user data
      await refreshUser();

      // Redirect to employee onboarding
      navigate('/employee/onboarding');

    } catch (error: any) {
      console.error('[ChangePassword] Failed to change password:', error);

      if (error.code === 'auth/requires-recent-login') {
        setError('Your session has expired. Please log in again.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setIsChanging(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <p className="text-dark-text">Please log in to change your password.</p>
          <button onClick={() => navigate('/login')} className="btn-primary mt-4">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-dark-text mb-2">
            Set Your Password
          </h1>
          <p className="text-dark-text-muted">
            {fromInvite
              ? 'Create a secure password for your account'
              : 'Please create a new password to continue'
            }
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Enter new password"
                className="input w-full pl-10 pr-10"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-text-muted hover:text-dark-text"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password requirements */}
            <div className="mt-2 space-y-1">
              <p className="text-xs text-dark-text-muted">Password must contain:</p>
              <ul className="text-xs space-y-1">
                <li className={`flex items-center gap-2 ${
                  newPassword.length >= 8 ? 'text-green-500' : 'text-dark-text-muted'
                }`}>
                  <CheckCircle size={12} />
                  At least 8 characters
                </li>
                <li className={`flex items-center gap-2 ${
                  /[A-Z]/.test(newPassword) ? 'text-green-500' : 'text-dark-text-muted'
                }`}>
                  <CheckCircle size={12} />
                  One uppercase letter
                </li>
                <li className={`flex items-center gap-2 ${
                  /[a-z]/.test(newPassword) ? 'text-green-500' : 'text-dark-text-muted'
                }`}>
                  <CheckCircle size={12} />
                  One lowercase letter
                </li>
                <li className={`flex items-center gap-2 ${
                  /[0-9]/.test(newPassword) ? 'text-green-500' : 'text-dark-text-muted'
                }`}>
                  <CheckCircle size={12} />
                  One number
                </li>
                <li className={`flex items-center gap-2 ${
                  /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword) ? 'text-green-500' : 'text-dark-text-muted'
                }`}>
                  <CheckCircle size={12} />
                  One special character
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="input w-full pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-text-muted hover:text-dark-text"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isChanging || validationErrors.length > 0 || newPassword !== confirmPassword}
            className="btn-primary w-full"
          >
            {isChanging ? 'Changing Password...' : 'Set Password & Continue'}
          </button>
        </form>

        {/* Help Text */}
        <p className="text-xs text-dark-text-muted text-center mt-4">
          {fromInvite
            ? 'Your temporary password will no longer work after you set a new password.'
            : 'Make sure to remember your new password.'}
        </p>
      </div>
    </div>
  );
};

export default ChangePassword;
