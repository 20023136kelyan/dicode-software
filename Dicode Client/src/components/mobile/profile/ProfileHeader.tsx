import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Edit2 } from 'lucide-react';
import Avatar from '@/components/shared/Avatar';

interface ProfileHeaderProps {
  name: string;
  email?: string;
  department?: string;
  avatar?: string;
  onSettingsClick?: () => void;
  onEditClick?: () => void;
  className?: string;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  name,
  email,
  department,
  avatar,
  onSettingsClick,
  onEditClick,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* Background gradient */}
      <div className="absolute inset-0 h-32 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 rounded-b-3xl" />

      {/* Content */}
      <div className="relative pt-4 px-4 pb-6">
        {/* Actions */}
        <div className="flex justify-end gap-2 mb-4">
          {onEditClick && (
            <motion.button
              onClick={onEditClick}
              className="w-10 h-10 rounded-full bg-light-card/80 backdrop-blur-sm border border-light-border flex items-center justify-center"
              whileTap={{ scale: 0.95 }}
            >
              <Edit2 size={18} className="text-light-text-secondary" />
            </motion.button>
          )}
          {onSettingsClick && (
            <motion.button
              onClick={onSettingsClick}
              className="w-10 h-10 rounded-full bg-light-card/80 backdrop-blur-sm border border-light-border flex items-center justify-center"
              whileTap={{ scale: 0.95 }}
            >
              <Settings size={18} className="text-light-text-secondary" />
            </motion.button>
          )}
        </div>

        {/* Avatar & Info */}
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <Avatar
              src={avatar}
              name={name}
              email={email}
              size="xxl"
              className="w-24 h-24 border-4 border-light-bg shadow-lg text-3xl"
            />
          </motion.div>

          {/* Name */}
          <motion.h1
            className="mt-3 text-xl font-bold text-light-text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {name}
          </motion.h1>

          {/* Department */}
          {department && (
            <motion.p
              className="text-sm text-light-text-secondary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              {department}
            </motion.p>
          )}

          {/* Email */}
          {email && (
            <motion.p
              className="text-xs text-light-text-muted mt-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {email}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
