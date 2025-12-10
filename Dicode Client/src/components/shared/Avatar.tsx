import React, { useState, useEffect } from 'react';
import { User as UserIcon } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  email?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  className?: string;
  alt?: string;
  /** Optional gradient border override */
  gradientBorder?: string;
  /** Force showing initials if no image - defaults to true in unified design */
  showInitials?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  email,
  size = 'md',
  className = '',
  alt = 'User avatar',
  gradientBorder,
  showInitials = true,
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setImageError(false);
  }, [src]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
    xxl: 'w-24 h-24 text-3xl',
  };

  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const renderContent = () => {
    // 1. Try to render image
    if (src && !imageError) {
      return (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      );
    }

    // 2. Fallback to Initials with Gradient
    if (showInitials && (name || email)) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-400 to-violet-500 font-bold text-white">
          {getInitials()}
        </div>
      );
    }

    // 3. Fallback to Icon
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/10 text-white/50">
        <UserIcon className="h-1/2 w-1/2" />
      </div>
    );
  };

  const containerClasses = `${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 ${className}`;

  if (gradientBorder) {
    return (
      <div className={`${variantSizeClasses(size)} rounded-full bg-gradient-to-b ${gradientBorder} p-[2px] flex-shrink-0 ${className}`}>
        <div className="h-full w-full overflow-hidden rounded-full bg-[#1a1a1a]">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {renderContent()}
    </div>
  );
};

// Helper for wrapper size when using border (slightly larger to maintain inner content size or same size)
// For simplicity, we just reuse the size map as the outer container
const variantSizeClasses = (size: keyof typeof Avatar.prototype.props) => {
  // This is just a placeholder if we needed different sizing for borders
  // For now we assume size prop controls the outer dimension
  const map = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    xxl: 'w-24 h-24',
  }
  return map[size as keyof typeof map] || 'w-10 h-10';
};

export default Avatar;
