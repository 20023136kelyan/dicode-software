'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Users,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNotification } from '@/contexts/NotificationContext';
import type { Campaign } from '@/lib/types';

interface EmailPanelProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
}

interface EmailNotification {
  id: string;
  type: 'invitation' | 'reminder' | 'completion' | 'manual';
  status: 'pending' | 'sent' | 'failed';
  recipientEmail: string;
  createdAt: string;
  sentAt?: string;
  metadata?: {
    userName?: string;
    manualSend?: boolean;
    sentBy?: string;
  };
}

export default function EmailPanel({ campaign, isOpen, onClose }: EmailPanelProps) {
  const { success: showSuccess, error: showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [emailType, setEmailType] = useState<'invitation' | 'reminder' | 'custom'>('reminder');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadEmailHistory();
    }
  }, [isOpen, campaign.id]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, sending, onClose]);

  const loadEmailHistory = async () => {
    setLoading(true);
    try {
      const functions = getFunctions();
      const getHistory = httpsCallable(functions, 'getEmailHistory');
      const result = await getHistory({ campaignId: campaign.id, limit: 50 });
      const data = result.data as { notifications: EmailNotification[] };
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to load email history:', error);
      // Don't show error toast - just show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (emailType === 'custom' && (!customSubject.trim() || !customMessage.trim())) {
      showError('Missing Fields', 'Please enter both subject and message for custom emails');
      return;
    }

    setSending(true);
    try {
      const functions = getFunctions();
      const sendEmail = httpsCallable(functions, 'sendManualEmail');
      
      const payload: any = {
        campaignId: campaign.id,
        type: emailType,
      };

      if (emailType === 'custom') {
        payload.subject = customSubject;
        payload.message = customMessage;
      }

      const result = await sendEmail(payload);
      const data = result.data as { success: boolean; results: { success: number; failed: number }; message: string };

      if (data.success) {
        showSuccess('Emails Sent', data.message);
        setCustomSubject('');
        setCustomMessage('');
        loadEmailHistory();
      }
    } catch (error: any) {
      console.error('Failed to send emails:', error);
      showError('Send Failed', error.message || 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-rose-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Mail className="h-4 w-4 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'invitation':
        return 'Invitation';
      case 'reminder':
        return 'Reminder';
      case 'completion':
        return 'Completion';
      case 'manual':
        return 'Manual';
      default:
        return type;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Email Management</h2>
              <p className="text-sm text-slate-500">{campaign.title}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Send Email Section */}
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Send Email</h3>
              
              <div className="space-y-4">
                {/* Email Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Type
                  </label>
                  <div className="flex gap-2">
                    {(['invitation', 'reminder', 'custom'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setEmailType(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          emailType === type
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Email Fields */}
                {emailType === 'custom' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Email subject..."
                        className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Message
                      </label>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Email message..."
                        rows={4}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 resize-none"
                      />
                    </div>
                  </>
                )}

                {/* Info */}
                <div className="flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <Users className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div className="text-sm text-slate-600">
                    <p className="font-medium">Recipients</p>
                    <p className="text-slate-500">
                      {emailType === 'invitation'
                        ? 'All enrolled users who haven\'t started'
                        : emailType === 'reminder'
                        ? 'All enrolled users with incomplete progress'
                        : 'All enrolled users'}
                    </p>
                  </div>
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send {emailType.charAt(0).toUpperCase() + emailType.slice(1)} Email
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Email History */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Email History</h3>
                <button
                  onClick={loadEmailHistory}
                  disabled={loading}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 font-medium">No emails sent yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Email history will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white"
                    >
                      {getStatusIcon(notification.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {notification.recipientEmail}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            notification.type === 'invitation'
                              ? 'bg-sky-100 text-sky-700'
                              : notification.type === 'reminder'
                              ? 'bg-amber-100 text-amber-700'
                              : notification.type === 'completion'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {getTypeLabel(notification.type)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {notification.sentAt
                            ? `Sent ${new Date(notification.sentAt).toLocaleString()}`
                            : notification.status === 'pending'
                            ? 'Pending...'
                            : `Created ${new Date(notification.createdAt).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

