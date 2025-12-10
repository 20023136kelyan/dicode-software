import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Trophy, Flame, Zap, Award } from 'lucide-react';
import Button from '../shared/Button';

type CelebrationType = 'level-up' | 'badge' | 'streak' | 'challenge' | 'xp-bonus';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: CelebrationType;
  title: string;
  subtitle?: string;
  details?: string;
  xpEarned?: number;
  badgeEmoji?: string;
  newLevel?: number;
  streakDays?: number;
}

const CelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  subtitle,
  details,
  xpEarned,
  badgeEmoji,
  newLevel,
  streakDays,
}) => {
  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'level-up':
        return <Star size={40} className="text-accent" fill="currentColor" />;
      case 'badge':
        return badgeEmoji ? (
          <span className="text-4xl">{badgeEmoji}</span>
        ) : (
          <Award size={40} className="text-accent" />
        );
      case 'streak':
        return <Flame size={40} className="text-streak" fill="currentColor" />;
      case 'challenge':
        return <Trophy size={40} className="text-accent" fill="currentColor" />;
      case 'xp-bonus':
        return <Zap size={40} className="text-accent" fill="currentColor" />;
      default:
        return <Star size={40} className="text-accent" fill="currentColor" />;
    }
  };

  const getGradient = () => {
    switch (type) {
      case 'level-up':
        return 'from-accent/20 via-primary/20 to-accent/20';
      case 'badge':
        return 'from-primary/20 via-accent/20 to-primary/20';
      case 'streak':
        return 'from-streak/20 via-orange-500/20 to-streak/20';
      case 'challenge':
        return 'from-accent/20 via-yellow-500/20 to-accent/20';
      case 'xp-bonus':
        return 'from-success/20 via-accent/20 to-success/20';
      default:
        return 'from-primary/20 via-accent/20 to-primary/20';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div className={`
              relative w-full max-w-sm rounded-3xl overflow-hidden
              bg-gradient-to-br ${getGradient()}
              border border-white/10 shadow-2xl
            `}>
              {/* Background particles */}
              <div className="absolute inset-0 overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-white/30"
                    initial={{
                      x: Math.random() * 300,
                      y: 400,
                      scale: 0,
                    }}
                    animate={{
                      y: -50,
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      repeat: Infinity,
                      delay: Math.random() * 2,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>

              {/* Content */}
              <div className="relative p-8 text-center">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X size={18} className="text-light-text-muted" />
                </button>

                {/* Icon with animation */}
                <motion.div
                  className="mb-6 inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-lg"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                >
                  {getIcon()}
                </motion.div>

                {/* Title */}
                <motion.h2
                  className="text-2xl font-bold text-light-text mb-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {title}
                </motion.h2>

                {/* Level/Streak display */}
                {type === 'level-up' && newLevel && (
                  <motion.div
                    className="text-5xl font-black text-accent mb-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.3 }}
                  >
                    Level {newLevel}
                  </motion.div>
                )}

                {type === 'streak' && streakDays && (
                  <motion.div
                    className="text-5xl font-black text-streak mb-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.3 }}
                  >
                    {streakDays} Days
                  </motion.div>
                )}

                {/* Subtitle */}
                {subtitle && (
                  <motion.p
                    className="text-light-text-secondary mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {subtitle}
                  </motion.p>
                )}

                {/* XP Earned */}
                {xpEarned && (
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 mb-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Zap size={18} className="text-accent" />
                    <span className="font-bold text-accent">+{xpEarned} XP</span>
                  </motion.div>
                )}

                {/* Details */}
                {details && (
                  <motion.p
                    className="text-sm text-light-text-muted mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    {details}
                  </motion.p>
                )}

                {/* Action button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Button onClick={onClose} size="lg" className="w-full">
                    Awesome!
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CelebrationModal;
