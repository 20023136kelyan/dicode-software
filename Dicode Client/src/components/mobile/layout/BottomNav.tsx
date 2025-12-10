import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, BookOpen, Trophy, User } from 'lucide-react';
import { motion } from 'framer-motion';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/employee/home' },
  { id: 'learn', label: 'Learn', icon: BookOpen, path: '/employee/learn' },
  { id: 'rank', label: 'Rank', icon: Trophy, path: '/employee/rank' },
  { id: 'profile', label: 'You', icon: User, path: '/employee/profile' },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = (): string => {
    const path = location.pathname;
    if (path.includes('/learn') || path.includes('/campaign') || path.includes('/module')) return 'learn';
    if (path.includes('/rank') || path.includes('/achievements')) return 'rank';
    if (path.includes('/profile') || path.includes('/settings')) return 'profile';
    return 'home';
  };

  const activeTab = getActiveTab();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#1a1a1a]/95 backdrop-blur-xl border-t border-white/10" />
      
      {/* Safe area padding for iOS */}
      <div className="relative pb-safe">
        <div className="flex items-center justify-around h-18 px-4 py-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <motion.button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="relative flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
              >
                {/* Active pill background */}
                {isActive && (
                  <motion.div
                    layoutId="navPill"
                    className="absolute inset-0 -mx-2 -my-1 bg-[#00A3FF] rounded-2xl"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                
                {/* Content */}
                <div className={`relative flex items-center gap-2 px-4 py-2.5 ${
                  isActive ? 'text-white' : 'text-white/40'
                }`}>
                  <Icon 
                    size={20} 
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className="transition-all duration-200"
                  />
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-semibold whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
