import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}) => {
  const baseClasses = 'animate-pulse bg-light-border/60';

  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-card',
  };

  const style: React.CSSProperties = {
    width: width ?? (variant === 'circular' ? height : '100%'),
    height: height ?? (variant === 'text' ? '1rem' : '100%'),
  };

  if (lines > 1 && variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${variantClasses[variant]}`}
            style={{
              ...style,
              width: index === lines - 1 ? '75%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton patterns
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-2xl p-4 border border-light-border shadow-soft ${className}`}>
    <div className="flex items-center gap-3 mb-3">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1">
        <Skeleton variant="text" width="60%" className="mb-2" />
        <Skeleton variant="text" width="40%" height={12} />
      </div>
    </div>
    <Skeleton variant="rounded" height={8} className="mb-2" />
    <Skeleton variant="text" width="30%" height={12} />
  </div>
);

export const ListItemSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-3 p-3 ${className}`}>
    <Skeleton variant="circular" width={40} height={40} />
    <div className="flex-1">
      <Skeleton variant="text" width="70%" className="mb-1" />
      <Skeleton variant="text" width="50%" height={12} />
    </div>
    <Skeleton variant="rounded" width={60} height={24} />
  </div>
);

export const StatsSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex justify-around ${className}`}>
    {[1, 2, 3].map((i) => (
      <div key={i} className="text-center">
        <Skeleton variant="text" width={40} height={24} className="mx-auto mb-1" />
        <Skeleton variant="text" width={60} height={12} className="mx-auto" />
      </div>
    ))}
  </div>
);

export default Skeleton;
