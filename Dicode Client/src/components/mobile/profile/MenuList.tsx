import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, LucideIcon } from 'lucide-react';
import Card from '../shared/Card';

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  danger?: boolean;
  badge?: string;
}

export interface MenuGroup {
  title?: string;
  items: MenuItem[];
}

interface MenuListProps {
  groups: MenuGroup[];
  className?: string;
}

const MenuList: React.FC<MenuListProps> = ({
  groups,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.title && (
            <p className="text-xs font-semibold uppercase tracking-wider text-light-text-muted mb-2 px-1">
              {group.title}
            </p>
          )}
          <Card padding="none">
            <div className="divide-y divide-light-border">
              {group.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    onClick={item.onClick}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3.5
                      transition-colors duration-200
                      ${item.danger
                        ? 'text-error hover:bg-error/5'
                        : 'text-light-text hover:bg-light-border/30'
                      }
                    `}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`
                      w-9 h-9 rounded-full flex items-center justify-center
                      ${item.danger ? 'bg-error/10' : 'bg-light-border/50'}
                    `}>
                      <Icon size={18} className={item.danger ? 'text-error' : 'text-light-text-secondary'} />
                    </div>
                    <span className="flex-1 text-left font-medium text-sm">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={18} className={item.danger ? 'text-error/50' : 'text-light-text-muted'} />
                  </motion.button>
                );
              })}
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
};

export default MenuList;
