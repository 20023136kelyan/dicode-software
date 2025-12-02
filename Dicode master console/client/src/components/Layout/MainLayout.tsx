'use client';

import { useSidebar } from '@/contexts/SidebarContext';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
  /** Hide the header for full-page layouts */
  hideHeader?: boolean;
  /** Custom page title override */
  pageTitle?: string;
}

export default function MainLayout({ children, hideHeader = false }: MainLayoutProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Header */}
      {!hideHeader && <Header />}

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          isCollapsed ? 'ml-[72px]' : 'ml-64',
          !hideHeader && 'pt-16'
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
