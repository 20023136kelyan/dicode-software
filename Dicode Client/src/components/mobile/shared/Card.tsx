import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  gradient?: 'blue' | 'purple' | 'orange' | 'pink' | 'teal' | 'none';
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  interactive = false,
  gradient = 'none',
  className = '',
  ...props
}) => {
  const baseClasses = 'rounded-2xl overflow-hidden transition-all duration-200';

  const variantClasses = {
    default: 'bg-white border border-light-border shadow-card',
    elevated: 'bg-white shadow-card-hover',
    outlined: 'bg-transparent border border-light-border',
    filled: 'bg-light-bg',
    glass: 'bg-white/80 backdrop-blur-xl border border-light-border/50 shadow-soft',
  };

  const gradientClasses = {
    none: '',
    blue: 'bg-gradient-card-blue border-0 text-white',
    purple: 'bg-gradient-card-purple border-0 text-white',
    orange: 'bg-gradient-card-orange border-0 text-white',
    pink: 'bg-gradient-card-pink border-0 text-white',
    teal: 'bg-gradient-card-teal border-0 text-white',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  const interactiveClasses = interactive
    ? 'cursor-pointer active:scale-[0.98] hover:shadow-card-hover'
    : '';

  const finalVariantClass = gradient !== 'none' ? gradientClasses[gradient] : variantClasses[variant];

  return (
    <motion.div
      className={`${baseClasses} ${finalVariantClass} ${paddingClasses[padding]} ${interactiveClasses} ${className}`}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
