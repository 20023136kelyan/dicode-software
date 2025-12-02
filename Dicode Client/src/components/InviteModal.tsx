import React, { useState, useEffect } from 'react';
import { X, Copy, Check, UserPlus, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createInvitation, checkPendingInvitation, getOrganization } from '@/lib/firestore';
import type { UserRole } from '@/types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: string[];
  cohorts?: Array<{ id: string; name: string }>;
}

const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, departments, cohorts = [] }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [passwordResetLink, setPasswordResetLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedPasswordLink, setCopiedPasswordLink] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'employee' as UserRole,
    department: '',
    cohortIds: [] as string[],
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setStep('form');
      setFormData({
        email: '',
        name: '',
        role: 'employee',
        department: '',
        cohortIds: [],
      });
      setError(null);
      setInviteLink('');
      setPasswordResetLink('');
      setCopied(false);
      setCopiedPasswordLink(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user?.organization) {
      setError('No organization found');
      return;
    }

    // Validate email
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Invalid email format');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if user already has a pending invitation
      const existingInvite = await checkPendingInvitation(formData.email, user.organization);
      if (existingInvite) {
        setError('This email already has a pending invitation');
        setIsSubmitting(false);
        return;
      }

      // Get organization name for the invitation
      const org = await getOrganization(user.organization);
      if (!org) {
        setError('Organization not found');
        setIsSubmitting(false);
        return;
      }

      // Create invitation (returns invitationId and passwordResetLink)
      const { invitationId, passwordResetLink } = await createInvitation({
        organizationId: user.organization,
        organizationName: org.name,
        email: formData.email.trim(),
        role: formData.role,
        department: formData.department || undefined,
        cohortIds: formData.cohortIds.length > 0 ? formData.cohortIds : undefined,
        invitedBy: user.id,
        inviteeName: formData.name.trim() || undefined,
      });

      // Store the password reset link
      setPasswordResetLink(passwordResetLink);

      // Get the invitation to retrieve the token
      const { getInvitation } = await import('@/lib/firestore');
      const invitation = await getInvitation(invitationId);

      if (invitation) {
        // Generate invite link
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/invite/${invitation.token}`;
        setInviteLink(link);
        setStep('success');
      }
    } catch (err) {
      console.error('[InviteModal] Failed to create invitation:', err);
      setError((err as Error).message || 'Failed to create invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[InviteModal] Failed to copy link:', err);
    }
  };

  const handleCopyPasswordLink = async () => {
    try {
      await navigator.clipboard.writeText(passwordResetLink);
      setCopiedPasswordLink(true);
      setTimeout(() => setCopiedPasswordLink(false), 2000);
    } catch (err) {
      console.error('[InviteModal] Failed to copy password reset link:', err);
    }
  };

  const handleToggleCohort = (cohortId: string) => {
    setFormData(prev => ({
      ...prev,
      cohortIds: prev.cohortIds.includes(cohortId)
        ? prev.cohortIds.filter(id => id !== cohortId)
        : [...prev.cohortIds, cohortId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-text">
                {step === 'form' ? 'Invite Team Member' : 'Invitation Created!'}
              </h2>
              <p className="text-sm text-dark-text-muted">
                {step === 'form'
                  ? 'Send an invitation to join your organization'
                  : 'Share the invite link below'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
          >
            <X size={20} className="text-dark-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="colleague@company.com"
                    className="input w-full pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Full Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="input w-full"
                />
                <p className="text-xs text-dark-text-muted mt-1">
                  Pre-fill the name for a better experience
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Role *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'employee' })}
                    className={`p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.role === 'employee'
                        ? 'border-primary bg-primary/10 text-dark-text'
                        : 'border-dark-border bg-dark-card text-dark-text-muted hover:border-primary/50'
                    }`}
                  >
                    <div className="text-sm font-medium">Employee</div>
                    <div className="text-xs text-dark-text-muted mt-1">Standard access</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                    className={`p-3 rounded-lg border-2 transition-colors text-left ${
                      formData.role === 'admin'
                        ? 'border-primary bg-primary/10 text-dark-text'
                        : 'border-dark-border bg-dark-card text-dark-text-muted hover:border-primary/50'
                    }`}
                  >
                    <div className="text-sm font-medium">Admin</div>
                    <div className="text-xs text-dark-text-muted mt-1">Full control</div>
                  </button>
                </div>
              </div>

              {/* Department */}
              {departments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Department (optional)
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Select department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cohorts */}
              {cohorts.length > 0 && formData.role === 'employee' && (
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Assign to Cohorts (optional)
                  </label>
                  <div className="space-y-2">
                    {cohorts.map((cohort) => (
                      <label
                        key={cohort.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-dark-border hover:bg-dark-bg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.cohortIds.includes(cohort.id)}
                          onChange={() => handleToggleCohort(cohort.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-dark-text">{cohort.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Create Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-500" />
                </div>
                <p className="text-dark-text mb-2">
                  Account created for <strong>{formData.email}</strong>
                </p>
                <p className="text-sm text-dark-text-muted">
                  An email with the password setup link has been sent.
                </p>
                <p className="text-sm text-dark-text-muted mt-1">
                  Share the link below if the email doesn't arrive.
                </p>
              </div>

              {/* Password Setup Link - Highlighted */}
              <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-lg p-4">
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Password Setup Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={passwordResetLink}
                    readOnly
                    className="input flex-1 bg-dark-card font-mono text-sm"
                  />
                  <button
                    onClick={handleCopyPasswordLink}
                    className="btn-primary flex items-center gap-2 px-4"
                  >
                    {copiedPasswordLink ? (
                      <>
                        <Check size={18} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                  📧 The user should click this link to set their password before logging in.
                </p>
              </div>

              {/* Invite Link */}
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Invitation Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="input flex-1 bg-dark-bg font-mono text-sm"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="btn-primary flex items-center gap-2 px-4"
                  >
                    {copied ? (
                      <>
                        <Check size={18} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-dark-text-muted mt-2">
                  This link expires in 7 days
                </p>
              </div>

              {/* Invitation Details */}
              <div className="bg-dark-bg rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-dark-text-muted">Email:</span>
                  <span className="text-dark-text font-medium">{formData.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-text-muted">Role:</span>
                  <span className="text-dark-text font-medium capitalize">{formData.role}</span>
                </div>
                {formData.department && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-text-muted">Department:</span>
                    <span className="text-dark-text font-medium">{formData.department}</span>
                  </div>
                )}
                {formData.cohortIds.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-text-muted">Cohorts:</span>
                    <span className="text-dark-text font-medium">
                      {formData.cohortIds.length} assigned
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('form');
                    setFormData({
                      email: '',
                      name: '',
                      role: 'employee',
                      department: '',
                      cohortIds: [],
                    });
                    setInviteLink('');
                    setPasswordResetLink('');
                    setCopied(false);
                    setCopiedPasswordLink(false);
                  }}
                  className="btn-secondary flex-1"
                >
                  Invite Another
                </button>
                <button onClick={onClose} className="btn-primary flex-1">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
