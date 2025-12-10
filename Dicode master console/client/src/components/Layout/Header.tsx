'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import NotificationCenter from '@/components/Notifications/NotificationCenter';
import GlobalSearch from '@/components/Search/GlobalSearch';
import { Avatar } from '@/components/ui/avatar';
import {
  Search,
  LogOut,
  User,
  ChevronDown,
  Menu,
  Command,
  Home,
  LayoutGrid,
  Sparkles,
  Film,
  FolderOpen,
  Shield,
  Building2,
  Settings,
  HelpCircle,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

// Page config with title and icon
const pageConfig: Record<string, { title: string; icon: LucideIcon }> = {
  '/': { title: 'Home', icon: Home },
  '/campaigns': { title: 'Campaigns', icon: LayoutGrid },
  '/campaigns/new': { title: 'New Campaign', icon: LayoutGrid },
  '/campaign': { title: 'Campaign Details', icon: LayoutGrid },
  '/campaign/edit': { title: 'Edit Campaign', icon: LayoutGrid },
  '/generate': { title: 'Video Generator', icon: Sparkles },
  '/videos': { title: 'Video Library', icon: Film },
  '/assets': { title: 'Prompt Assets', icon: FolderOpen },
  '/access': { title: 'Access Control', icon: Shield },
  '/clients': { title: 'Clients', icon: Building2 },
  '/analytics': { title: 'Analytics', icon: BarChart3 },
  '/settings': { title: 'Profile Settings', icon: User },
  '/main-settings': { title: 'Main Settings', icon: Settings },
  '/help': { title: 'Help & Support', icon: HelpCircle },
};

// Parent path mapping for breadcrumb hierarchy
const parentPaths: Record<string, string> = {
  '/campaign': '/campaigns',
  '/campaign/edit': '/campaigns',
  '/campaigns/new': '/campaigns',
};

// Page title mapping (for backwards compatibility)
const pageTitles: Record<string, string> = Object.fromEntries(
  Object.entries(pageConfig).map(([path, config]) => [path, config.title])
);

// Get breadcrumb from pathname
function getBreadcrumb(pathname: string): { label: string; path: string; icon?: LucideIcon }[] {
  const breadcrumb: { label: string; path: string; icon?: LucideIcon }[] = [];

  // Check if this path has a parent that should be shown first
  const parentPath = parentPaths[pathname];
  if (parentPath) {
    const parentConfig = pageConfig[parentPath];
    if (parentConfig) {
      breadcrumb.push({
        label: parentConfig.title,
        path: parentPath,
        icon: parentConfig.icon,
      });
    }
  }

  // Add the current page
  const config = pageConfig[pathname];
  if (config) {
    breadcrumb.push({
      label: config.title,
      path: pathname,
      icon: breadcrumb.length === 0 ? config.icon : undefined, // Only show icon on first item
    });
  } else {
    // Fallback: build from path segments
    const parts = pathname.split('/').filter(Boolean);
    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;
      const segmentConfig = pageConfig[currentPath];
      const label = segmentConfig?.title || part.charAt(0).toUpperCase() + part.slice(1);
      const icon = segmentConfig?.icon;
      breadcrumb.push({ label, path: currentPath, icon });
    }
  }

  return breadcrumb;
}

export default function Header() {
  const router = useRouter();
  const rawPathname = usePathname();
  // Normalize pathname: remove trailing slash (except for root)
  const pathname = rawPathname === '/' ? '/' : rawPathname.replace(/\/$/, '');
  const { user, signOut } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const breadcrumb = getBreadcrumb(pathname);
  const pageTitle = pageTitles[pathname] || breadcrumb[breadcrumb.length - 1]?.label || 'Dashboard';

  // Handle Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className={cn(
      'fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 transition-all duration-300',
      isCollapsed ? 'left-[72px]' : 'left-64'
    )}>
      {/* Left Section: Mobile Menu + Breadcrumb */}
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={toggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          {breadcrumb.length > 0 ? (
            breadcrumb.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.path} className="flex items-center gap-2">
                  {index > 0 && <span className="text-slate-300">/</span>}
                  {index === breadcrumb.length - 1 ? (
                    <span className="flex items-center gap-2 font-medium text-slate-900">
                      {index === 0 && Icon && <Icon className="h-4 w-4 text-slate-500" />}
                      {item.label}
                    </span>
                  ) : (
                    <button
                      onClick={() => router.push(item.path)}
                      className="flex items-center gap-2 text-slate-500 transition hover:text-slate-700"
                    >
                      {index === 0 && Icon && <Icon className="h-4 w-4" />}
                      {item.label}
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <span className="flex items-center gap-2 font-medium text-slate-900">
              <Home className="h-4 w-4 text-slate-500" />
              {pageTitle}
            </span>
          )}
        </div>
      </div>

      {/* Right Section: Search + Notifications + User */}
      <div className="flex items-center gap-3">
        {/* Search Button */}
        <button
          onClick={() => setShowSearch(true)}
          className="hidden md:flex items-center gap-2 h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <div className="flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium">
            <Command className="h-2.5 w-2.5" />
            <span>K</span>
          </div>
        </button>

        {/* Notifications */}
        <NotificationCenter />

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
            >
              <Avatar
                src={user.photoURL}
                name={user.displayName}
                email={user.email}
                className="h-8 w-8 text-xs"
              />
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-slate-900 leading-tight">
                  {user.displayName || user.email?.split('@')[0]}
                </p>
                <p className="text-xs text-slate-500 leading-tight">
                  {user.email}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                  <div className="border-b border-slate-100 px-3 py-2 mb-1">
                    <p className="text-sm font-medium text-slate-900">
                      {user.displayName || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      router.push('/settings');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <User className="h-4 w-4" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleSignOut();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  );
}

