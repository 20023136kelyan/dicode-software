import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from './Sidebar';
import {
  Search,
  LogOut,
  User,
  ChevronDown,
  Menu,
  Bell,
  Settings,
  Command,
} from 'lucide-react';

// Page title mapping
const pageTitles: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/overview': 'Overview',
  '/admin/analytics': 'Analytics',
  '/admin/campaigns': 'Campaigns',
  '/admin/employees': 'Employee Management',
  '/admin/assets': 'Asset Library',
  '/admin/company': 'Company Settings',
  '/admin/account': 'Account Settings',
};

// Get breadcrumb from pathname
function getBreadcrumb(pathname: string): { label: string; path: string }[] {
  const parts = pathname.split('/').filter(Boolean);
  const breadcrumb: { label: string; path: string }[] = [];
  
  let currentPath = '';
  for (const part of parts) {
    currentPath += `/${part}`;
    // Skip 'admin' in breadcrumb display
    if (part === 'admin') {
      breadcrumb.push({ label: 'Admin', path: currentPath });
      continue;
    }
    const fullPath = currentPath;
    const label = pageTitles[fullPath] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
    breadcrumb.push({ label, path: fullPath });
  }
  
  return breadcrumb;
}

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const breadcrumb = getBreadcrumb(location.pathname);
  const pageTitle = pageTitles[location.pathname] || breadcrumb[breadcrumb.length - 1]?.label || 'Dashboard';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Search:', searchQuery);
  };

  return (
    <header 
      className={`fixed top-0 right-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.08] bg-[#262628]/80 backdrop-blur-xl px-6 transition-all duration-300 ${
        isCollapsed ? 'left-[72px]' : 'left-64'
      }`}
    >
      {/* Left Section: Mobile Menu + Breadcrumb */}
      <div className="flex items-center gap-4">
        {/* Mobile menu toggle */}
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-text-muted transition hover:bg-dark-card hover:text-dark-text lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          {breadcrumb.length > 1 ? (
            breadcrumb.slice(1).map((item, index) => (
              <div key={item.path} className="flex items-center gap-2">
                {index > 0 && <span className="text-dark-text-muted/50">/</span>}
                {index === breadcrumb.length - 2 ? (
                  <span className="font-medium text-dark-text">{item.label}</span>
                ) : (
                  <button
                    onClick={() => navigate(item.path)}
                    className="text-dark-text-muted transition hover:text-dark-text"
                  >
                    {item.label}
                  </button>
                )}
              </div>
            ))
          ) : (
            <span className="font-medium text-dark-text">{pageTitle}</span>
          )}
        </nav>
      </div>

      {/* Right Section: Search + Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <form onSubmit={handleSearch} className="hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-9 w-56 rounded-lg border border-dark-border bg-dark-card pl-9 pr-12 text-sm text-dark-text placeholder:text-dark-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded border border-dark-border bg-dark-bg px-1.5 py-0.5 text-[10px] font-medium text-dark-text-muted">
              <Command className="h-2.5 w-2.5" />
              <span>K</span>
            </div>
          </div>
        </form>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-dark-text-muted transition hover:bg-dark-card hover:text-dark-text">
          <Bell className="h-5 w-5" />
          {/* Notification badge */}
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-white/[0.08]" />

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-dark-card"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-light to-primary text-xs font-bold text-dark-bg">
                {(user.name || user.email)?.[0].toUpperCase()}
              </div>
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-dark-text-muted transition hover:bg-dark-card-hover hover:text-dark-text"
                  >
                    <User className="h-4 w-4" />
                    Profile Settings
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/admin/company');
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-dark-text-muted transition hover:bg-dark-card-hover hover:text-dark-text"
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-400 transition hover:bg-rose-500/10"
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
};

export default Header;

