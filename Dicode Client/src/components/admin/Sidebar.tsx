import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Megaphone,
  FolderOpen,
  User,
  LogOut,
  MessageSquare,
  Users,
  Building2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AICopilot from '@/components/shared/AICopilot';

const Sidebar: React.FC = () => {
  const { logout } = useAuth();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const navItems = [
    { path: '/admin/overview', icon: LayoutDashboard, label: 'Overview' },
    { path: '/admin/analytics', icon: TrendingUp, label: 'Analytics' },
    { path: '/admin/campaigns', icon: Megaphone, label: 'Campaign management' },
    { path: '/admin/employees', icon: Users, label: 'Employee Management' },
    { path: '/admin/assets', icon: FolderOpen, label: 'Asset Library' },
    { path: '/admin/company', icon: Building2, label: 'Company' },
    { path: '/admin/account', icon: User, label: 'Account' },
  ];

  return (
    <>
      <div className="w-64 bg-dark-bg border-r border-dark-border h-screen flex flex-col fixed left-0 top-0">
        {/* Logo */}
        <div className="p-6 border-b border-dark-border">
          <div className="flex items-center gap-4">
            <img
              src="/dicode_logo.png"
              alt="DI Code Logo"
              className="w-14 h-14 object-contain"
            />
            <div className="leading-tight">
              <p className="text-[11px] uppercase tracking-[0.4em] text-dark-text-muted font-medium">
                Admin
              </p>
              <p className="text-xl font-semibold text-dark-text">Console</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-dark-bg font-medium'
                    : 'text-dark-text hover:bg-dark-card'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-dark-border space-y-2">
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-dark-text hover:bg-dark-card transition-colors"
          >
            <MessageSquare size={20} />
            <span>DI Copilot</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-dark-text hover:bg-dark-card transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>

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
