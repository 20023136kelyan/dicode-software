import React, { useState, createContext, useContext } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Megaphone,
  FolderOpen,
  MessageSquare,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  HelpCircle,
} from 'lucide-react';
import AICopilot from '@/components/shared/AICopilot';

// Sidebar context for collapse state
interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggleSidebar: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};

interface NavItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { path: '/admin/overview', icon: LayoutDashboard, label: 'Overview' },
  { path: '/admin/analytics', icon: TrendingUp, label: 'Analytics' },
  { path: '/admin/campaigns', icon: Megaphone, label: 'Campaigns' },
  { path: '/admin/employees', icon: Users, label: 'Employees' },
  { path: '/admin/assets', icon: FolderOpen, label: 'Asset Library' },
  { path: '/admin/company', icon: Building2, label: 'Company' },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const { isCollapsed, toggleSidebar } = useSidebar();

  const isActive = (path: string) => {
    if (path === '/admin/overview') {
      return location.pathname === '/admin' || location.pathname === '/admin/overview';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/[0.06] bg-dark-card transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {/* Logo Header */}
        <div className={`flex h-14 items-center border-b border-white/[0.06] px-4 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          {isCollapsed ? (
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center"
              title="Expand sidebar"
            >
              <img
                src="/dicode_logo.png"
                alt="DiCode"
                className="h-9 w-9 rounded-lg cursor-pointer hover:opacity-80 transition"
              />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <img
                  src="/dicode_logo.png"
                  alt="DiCode"
                  className="h-9 w-9 rounded-lg"
                />
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold text-dark-text">DiCode</span>
                  <span className="text-sm font-light text-dark-text-muted">Admin</span>
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                className="flex h-7 w-7 items-center justify-center rounded-md text-dark-text-muted transition hover:bg-dark-card hover:text-dark-text"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Quick Action Button */}
        <div className={`p-3 ${isCollapsed && 'px-2'}`}>
          <NavLink
            to="/admin/campaigns"
            className={`flex items-center justify-center gap-2 rounded-lg bg-primary font-medium text-dark-bg shadow-sm transition hover:bg-primary-dark ${
              isCollapsed ? 'h-10 w-10 mx-auto' : 'h-10 px-4'
            }`}
            title={isCollapsed ? 'New Campaign' : undefined}
          >
            <Plus className="h-4 w-4" />
            {!isCollapsed && <span className="text-sm">New Campaign</span>}
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-primary text-dark-bg'
                      : 'text-dark-text-muted hover:bg-dark-card hover:text-dark-text'
                  } ${isCollapsed && 'justify-center px-0'}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-dark-bg' : ''}`} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-400">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {isCollapsed && item.badge && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-violet-500" />
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-dark-card border border-dark-border px-2 py-1 text-xs font-medium text-dark-text opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block z-50">
                      {item.label}
                      {item.badge && (
                        <span className="ml-1 rounded bg-violet-500 px-1 text-[9px] text-white">{item.badge}</span>
                      )}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-white/[0.06] px-3 py-3">
          <div className="space-y-1">
            {/* DI Copilot */}
            <button
              onClick={() => setIsCopilotOpen(true)}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-dark-text-muted transition-all hover:bg-dark-card hover:text-dark-text ${
                isCollapsed && 'justify-center px-0'
              }`}
              title={isCollapsed ? 'DI Copilot' : undefined}
            >
              <MessageSquare className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>DI Copilot</span>}
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-dark-card border border-dark-border px-2 py-1 text-xs font-medium text-dark-text opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block z-50">
                  DI Copilot
                </div>
              )}
            </button>

            {/* Help & Support */}
            <button
              onClick={() => window.open('mailto:support@di-code.de', '_blank')}
              className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-dark-text-muted transition-all hover:bg-dark-card hover:text-dark-text ${
                isCollapsed && 'justify-center px-0'
              }`}
              title={isCollapsed ? 'Help & Support' : undefined}
            >
              <HelpCircle className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span>Help & Support</span>}
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-dark-card border border-dark-border px-2 py-1 text-xs font-medium text-dark-text opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block z-50">
                  Help & Support
                </div>
              )}
            </button>
          </div>

          {/* Expand toggle when collapsed */}
          {isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="mt-2 flex h-10 w-full items-center justify-center rounded-lg text-dark-text-muted transition hover:bg-dark-card hover:text-dark-text"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* AI Copilot */}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          context={{ userRole: 'admin' }}
        />
      )}
    </>
  );
};

export default Sidebar;
