import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-light-text-secondary">{icon}</span>}
        <div>
          <h2 className="text-lg font-semibold text-light-text">{title}</h2>
          {subtitle && (
            <p className="text-sm text-light-text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
        >
          <span>{action.label}</span>
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
};

export default SectionHeader;
