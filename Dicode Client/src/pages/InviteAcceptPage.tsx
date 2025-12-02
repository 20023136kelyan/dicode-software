import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, Mail, Briefcase, CheckCircle, XCircle, Loader, KeyRound } from 'lucide-react';
import { getInvitationByToken } from '@/lib/firestore';
import type { Invitation } from '@/types';

const InviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setIsLoading(false);
        return;
      }

      try {
        const invite = await getInvitationByToken(token);

        if (!invite) {
          setError('Invitation not found');
        } else if (invite.status === 'expired') {
          setError('This invitation has expired. Please contact your administrator for a new invitation.');
        } else if (invite.status === 'accepted') {
          setError('This invitation has already been used.');
        } else {
          setInvitation(invite);
        }
      } catch (err: any) {
        console.error('[InviteAcceptPage] Failed to load invitation:', err);
        setError('Failed to load invitation. Please contact your administrator.');
      } finally {
        setIsLoading(false);
      }
    };

    loadInvitation();
  }, [token]);

  const handleSetPassword = () => {
    if (invitation?.passwordResetLink) {
      // Redirect to Firebase password reset page
      window.location.href = invitation.passwordResetLink;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg text-dark-text flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-dark-text-muted">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-dark-bg text-dark-text flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-dark-card rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-dark-text mb-2">Invitation Error</h1>
          <p className="text-dark-text-muted mb-6">{error}</p>
          <a
            href="/login"
            className="btn-secondary inline-block"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (!invitation.passwordResetLink) {
    return (
      <div className="min-h-screen bg-dark-bg text-dark-text flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-dark-card rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-dark-text mb-2">Setup Link Missing</h1>
          <p className="text-dark-text-muted mb-6">
            This invitation is missing the password setup link. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-dark-card rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 size={32} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-dark-text mb-2">
              Welcome to {invitation.organizationName}!
            </h1>
            <p className="text-dark-text-muted">
              You're invited to join the team
            </p>
          </div>

          {/* Invitation Details */}
          <div className="bg-dark-bg rounded-lg p-4 mb-6 space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-dark-text-muted" />
              <span className="text-dark-text">{invitation.email}</span>
            </div>
            {invitation.department && (
              <div className="flex items-center gap-3 text-sm">
                <Briefcase size={16} className="text-dark-text-muted" />
                <span className="text-dark-text">{invitation.department}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle size={16} className="text-dark-text-muted" />
              <span className="text-dark-text capitalize">{invitation.role} role</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-dark-text mb-3">
              <strong>Next steps:</strong>
            </p>
            <ol className="text-sm text-dark-text-muted space-y-2 list-decimal list-inside">
              <li>Click the button below to set your password</li>
              <li>Create a secure password for your account</li>
              <li>Log in and complete your profile</li>
            </ol>
          </div>

          {/* Set Password Button */}
          <button
            onClick={handleSetPassword}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <KeyRound size={20} />
            Set Your Password & Get Started
          </button>

          {/* Footer */}
          <p className="text-xs text-center text-dark-text-muted mt-6">
            After setting your password, you'll be able to log in and start your onboarding.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;
