import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BottomNav } from '@/components/mobile';
import { CopilotProvider, useCopilot } from '@/contexts/CopilotContext';
import { GlobalSearchProvider } from '@/contexts/GlobalSearchContext';

const EmployeeLayoutContent: React.FC = () => {
  const location = useLocation();
  const { isOpen: isCopilotOpen } = useCopilot();
  const [showNav, setShowNav] = useState(true);

  // Check for completion screen via URL search param
  const searchParams = new URLSearchParams(location.search);
  const isCompletionScreen = searchParams.get('completion') === 'true';

  // Hide bottom nav on full-screen pages (video module, campaign details, subviews, completion, etc.) or when copilot is open
  const hideBottomNav =
    location.pathname.includes('/module/') ||
    location.pathname.includes('/campaign/') ||
    location.pathname.includes('/comparison/') ||
    location.pathname.includes('/edit-profile') ||
    location.pathname.includes('/notifications') ||
    location.pathname.includes('/help') ||
    location.pathname.includes('/privacy') ||
    location.pathname.includes('/badges') ||
    location.pathname.includes('/security') ||
    isCompletionScreen ||
    isCopilotOpen;

  // Animate nav visibility changes
  useEffect(() => {
    setShowNav(!hideBottomNav);
  }, [hideBottomNav]);

  // Set dark mode for employee UI
  useEffect(() => {
    document.body.classList.add('dark-mode');
    return () => {
      document.body.classList.remove('dark-mode');
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f14] via-[#080c10] to-[#050608] relative">
      {/* Main Content */}
      <main className={`${showNav ? 'pb-16' : ''} lg:pb-0 transition-padding duration-300`}>
        <Outlet />
      </main>

      {/* Bottom Navigation (mobile only) - with slide animation */}
      {showNav && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <BottomNav />
        </motion.div>
      )}
    </div>
  );
};

const EmployeeLayout: React.FC = () => (
  <GlobalSearchProvider>
    <CopilotProvider>
      <EmployeeLayoutContent />
    </CopilotProvider>
  </GlobalSearchProvider>
);

export default EmployeeLayout;
