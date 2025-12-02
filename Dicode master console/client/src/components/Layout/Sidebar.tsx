'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpenIcon, FilmIcon, SparklesIcon, CubeIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import AuthButton from '../Auth/AuthButton';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  filters?: FilterOption[];
}

interface FilterOption {
  id: string;
  label: string;
  param: string;
  value: string;
}

const navItems: NavItem[] = [
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: BookOpenIcon,
    path: '/campaigns',
    filters: [
      { id: 'all-campaigns', label: 'All Campaigns', param: 'status', value: 'all' },
      { id: 'published', label: 'Published', param: 'status', value: 'published' },
      { id: 'draft', label: 'Draft', param: 'status', value: 'draft' },
    ]
  },
  {
    id: 'videos',
    label: 'Video Library',
    icon: FilmIcon,
    path: '/videos',
    filters: [
      { id: 'all-videos', label: 'All Videos', param: 'source', value: 'all' },
      { id: 'generated', label: 'Generated', param: 'source', value: 'generated' },
      { id: 'uploaded', label: 'Uploaded', param: 'source', value: 'uploaded' },
    ]
  },
  { id: 'assets', label: 'Asset Store', icon: CubeIcon, path: '/assets' },
  { id: 'generate', label: 'Generate Video', icon: SparklesIcon, path: '/generate' },
  { id: 'access', label: 'Access Management', icon: ShieldCheckIcon, path: '/access' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname?.startsWith(path);
  };

  return (
    <div className="fixed left-6 top-6 bottom-6 z-40 w-72">
      <div className="flex h-full flex-col overflow-y-auto rounded-[32px] border border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-6 shadow-xl">
        <div className="space-y-4 pb-6">
          <div className="flex items-center gap-3">
            <Image
              src="/dicode_logo.png"
              alt="DI Code Logo"
              width={56}
              height={56}
              className="h-12 w-12 rounded-2xl border border-white shadow"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                Dicode suite
              </p>
              <p className="text-base font-semibold text-slate-900">Workflow panel</p>
            </div>
          </div>
          <Link
            href="/campaigns/new"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(15,23,42,0.3)] transition hover:brightness-110"
          >
            Launch campaign
          </Link>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isItemActive = isActive(item.path);

            return (
              <Link
                key={item.id}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  isItemActive
                    ? "bg-slate-900 text-white shadow-lg"
                    : "text-slate-600 hover:bg-white",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="flex-1 text-left">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Need a new seat?</p>
            <p className="text-xs text-slate-500">
              Provision teammates through Access Management.
            </p>
            <div className="mt-3">
              <AuthButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
