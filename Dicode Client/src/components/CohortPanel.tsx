import React, { useState, useEffect } from 'react';
import { X, Users, FolderPlus } from 'lucide-react';

interface CohortPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
}

const CohortPanel: React.FC<CohortPanelProps> = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset after close animation
      setTimeout(() => {
        setFormData({ name: '', description: '' });
        setError(null);
        setIsSubmitting(false);
      }, 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Cohort name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to create cohort');
    } finally {
      setIsSubmitting(false);
    }
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
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-card border-l border-dark-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-text">Create Cohort</h2>
              <p className="text-sm text-dark-text-muted">Group employees together</p>
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
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-dark-text mb-1">What are Cohorts?</h4>
                  <p className="text-sm text-dark-text-muted">
                    Cohorts help you organize employees into groups for targeted campaigns, training programs, and analytics.
                  </p>
                </div>
              </div>
            </div>

            {/* Cohort Name */}
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">
                Cohort Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Q1 2024 New Hires"
                className="input w-full"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-dark-text mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this cohort..."
                rows={4}
                className="input w-full resize-none"
              />
              <p className="text-xs text-dark-text-muted mt-1.5">
                Help others understand the purpose of this cohort
              </p>
            </div>

            {/* Tips */}
            <div className="rounded-xl bg-dark-bg p-4">
              <h4 className="text-sm font-medium text-dark-text mb-2">💡 Tips</h4>
              <ul className="text-sm text-dark-text-muted space-y-1.5">
                <li>• Use descriptive names like "Engineering Team" or "Leadership Training"</li>
                <li>• You can assign employees to cohorts after creation</li>
                <li>• Cohorts can be used to target specific groups in campaigns</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-dark-border px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus size={16} />
                  Create Cohort
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CohortPanel;

