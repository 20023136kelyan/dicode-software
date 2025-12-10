import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Database, Eye, Lock, Users, ChevronDown, CheckCircle2 } from 'lucide-react';
import ProfileLayout from '@/components/desktop/ProfileLayout';

interface PrivacyPolicyProps {
  onAccept?: () => void;
  isPublic?: boolean;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onAccept, isPublic = true }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General Policy' },
    { id: 'usage', label: 'Data Usage' },
    { id: 'security', label: 'Security' },
    { id: 'rights', label: 'Your Rights' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">About DiCode Client</h3>
              <p className="text-white/60 text-sm leading-relaxed">
                At DiCode, we believe talent management should be transparent and secure. We are thorough in our approach to protect users' data to bring you a safe environment for your professional growth. Let us help you make your career development a reality!
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-white font-medium">Key Data We Collect</h4>

              <div className="flex gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/[0.07] transition-colors">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Database size={20} className="text-blue-400" />
                </div>
                <div>
                  <h5 className="text-white font-medium text-sm mb-1">Account Information</h5>
                  <p className="text-white/50 text-xs">Name, email, department, and role details.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/[0.07] transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <Shield size={20} className="text-green-400" />
                </div>
                <div>
                  <h5 className="text-white font-medium text-sm mb-1">Learning Progress</h5>
                  <p className="text-white/50 text-xs">Assessment scores, completion rates, and certifications.</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'usage':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">How We Use Your Data</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                We use your data strictly to provide and improve your learning experience. We do not sell your personal data to third parties.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                'To provide personalized learning experiences',
                'To track your progress and achievements',
                'To generate aggregated insights for your organization',
                'To improve our platform and services'
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <Eye size={16} className="text-purple-400 shrink-0" />
                  <span className="text-white/70 text-sm">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 border border-orange-500/20 bg-orange-500/5 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Users size={18} className="text-orange-400" />
                <h4 className="text-orange-400 font-medium text-sm">Data Sharing</h4>
              </div>
              <p className="text-orange-200/60 text-xs">
                Information is only shared with your organization's administrators and authorized service providers under strict confidentiality agreements.
              </p>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Security Measures</h3>
              <div className="grid gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Lock size={20} className="text-cyan-400" />
                    <h4 className="text-white font-medium">Encryption</h4>
                  </div>
                  <p className="text-white/60 text-sm">All data is encrypted in transit (TLS 1.3) and at rest (AES-256).</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield size={20} className="text-emerald-400" />
                    <h4 className="text-white font-medium">Access Control</h4>
                  </div>
                  <p className="text-white/60 text-sm">Strict role-based access control (RBAC) ensures only authorized personnel can access sensitive data.</p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'rights':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Your Privacy Rights</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                You have full control over your personal data. Here are the rights guaranteed to you:
              </p>

              <div className="space-y-2">
                {[
                  'Access your personal data at any time',
                  'Request correction of inaccurate data',
                  'Request deletion of your data (subject to legal retention)',
                  'Export your data in a portable format'
                ].map((right, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-[#F7B500]" />
                    <span className="text-white/80 text-sm">{right}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const isDashboard = location.pathname.startsWith('/employee');

  return (
    <>
      {isDashboard ? (
        // Dashboard View (Authenticated)
        <>
          <div className="hidden lg:block">
            <ProfileLayout>
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
                    <p className="text-white/60 text-sm">How we handle and protect your data</p>
                  </div>
                </div>

                <div className="bg-[#090909] border border-white/5 rounded-2xl overflow-hidden min-h-[600px] flex flex-col">
                  {/* Tabs */}
                  <div className="px-8 border-b border-white/5 flex gap-8 overflow-x-auto scrollbar-hide bg-white/[0.02]">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-4 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.id ? 'text-[#00A3FF]' : 'text-white/40 hover:text-white/70'
                          }`}
                      >
                        {tab.label}
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeDashboardTab"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00A3FF] rounded-full"
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Content */}
                  <div className="p-8 flex-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {renderContent()}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Contact Note */}
                <p className="text-white/30 text-xs text-center">
                  For privacy concerns, contact <a href="mailto:privacy@di-code.de" className="text-[#00A3FF] hover:underline">privacy@di-code.de</a>
                </p>
              </div>
            </ProfileLayout>
          </div>

          {/* Mobile Dashboard View (using existing style but full screen) */}
          <div className="lg:hidden min-h-screen bg-black pb-8">
            <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/10 rounded-full">
                <ChevronDown className="rotate-90 text-white" />
              </button>
              <h1 className="text-lg font-semibold text-white">Privacy Policy</h1>
            </div>

            {/* Tabs Mobile */}
            <div className="px-4 border-b border-white/5 flex gap-6 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.id ? 'text-[#00A3FF]' : 'text-white/40'
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00A3FF] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-4">
              {renderContent()}
            </div>
          </div>
        </>
      ) : (
        // Public / Standalone Modal View
        <div className="min-h-screen bg-[#04060A] flex items-center justify-center p-4 relative overflow-hidden">
          {/* Background Ambience */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.02]" />
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#F7B500]/10 blur-[150px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none" />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl bg-[#0F1115] rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Terms & Privacy Policy</h1>
                <p className="text-white/40 text-sm">DiCode Client covers how we handle your data.</p>
              </div>
              {isPublic && (
                <button
                  onClick={() => navigate('/login')}
                  className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="px-8 border-b border-white/5 flex gap-8 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-4 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.id ? 'text-[#00A3FF]' : 'text-white/40 hover:text-white/70'
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00A3FF] rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>

              {/* Need Help Box */}
              <div className="mt-8 p-6 bg-white/[0.03] rounded-2xl">
                <h4 className="text-white font-medium mb-1">Need Help?</h4>
                <p className="text-white/40 text-xs mb-3">Contact our customer service team for any privacy concerns.</p>
                <a href="mailto:privacy@di-code.de" className="text-[#00A3FF] text-sm hover:underline">
                  support@di-code.de
                </a>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-white/5 bg-[#0F1115] flex justify-center">
              {isPublic ? (
                <button
                  onClick={() => navigate('/login')}
                  className="w-full max-w-sm bg-white/10 hover:bg-white/20 text-white font-semibold py-3.5 rounded-xl transition-all"
                >
                  Back to Login
                </button>
              ) : (
                <button
                  onClick={onAccept}
                  className="w-full max-w-sm bg-[#0055FF] hover:bg-[#0044CC] text-white font-semibold py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(0,85,255,0.2)] hover:shadow-[0_4px_25px_rgba(0,85,255,0.3)] active:scale-[0.98]"
                >
                  Accept & Continue
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default PrivacyPolicy;
