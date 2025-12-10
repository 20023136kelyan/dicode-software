import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Target } from 'lucide-react';

interface HeroStat {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

type HeroGradient = 'blue' | 'purple' | 'orange';

interface HeroCardProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  level?: number;
  xpCurrent?: number;
  xpToNext?: number;
  stats?: HeroStat[];
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  background?: HeroGradient;
}

const gradients: Record<HeroGradient, string> = {
  blue: 'from-[#60A5FA] via-[#3B82F6] to-[#2563EB]',
  purple: 'from-[#A78BFA] via-[#8B5CF6] to-[#7C3AED]',
  orange: 'from-[#FDBA74] via-[#F97316] to-[#EA580C]',
};

const HeroCard: React.FC<HeroCardProps> = ({
  eyebrow,
  title,
  subtitle,
  level = 1,
  xpCurrent = 0,
  xpToNext = 100,
  stats = [],
  primaryActionLabel = 'Continue',
  onPrimaryAction,
  background = 'blue',
}) => {
  const xpPercent = Math.min(Math.round((xpCurrent / (xpToNext || 1)) * 100), 100);
  const xpRemaining = Math.max(xpToNext - xpCurrent, 0);

  return (
    <motion.div
      className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-card-lg bg-gradient-to-br ${gradients[background]}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Decorative elements */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/20 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute top-6 right-6 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />

      <div className="relative z-10 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{eyebrow}</p>
            <h1 className="text-3xl font-bold leading-tight mt-1">{title}</h1>
            {subtitle && <p className="text-white/70 text-sm mt-1">{subtitle}</p>}
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex flex-col items-center justify-center shadow-soft">
            <span className="text-xs font-medium text-white/80">Level</span>
            <span className="text-2xl font-bold text-white">{level}</span>
          </div>
        </div>

        {/* XP progress */}
        <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center gap-2 text-white/90 text-sm mb-3">
            <Sparkles size={16} />
            <span className="font-medium">Next level in {xpRemaining} XP</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${xpPercent}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {stats.map((stat, index) => (
              <div
                key={`${stat.label}-${index}`}
                className="rounded-2xl bg-white/15 backdrop-blur-sm px-3 py-3 text-center"
              >
                <div className="flex items-center justify-center gap-1 text-xs text-white/70 mb-1">
                  {stat.icon}
                </div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs text-white/70 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        {onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-semibold text-gray-800 hover:bg-white/90 transition-colors shadow-soft"
          >
            <Target size={18} />
            {primaryActionLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default HeroCard;
