import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff, Building2, UserCircle } from 'lucide-react';
import type { Invitation } from '@/types';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [oobCode, setOobCode] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    score: number;
    label: string;
    color: string;
  }>({ score: 0, label: '', color: '' });

  useEffect(() => {
    const code = searchParams.get('oobCode');

    if (!code) {
      setError('Invalid or missing reset code');
      setIsLoading(false);
      return;
    }

    setOobCode(code);

    // Verify the reset code and fetch invitation details
    verifyPasswordResetCode(auth, code)
      .then(async (emailAddress) => {
        setEmail(emailAddress);

        // Fetch invitation details
        try {
          const invitationsRef = collection(db, 'invitations');
          const q = query(
            invitationsRef,
            where('email', '==', emailAddress.toLowerCase()),
            where('status', '==', 'pending')
          );
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const invitationData = querySnapshot.docs[0].data() as Invitation;
            setInvitation({ ...invitationData, id: querySnapshot.docs[0].id });
            console.log('[ResetPassword] Invitation found:', invitationData);
          } else {
            console.log('[ResetPassword] No pending invitation found for:', emailAddress);
          }
        } catch (inviteError) {
          console.error('[ResetPassword] Failed to fetch invitation:', inviteError);
          // Don't fail the whole flow if we can't fetch the invitation
        }

        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[ResetPassword] Failed to verify code:', error);
        let errorMessage = 'This password reset link is invalid or has expired.';

        if (error.code === 'auth/expired-action-code') {
          errorMessage = 'This password reset link has expired. Please request a new one.';
        } else if (error.code === 'auth/invalid-action-code') {
          errorMessage = 'This password reset link is invalid. Please request a new one.';
        }

        setError(errorMessage);
        setIsLoading(false);
      });
  }, [searchParams]);

  useEffect(() => {
    // Calculate password strength
    if (!password) {
      setPasswordStrength({ score: 0, label: '', color: '' });
      return;
    }

    let score = 0;

    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;

    // Character variety checks
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    let label = '';
    let color = '';

    if (score <= 2) {
      label = 'Weak';
      color = 'text-red-500';
    } else if (score <= 4) {
      label = 'Medium';
      color = 'text-yellow-500';
    } else {
      label = 'Strong';
      color = 'text-green-500';
    }

    setPasswordStrength({ score, label, color });
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength.score <= 2) {
      setError('Please choose a stronger password');
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', {
          state: {
            message: 'Password set successfully! Please log in with your new password.'
          }
        });
      }, 2000);
    } catch (error: any) {
      console.error('[ResetPassword] Failed to reset password:', error);

      let errorMessage = 'Failed to reset password. Please try again.';

      if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/expired-action-code') {
        errorMessage = 'This password reset link has expired. Please request a new one.';
      }

      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-dark-text-muted">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (error && !oobCode) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-dark-text mb-2">Invalid Reset Link</h2>
            <p className="text-dark-text-muted mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary w-full"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-dark-text mb-2">Password Set Successfully!</h2>
            <p className="text-dark-text-muted mb-6">
              Redirecting you to login...
            </p>
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-8 border-b border-dark-border">
          {invitation ? (
            <>
              {/* Personalized Welcome */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <UserCircle size={32} className="text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-dark-text mb-2">
                  Welcome{invitation.metadata?.inviteeName ? `, ${invitation.metadata.inviteeName}` : ''}!
                </h2>
                <p className="text-dark-text-muted">
                  You've been invited to join <strong className="text-dark-text">{invitation.organizationName}</strong>
                </p>
              </div>

              {/* Invitation Details */}
              <div className="bg-dark-bg rounded-lg p-4 space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 size={16} className="text-dark-text-muted flex-shrink-0" />
                  <span className="text-dark-text-muted">Organization:</span>
                  <span className="text-dark-text font-medium">{invitation.organizationName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <UserCircle size={16} className="text-dark-text-muted flex-shrink-0" />
                  <span className="text-dark-text-muted">Role:</span>
                  <span className="text-dark-text font-medium capitalize">{invitation.role}</span>
                </div>
                {invitation.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 size={16} className="text-dark-text-muted flex-shrink-0" />
                    <span className="text-dark-text-muted">Department:</span>
                    <span className="text-dark-text font-medium">{invitation.department}</span>
                  </div>
                )}
              </div>

              <p className="text-center text-sm text-dark-text-muted">
                Set your password to get started
              </p>
            </>
          ) : (
            <>
              {/* Default Header (no invitation found) */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Lock size={20} className="text-primary" />
                </div>
                <h2 className="text-2xl font-semibold text-dark-text">Set Your Password</h2>
              </div>
              <p className="text-dark-text-muted">
                Create a secure password for <strong className="text-dark-text">{email}</strong>
              </p>
            </>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-dark-text mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                className="input w-full pl-10 pr-10"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-text-muted hover:text-dark-text transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-dark-text-muted">Password Strength:</span>
                  <span className={`text-xs font-medium ${passwordStrength.color}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="h-1.5 bg-dark-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passwordStrength.score <= 2
                        ? 'bg-red-500'
                        : passwordStrength.score <= 4
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-dark-text-muted mt-2">
                  Use 8+ characters with a mix of uppercase, lowercase, numbers, and symbols
                </p>
              </div>
            )}
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
                placeholder="Confirm your new password"
                className="input w-full pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-text-muted hover:text-dark-text transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-400 mt-2">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !password || !confirmPassword || password !== confirmPassword}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Setting Password...
              </>
            ) : (
              <>
                <Lock size={18} />
                Set Password
              </>
            )}
          </button>

          {/* Back to Login */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
