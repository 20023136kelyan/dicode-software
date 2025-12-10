import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from './Sidebar';
import Avatar from '../shared/Avatar';
import GlobalSearch from './GlobalSearch';
import {
  Search,
  LogOut,
  User,
  ChevronDown,
  Menu,
  Bell,
  Settings,
  Command,
  LayoutDashboard,
  TrendingUp,
  Megaphone,
  Users,
  FolderOpen,
  Building2,
  Plus,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import NotificationsPopover from './NotificationsPopover';

// Page config with title and icon
const pageConfig: Record<string, { title: string; icon: LucideIcon }> = {
  '/admin': { title: 'Overview', icon: LayoutDashboard },
  '/admin/overview': { title: 'Overview', icon: LayoutDashboard },
  '/admin/analytics': { title: 'Analytics', icon: TrendingUp },
  '/admin/campaigns': { title: 'Campaigns', icon: Megaphone },
  '/admin/employees': { title: 'Employees', icon: Users },
  '/admin/assets': { title: 'Asset Library', icon: FolderOpen },
  '/admin/company': { title: 'Company', icon: Building2 },
  '/admin/account': { title: 'Account', icon: User },
  '/admin/help': { title: 'Help & Support', icon: HelpCircle },
};

// Page title mapping (for backwards compatibility)
const pageTitles: Record<string, string> = Object.fromEntries(
  Object.entries(pageConfig).map(([path, config]) => [path, config.title])
);

// Get breadcrumb from pathname and search params
function getBreadcrumb(pathname: string, searchParams: URLSearchParams): { label: string; path: string; icon?: LucideIcon }[] {
  const parts = pathname.split('/').filter(Boolean);
  const breadcrumb: { label: string; path: string; icon?: LucideIcon }[] = [];

  let currentPath = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    currentPath += `/${part}`;
    // Skip 'admin' in breadcrumb display
    if (part === 'admin') {
      breadcrumb.push({ label: 'Admin', path: currentPath });
      continue;
    }

    // Handle dynamic campaign detail route: /admin/campaigns/:campaignId
    if (parts[i - 1] === 'campaigns' && part !== 'campaigns') {
      breadcrumb.push({ label: 'Campaign Details', path: currentPath, icon: Megaphone });
      continue;
    }

    // Handle dynamic employee detail route: /admin/employees/:employeeId
    if (parts[i - 1] === 'employees' && part !== 'employees') {
      breadcrumb.push({ label: 'Employee Details', path: currentPath });
      continue;
    }

    const fullPath = currentPath;
    const config = pageConfig[fullPath];
    const label = config?.title || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
    const icon = config?.icon;
    breadcrumb.push({ label, path: fullPath, icon });
  }

  // Check for special states via URL params
  const tab = searchParams.get('tab');
  if (pathname === '/admin/campaigns' && tab === 'create') {
    breadcrumb.push({ label: 'New Campaign', path: '/admin/campaigns?tab=create', icon: Plus });
  }

  return breadcrumb;
}


// ... imports

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Notifications Hook
  const { unreadCount } = useAdminNotifications();

  const breadcrumb = getBreadcrumb(location.pathname, searchParams);
  const pageTitle = pageTitles[location.pathname] || breadcrumb[breadcrumb.length - 1]?.label || 'Dashboard';

  // Handle Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.08] bg-[#262628]/80 backdrop-blur-xl px-6 transition-all duration-300 ${isCollapsed ? 'left-[72px]' : 'left-64'
          }`}
      >
        {/* Left Section: Mobile Menu + Breadcrumb */}
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-text-muted transition hover:bg-white/5 hover:text-dark-text lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumb.length > 1 ? (
              breadcrumb.slice(1).map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.path} className="flex items-center gap-2">
                    {index > 0 && <span className="text-dark-text-muted/50">/</span>}
                    {index === breadcrumb.length - 2 ? (
                      <span className="flex items-center gap-2 font-medium text-dark-text">
                        {index === 0 && Icon && <Icon className="h-4 w-4 text-dark-text-muted" />}
                        {item.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => navigate(item.path)}
                        className="flex items-center gap-2 text-dark-text-muted transition hover:text-dark-text"
                      >
                        {index === 0 && Icon && <Icon className="h-4 w-4" />}
                        {item.label}
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <span className="flex items-center gap-2 font-medium text-dark-text">
                <LayoutDashboard className="h-4 w-4 text-dark-text-muted" />
                {pageTitle}
              </span>
            )}
          </nav>
        </div>

        {/* Right Section: Search + Notifications + User */}
        <div className="flex items-center gap-2">
          {/* Search Trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-2 h-9 w-56 rounded-lg border border-dark-border bg-dark-card px-3 text-sm text-dark-text-muted transition hover:border-primary hover:text-dark-text"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left truncate">Search...</span>
            <div className="flex items-center gap-0.5 rounded border border-dark-border bg-dark-bg px-1.5 py-0.5 text-[10px] font-medium opacity-50">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${showNotifications ? 'bg-white/10 text-white' : 'text-dark-text-muted hover:bg-white/5 hover:text-dark-text'
                }`}
            >
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-[#262628]" />
              )}
            </button>

            {showNotifications && (
              <NotificationsPopover onClose={() => setShowNotifications(false)} />
            )}
          </div>

          {/* Divider */}
          <div className="mx-1 h-6 w-px bg-white/[0.08]" />

          {/* User Menu */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/5"
              >
                <Avatar
                  src={user.avatar}
                  name={user.name}
                  email={user.email}
                  size="sm"
                  className="bg-transparent"
                />
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-dark-text leading-tight">
                    {user.name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-dark-text-muted leading-tight capitalize">
                    {user.role}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-dark-text-muted hidden sm:block transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-dark-border bg-dark-card p-1.5 shadow-xl animate-fadeInScale">
                    <div className="border-b border-dark-border px-3 py-2.5 mb-1">
                      <p className="text-sm font-medium text-dark-text">
                        {user.name || 'User'}
                      </p>
                      <p className="text-xs text-dark-text-muted truncate">
                        {user.email}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/admin/account');
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-dark-text-muted transition hover:bg-white/5 hover:text-dark-text"
                    >
                      <User className="h-4 w-4" />
                      Profile Settings
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/admin/company');
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-dark-text-muted transition hover:bg-white/5 hover:text-dark-text"
                    >
                      <Settings className="h-4 w-4" />
                      Company Settings
                    </button>
                    <div className="my-1 h-px bg-dark-border" />
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-rose-400 transition hover:bg-rose-500/10"
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

      {/* Global Search Modal */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};

export default Header;

