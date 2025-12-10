'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Sparkles,
  Film,
  FolderOpen,
  Shield,
  Home,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  HelpCircle,
  Building2,
  BarChart3,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    path: '/',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: LayoutGrid,
    path: '/campaigns',
  },
  {
    id: 'generate',
    label: 'Video Generator',
    icon: Sparkles,
    path: '/generate',
    badge: 'AI',
  },
  {
    id: 'videos',
    label: 'Video Library',
    icon: Film,
    path: '/videos',
  },
  {
    id: 'assets',
    label: 'Prompt Assets',
    icon: FolderOpen,
    path: '/assets',
  },
  {
    id: 'access',
    label: 'Access Control',
    icon: Shield,
    path: '/access',
  },
  {
    id: 'clients',
    label: 'Clients',
    icon: Building2,
    path: '/clients',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    path: '/analytics',
  },
];

const bottomNavItems: NavItem[] = [
  {
    id: 'main-settings',
    label: 'Main Settings',
    icon: Settings,
    path: '/main-settings',
  },
  {
    id: 'help',
    label: 'Help & Support',
    icon: HelpCircle,
    path: '/help',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo Header */}
      <div className={cn(
        'flex h-16 items-center border-b border-slate-100 px-4',
        isCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {isCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center"
            title="Expand sidebar"
          >
            <Image
              src="/dicode_logo.png"
              alt="DiCode"
              width={36}
              height={36}
              className="h-9 w-9 rounded-lg cursor-pointer hover:opacity-80 transition"
            />
          </button>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/dicode_logo.png"
                alt="DiCode"
                width={36}
                height={36}
                className="h-9 w-9 rounded-lg"
              />
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold text-slate-900">DiCode</span>
                <span className="text-sm font-light text-slate-400">Suite</span>
              </div>
            </Link>
            <button
              onClick={toggleSidebar}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* New Campaign Button */}
      <div className={cn('p-3', isCollapsed && 'px-2')}>
        <Link
          href="/campaigns/new"
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg bg-slate-900 font-medium text-white shadow-sm transition hover:bg-slate-800',
            isCollapsed ? 'h-10 w-10 mx-auto' : 'h-10 px-4'
          )}
          title={isCollapsed ? 'New Campaign' : undefined}
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span className="text-sm">New Campaign</span>}
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.id}
                href={item.path}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  isCollapsed && 'justify-center px-0'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-slate-900' : 'text-slate-500')} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">
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
                  <div className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block">
                    {item.label}
                    {item.badge && (
                      <span className="ml-1 rounded bg-violet-500 px-1 text-[9px]">{item.badge}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-slate-100 px-3 py-3">
        <div className="space-y-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.id}
                href={item.path}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                  isCollapsed && 'justify-center px-0'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full ml-2 hidden rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Collapse Toggle (when collapsed) */}
        {isCollapsed && (
          <button
            onClick={toggleSidebar}
            className="mt-2 flex h-10 w-full items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
