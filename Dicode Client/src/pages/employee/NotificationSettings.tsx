import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bell, Mail, Zap, Trophy, Calendar, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { upsertUserProfile } from '@/lib/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

interface NotificationPreferences {
  campaignReminders: boolean;
  newCampaigns: boolean;
  streakAlerts: boolean;
  badgeNotifications: boolean;
  emailDigest: boolean;
}

const defaultPreferences: NotificationPreferences = {
  campaignReminders: true,
  newCampaigns: true,
  streakAlerts: true,
  badgeNotifications: true,
  emailDigest: false,
};

const NotificationSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);

  // Load preferences from Firestore
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.notificationPreferences) {
            setPreferences({
              ...defaultPreferences,
              ...data.notificationPreferences,
            });
          }
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id]);

  const toggleSetting = async (key: keyof NotificationPreferences) => {
    if (!user?.id || isSaving) return;

    const newValue = !preferences[key];
    const newPreferences = { ...preferences, [key]: newValue };

    // Optimistic update
    setPreferences(newPreferences);
    setIsSaving(true);

    try {
      await upsertUserProfile(user.id, {
        notificationPreferences: newPreferences,
      });

      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 1500);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      // Revert on error
      setPreferences(preferences);
      setSaveMessage('Failed to save');
      setTimeout(() => setSaveMessage(''), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const settings = [
    {
      key: 'campaignReminders' as const,
      title: 'Campaign Reminders',
      description: 'Get reminded about incomplete campaigns',
      icon: <Calendar size={20} className="text-orange-400" />,
    },
    {
      key: 'newCampaigns' as const,
      title: 'New Campaigns',
      description: 'Be notified when new campaigns are available',
      icon: <Bell size={20} className="text-blue-400" />,
    },
    {
      key: 'streakAlerts' as const,
      title: 'Streak Alerts',
      description: 'Get alerts when your streak is at risk',
      icon: <Zap size={20} className="text-yellow-400" />,
    },
    {
      key: 'badgeNotifications' as const,
      title: 'Badge Notifications',
      description: 'Celebrate when you earn new badges',
      icon: <Trophy size={20} className="text-purple-400" />,
    },
    {
      key: 'emailDigest' as const,
      title: 'Weekly Email Digest',
      description: 'Receive a weekly summary of your progress',
      icon: <Mail size={20} className="text-green-400" />,
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="text-white/50 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="hidden lg:block">
        <div className="min-h-screen bg-[#050608] flex items-center justify-center">
          <p className="text-white/50">Redirecting to profile...</p>
          {/* Effect to redirect */}
          <RedirectToProfile section="notifications" />
        </div>
      </div>

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
            <h1 className="text-lg font-semibold text-white">Notifications</h1>
            <div className="w-10" />
          </div>
        </header>

        {/* Save Message */}
        {saveMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${saveMessage === 'Saved'
              ? 'bg-green-500/90 text-white'
              : 'bg-red-500/90 text-white'
              }`}
          >
            <Check size={16} />
            {saveMessage}
          </motion.div>
        )}

        {/* Content */}
        <div className="px-4 py-6 space-y-4">
          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1a1a] rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#00A3FF]/20 rounded-full flex items-center justify-center">
                <Bell size={20} className="text-[#00A3FF]" />
              </div>
              <div>
                <h2 className="text-white font-medium">Stay Updated</h2>
                <p className="text-white/50 text-sm">Manage how you receive notifications</p>
              </div>
            </div>
          </motion.div>

          {/* Settings List */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#1a1a1a] rounded-2xl overflow-hidden"
          >
            {settings.map((setting, index) => (
              <div
                key={setting.key}
                className={`flex items-center justify-between p-4 ${index < settings.length - 1 ? 'border-b border-white/5' : ''
                  }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                    {setting.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium">{setting.title}</h3>
                    <p className="text-white/50 text-sm truncate">{setting.description}</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => toggleSetting(setting.key)}
                  disabled={isSaving}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${preferences[setting.key] ? 'bg-[#00A3FF]' : 'bg-white/20'
                    } ${isSaving ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${preferences[setting.key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>
            ))}
          </motion.div>

          {/* Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white/30 text-xs text-center px-4"
          >
            Your preferences are saved automatically. Email notifications may take up to 24 hours to take effect.
          </motion.p>
        </div>
      </div>
    </>
  );
};

export default NotificationSettings;
