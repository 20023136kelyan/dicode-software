import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Mail,
  BookOpen,
  Trophy,
  Flame,
  Target
} from 'lucide-react';
import ProfileLayout from '@/components/desktop/ProfileLayout';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const faqs: FAQItem[] = [
  {
    id: '1',
    question: 'How do I complete a campaign?',
    answer: 'Watch all videos in the campaign and answer the questions that appear. Once you\'ve completed all videos and questions, the campaign will be marked as complete.',
    icon: <Target size={18} className="text-blue-400" />,
  },
  {
    id: '2',
    question: 'What are streaks and how do they work?',
    answer: 'Streaks track your consecutive days of completing campaigns. Complete at least one campaign per day to maintain your streak. If you miss a day, your streak resets to 0.',
    icon: <Flame size={18} className="text-orange-400" />,
  },
  {
    id: '3',
    question: 'How do I earn badges?',
    answer: 'Badges are earned by reaching milestones like completing your first campaign, maintaining streaks, reaching certain levels, or mastering skills. Keep learning to unlock more badges!',
    icon: <Trophy size={18} className="text-yellow-400" />,
  },
  {
    id: '4',
    question: 'What is XP and how do I level up?',
    answer: 'XP (Experience Points) is earned by completing modules and campaigns. As you accumulate XP, you\'ll level up. Higher streaks give you bonus XP multipliers!',
    icon: <BookOpen size={18} className="text-green-400" />,
  },
  {
    id: '5',
    question: 'How are my skills assessed?',
    answer: 'Your skills are assessed based on your responses to behavioral questions in each video. Consistent good performance will increase your skill levels from 1 to 5.',
    icon: <HelpCircle size={18} className="text-purple-400" />,
  },
];

const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleContactSupport = () => {
    window.location.href = 'mailto:support@di-code.de?subject=Help%20Request';
  };

  return (
    <>
      <div className="hidden lg:block">
        <ProfileLayout>
          <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-white mb-6">Help Center</h1>

            {/* Hero Desktop */}
            <div className="bg-gradient-to-br from-[#00A3FF]/20 to-[#00A3FF]/5 rounded-2xl p-8 text-center border border-[#00A3FF]/20">
              <div className="w-16 h-16 bg-[#00A3FF]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <HelpCircle size={32} className="text-[#00A3FF]" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">How can we help?</h2>
              <p className="text-white/60">
                Find answers to common questions or contact our support team
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* FAQ Section Desktop */}
              <div className="md:col-span-2 space-y-6">
                <h3 className="text-white font-semibold text-lg">
                  Frequently Asked Questions
                </h3>
                <div className="space-y-3">
                  {faqs.map((faq) => (
                    <div
                      key={faq.id}
                      className="bg-[#090909] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors"
                    >
                      <button
                        onClick={() => toggleFAQ(faq.id)}
                        className="w-full flex items-center justify-between p-5 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                            {faq.icon}
                          </div>
                          <span className="text-white font-medium pr-4">
                            {faq.question}
                          </span>
                        </div>
                        <ChevronDown
                          size={20}
                          className={`text-white/50 transition-transform duration-200 ${expandedId === faq.id ? 'rotate-180' : ''
                            }`}
                        />
                      </button>

                      <AnimatePresence>
                        {expandedId === faq.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-0">
                              <p className="text-white/60 leading-relaxed pl-14">
                                {faq.answer}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Section Desktop */}
              <div className="space-y-6">
                <h3 className="text-white font-semibold text-lg">Still need help?</h3>
                <div className="space-y-4">
                  <button
                    onClick={handleContactSupport}
                    className="w-full bg-[#090909] border border-white/5 hover:border-white/20 rounded-2xl p-5 flex flex-col items-center text-center gap-3 transition-all group"
                  >
                    <div className="w-12 h-12 bg-[#00A3FF]/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Mail size={24} className="text-[#00A3FF]" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">Email Support</h4>
                      <p className="text-white/50 text-sm mt-1">support@di-code.de</p>
                    </div>
                  </button>

                  <button
                    onClick={() => window.open('https://di-code.de', '_blank')}
                    className="w-full bg-[#090909] border border-white/5 hover:border-white/20 rounded-2xl p-5 flex flex-col items-center text-center gap-3 transition-all group"
                  >
                    <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle size={24} className="text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium">Visit Website</h4>
                      <p className="text-white/50 text-sm mt-1">di-code.de</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <p className="text-white/20 text-xs text-center pt-8">
              DiCode App v1.0.0
            </p>
          </div>
        </ProfileLayout>
      </div>

      <div className="lg:hidden min-h-screen bg-black pb-24">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-white" />
            </button>
            <h1 className="text-lg font-semibold text-white">Help Center</h1>
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
              <HelpCircle size={32} className="text-[#00A3FF]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">How can we help?</h2>
            <p className="text-white/60 text-sm">
              Find answers to common questions or contact our support team
            </p>
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-white font-semibold mb-3 px-1">
              Frequently Asked Questions
            </h3>
            <div className="space-y-2">
              {faqs.map((faq, index) => (
                <motion.div
                  key={faq.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  className="bg-[#1a1a1a] rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleFAQ(faq.id)}
                    className="w-full flex items-center justify-between p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
                        {faq.icon}
                      </div>
                      <span className="text-white font-medium text-sm pr-2">
                        {faq.question}
                      </span>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedId === faq.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown size={20} className="text-white/50" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {expandedId === faq.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0">
                          <p className="text-white/60 text-sm leading-relaxed pl-12">
                            {faq.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h3 className="text-white font-semibold px-1">Still need help?</h3>

            <button
              onClick={handleContactSupport}
              className="w-full bg-[#1a1a1a] hover:bg-[#252525] rounded-2xl p-4 flex items-center gap-4 transition-colors"
            >
              <div className="w-12 h-12 bg-[#00A3FF]/20 rounded-xl flex items-center justify-center">
                <Mail size={24} className="text-[#00A3FF]" />
              </div>
              <div className="text-left">
                <h4 className="text-white font-medium">Email Support</h4>
                <p className="text-white/50 text-sm">support@di-code.de</p>
              </div>
            </button>

            <button
              onClick={() => window.open('https://di-code.de', '_blank')}
              className="w-full bg-[#1a1a1a] hover:bg-[#252525] rounded-2xl p-4 flex items-center gap-4 transition-colors"
            >
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <MessageCircle size={24} className="text-purple-400" />
              </div>
              <div className="text-left">
                <h4 className="text-white font-medium">Visit Our Website</h4>
                <p className="text-white/50 text-sm">di-code.de</p>
              </div>
            </button>
          </motion.div>

          {/* Version Info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white/30 text-xs text-center pt-4"
          >
            DiCode App v1.0.0
          </motion.p>
        </div>
      </div>
    </>
  );
};

export default HelpCenter;

