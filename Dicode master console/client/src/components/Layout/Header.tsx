'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import NotificationCenter from '@/components/Notifications/NotificationCenter';
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
  type LucideIcon,
} from 'lucide-react';

// Page config with title and icon
const pageConfig: Record<string, { title: string; icon: LucideIcon }> = {
  '/': { title: 'Home', icon: Home },
  '/campaigns': { title: 'Campaigns', icon: LayoutGrid },
  '/campaigns/new': { title: 'New Campaign', icon: LayoutGrid },
  '/generate': { title: 'Video Generator', icon: Sparkles },
  '/videos': { title: 'Video Library', icon: Film },
  '/assets': { title: 'Prompt Assets', icon: FolderOpen },
  '/access': { title: 'Access Control', icon: Shield },
  '/clients': { title: 'Clients', icon: Building2 },
  '/settings': { title: 'Profile Settings', icon: User },
  '/main-settings': { title: 'Main Settings', icon: Settings },
  '/help': { title: 'Help & Support', icon: HelpCircle },
};

// Page title mapping (for backwards compatibility)
const pageTitles: Record<string, string> = Object.fromEntries(
  Object.entries(pageConfig).map(([path, config]) => [path, config.title])
);

// Get breadcrumb from pathname
function getBreadcrumb(pathname: string): { label: string; path: string; icon?: LucideIcon }[] {
  const parts = pathname.split('/').filter(Boolean);
  const breadcrumb: { label: string; path: string; icon?: LucideIcon }[] = [];
  
  let currentPath = '';
  for (const part of parts) {
    currentPath += `/${part}`;
    const config = pageConfig[currentPath];
    const label = config?.title || part.charAt(0).toUpperCase() + part.slice(1);
    const icon = config?.icon;
    breadcrumb.push({ label, path: currentPath, icon });
  }
  
  return breadcrumb;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const breadcrumb = getBreadcrumb(pathname);
  const pageTitle = pageTitles[pathname] || breadcrumb[breadcrumb.length - 1]?.label || 'Dashboard';

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log('Search:', searchQuery);
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
            <span className="font-medium text-slate-900">{pageTitle}</span>
          )}
        </div>
      </div>

      {/* Right Section: Search + Notifications + User */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-12 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          </div>
        </form>

        {/* Notifications */}
        <NotificationCenter />

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-xs font-bold text-white">
                {(user.displayName || user.email)?.[0].toUpperCase()}
              </div>
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
    </header>
  );
}

