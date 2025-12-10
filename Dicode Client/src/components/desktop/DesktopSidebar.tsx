import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, BookOpen, Trophy, Bot, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export type ActivePage = 'home' | 'learn' | 'rank' | 'profile' | 'badges';

interface DesktopSidebarProps {
  activePage: ActivePage;
  onAICopilotClick?: () => void;
  onHomeClick?: () => void; // Custom home click handler (e.g., for resetting view state)
  isExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
}

const navItems = [
  { id: 'home' as const, icon: Home, label: 'Home', path: '/employee/home' },
  { id: 'learn' as const, icon: BookOpen, label: 'Learn', path: '/employee/learn' },
  { id: 'rank' as const, icon: Trophy, label: 'Rank', path: '/employee/rank' },
];

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activePage,
  onAICopilotClick,
  onHomeClick,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);

  // Use controlled or internal state
  const isExpanded = controlledIsExpanded ?? internalIsExpanded;
  const setIsExpanded = onToggleExpand ?? setInternalIsExpanded;

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.id === 'home' && onHomeClick) {
      onHomeClick();
    } else {
      navigate(item.path);
    }
  };

  return (
    <motion.div
      className="flex-shrink-0 flex flex-col bg-[#050608] border-r border-white/5"
      initial={false}
      animate={{ width: isExpanded ? 180 : 64 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      {/* Logo */}
      <div className="h-16 flex-shrink-0 flex items-center justify-center px-3">
        <img
          src="/dicode_logo.png"
          alt="DiCode"
          className={`transition-all ${isExpanded ? 'h-10' : 'h-9'}`}
        />
      </div>

      {/* Nav Items */}
      <div className={`flex-1 flex flex-col gap-1 py-4 ${isExpanded ? 'px-3' : 'items-center'}`}>
        {navItems.map((item) => {
          const isActive = item.id === activePage;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              className={`h-11 rounded-xl flex items-center gap-3 transition-all ${isExpanded ? 'w-full px-3' : 'w-11 justify-center'
                } ${isActive
                  ? 'bg-[#00A3FF] text-white'
                  : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                }`}
              title={!isExpanded ? item.label : undefined}
            >
              <item.icon size={20} className="flex-shrink-0" />
              {isExpanded && (
                <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className={`flex flex-col gap-1 py-4 border-t border-white/5 ${isExpanded ? 'px-3' : 'items-center'}`}>
        {onAICopilotClick && (
          <button
            onClick={onAICopilotClick}
            className={`h-11 rounded-xl flex items-center gap-3 text-blue-400 hover:bg-blue-500/10 transition-all ${isExpanded ? 'w-full px-3' : 'w-11 justify-center'
              }`}
            title={!isExpanded ? 'AI Copilot' : undefined}
          >
            <Bot size={20} className="flex-shrink-0" />
            {isExpanded && (
              <span className="text-sm font-medium whitespace-nowrap">AI Copilot</span>
            )}
          </button>
        )}
        <button
          onClick={() => logout()}
          className={`h-11 rounded-xl flex items-center gap-3 text-white/40 hover:bg-white/10 hover:text-white/70 transition-all ${isExpanded ? 'w-full px-3' : 'w-11 justify-center'
            }`}
          title={!isExpanded ? 'Sign Out' : undefined}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {isExpanded && (
            <span className="text-sm font-medium whitespace-nowrap">Sign Out</span>
          )}
        </button>

        {/* Expand/Collapse Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`h-11 rounded-xl flex items-center gap-3 text-white/30 hover:bg-white/5 hover:text-white/50 transition-all mt-2 ${isExpanded ? 'w-full px-3' : 'w-11 justify-center'
            }`}
          title={!isExpanded ? 'Expand' : undefined}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronRight size={20} />
          </motion.div>
          {isExpanded && (
            <span className="text-sm font-medium whitespace-nowrap">Collapse</span>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default DesktopSidebar;

