import React, { useState, useEffect } from 'react';
import { X, Copy, Check, UserPlus, Mail, Users, Building2 } from 'lucide-react';
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
      // Reset form when panel closes
      setTimeout(() => {
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
      }, 300); // Wait for close animation
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

  const handleInviteAnother = () => {
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
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-card border-l border-dark-border shadow-2xl z-50 overflow-y-auto transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-text">
                {step === 'form' ? 'Invite Team Member' : 'Invitation Created!'}
              </h2>
              <p className="text-sm text-dark-text-muted">
                {step === 'form' ? 'Send an invitation to join' : 'Share the link below'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-bg transition"
          >
            <X className="h-5 w-5 text-dark-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
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
                <p className="text-xs text-dark-text-muted mt-1.5">
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
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      formData.role === 'employee'
                        ? 'border-primary bg-primary/10'
                        : 'border-dark-border bg-dark-bg hover:border-dark-border/80'
                    }`}
                  >
                    <Users className={`h-5 w-5 mb-2 ${formData.role === 'employee' ? 'text-primary' : 'text-dark-text-muted'}`} />
                    <div className={`text-sm font-medium ${formData.role === 'employee' ? 'text-dark-text' : 'text-dark-text-muted'}`}>
                      Employee
                    </div>
                    <div className="text-xs text-dark-text-muted mt-0.5">Standard access</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      formData.role === 'admin'
                        ? 'border-primary bg-primary/10'
                        : 'border-dark-border bg-dark-bg hover:border-dark-border/80'
                    }`}
                  >
                    <Building2 className={`h-5 w-5 mb-2 ${formData.role === 'admin' ? 'text-primary' : 'text-dark-text-muted'}`} />
                    <div className={`text-sm font-medium ${formData.role === 'admin' ? 'text-dark-text' : 'text-dark-text-muted'}`}>
                      Admin
                    </div>
                    <div className="text-xs text-dark-text-muted mt-0.5">Full control</div>
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
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cohorts.map((cohort) => (
                      <label
                        key={cohort.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          formData.cohortIds.includes(cohort.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-dark-border hover:bg-dark-bg'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.cohortIds.includes(cohort.id)}
                          onChange={() => handleToggleCohort(cohort.id)}
                          className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-primary checked:border-primary"
                        />
                        <span className="text-sm text-dark-text">{cohort.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-dark-border">
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
                      Send Invite
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-emerald-500" />
                </div>
                <p className="text-dark-text mb-2">
                  Account created for <strong className="text-primary">{formData.email}</strong>
                </p>
                <p className="text-sm text-dark-text-muted">
                  An email with the password setup link has been sent.
                </p>
              </div>

              {/* Password Setup Link - Highlighted */}
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <label className="block text-sm font-medium text-dark-text mb-2">
                  🔐 Password Setup Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={passwordResetLink}
                    readOnly
                    className="input flex-1 bg-dark-bg font-mono text-xs"
                  />
                  <button
                    onClick={handleCopyPasswordLink}
                    className="btn-primary flex items-center gap-2 px-3"
                  >
                    {copiedPasswordLink ? (
                      <Check size={16} />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-primary mt-2">
                  Share this link if the email doesn't arrive
                </p>
              </div>

              {/* Invite Link */}
              <div className="rounded-xl border border-dark-border bg-dark-bg p-4">
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Invitation Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteLink}
                    readOnly
                    className="input flex-1 bg-dark-card font-mono text-xs"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="btn-secondary flex items-center gap-2 px-3"
                  >
                    {copied ? (
                      <Check size={16} />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-dark-text-muted mt-2">
                  Expires in 7 days
                </p>
              </div>

              {/* Invitation Details */}
              <div className="rounded-xl border border-dark-border p-4 space-y-3">
                <h3 className="text-sm font-medium text-dark-text">Invitation Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-text-muted">Email</span>
                    <span className="text-dark-text font-medium">{formData.email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-text-muted">Role</span>
                    <span className="text-dark-text font-medium capitalize">{formData.role}</span>
                  </div>
                  {formData.department && (
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-text-muted">Department</span>
                      <span className="text-dark-text font-medium">{formData.department}</span>
                    </div>
                  )}
                  {formData.cohortIds.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-text-muted">Cohorts</span>
                      <span className="text-dark-text font-medium">
                        {formData.cohortIds.length} assigned
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-dark-border">
                <button
                  onClick={handleInviteAnother}
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
    </>
  );
};

export default InviteModal;
