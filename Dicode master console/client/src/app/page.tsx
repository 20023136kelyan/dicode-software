'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentActivities } from '@/lib/firestore';
import type { Activity, ActivityAction } from '@/lib/types';
import { Avatar } from '@/components/ui/avatar';
import {
  LayoutGrid,
  Sparkles,
  ArrowUpRight,
  FolderOpen,
  Film,
  Shield,
  Clock,
  Plus,
  TrendingUp,
  Building2,
} from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  bgColor: string;
  badge?: string;
}

const tools: Tool[] = [
  {
    id: 'campaign-manager',
    name: 'Campaign Manager',
    description: 'Design, publish and manage behavioral coaching campaigns',
    icon: <LayoutGrid className="h-5 w-5" />,
    path: '/campaigns',
    color: 'text-sky-600',
    bgColor: 'bg-sky-500',
  },
  {
    id: 'video-generator',
    name: 'Video Generator',
    description: 'Create AI-powered videos with Sora 2',
    icon: <Sparkles className="h-5 w-5" />,
    path: '/generate',
    color: 'text-violet-600',
    bgColor: 'bg-violet-500',
    badge: 'AI',
  },
  {
    id: 'video-library',
    name: 'Video Library',
    description: 'Browse, upload and manage all your video content',
    icon: <Film className="h-5 w-5" />,
    path: '/videos',
    color: 'text-rose-600',
    bgColor: 'bg-rose-500',
  },
  {
    id: 'asset-store',
    name: 'Prompt Assets',
    description: 'Reusable characters, environments and camera setups',
    icon: <FolderOpen className="h-5 w-5" />,
    path: '/assets',
    color: 'text-amber-600',
    bgColor: 'bg-amber-500',
  },
  {
    id: 'access-management',
    name: 'Access Control',
    description: 'Set organization-level permissions for campaigns',
    icon: <Shield className="h-5 w-5" />,
    path: '/access',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500',
  },
  {
    id: 'client-management',
    name: 'Client Management',
    description: 'View and manage client organizations and their users',
    icon: <Building2 className="h-5 w-5" />,
    path: '/clients',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-500',
  },
];

const quickActions = [
  { label: 'New Campaign', path: '/campaigns/new', icon: <Plus className="h-4 w-4" /> },
  { label: 'Generate Video', path: '/generate', icon: <Sparkles className="h-4 w-4" /> },
  { label: 'Upload Asset', path: '/assets', icon: <FolderOpen className="h-4 w-4" /> },
];

// Helper to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Helper to get action description
function getActionDescription(action: ActivityAction): string {
  const descriptions: Record<ActivityAction, string> = {
    campaign_created: 'created campaign',
    campaign_updated: 'updated campaign',
    campaign_published: 'published campaign',
    campaign_deleted: 'deleted campaign',
    video_generated: 'generated video',
    video_uploaded: 'uploaded video',
    video_updated: 'updated video',
    video_deleted: 'deleted video',
    asset_created: 'created asset',
    asset_updated: 'updated asset',
    asset_deleted: 'deleted asset',
    access_updated: 'updated access for',
    bulk_access_updated: 'bulk updated access for',
  };
  return descriptions[action] || action;
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const data = await getRecentActivities(5);
        setActivities(data);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setActivitiesLoading(false);
      }
    }

    if (user) {
      fetchActivities();
    } else {
      setActivitiesLoading(false);
    }
  }, [user]);

  const handleToolClick = (path: string) => {
    router.push(path);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <section className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-slate-500">
            What would you like to work on today?
          </p>
        </section>

        {/* Quick Actions */}
        <section className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action.path}
              onClick={() => handleToolClick(action.path)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </section>

        {/* Main Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Tools Section - Takes 2 columns */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                All Tools
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.path)}
                  className="group relative flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${tool.bgColor} text-white shadow-sm`}>
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {tool.name}
                      </h3>
                      {tool.badge && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-600">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition-all group-hover:text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              ))}

              {/* Coming Soon Card */}
              <div className="flex items-start gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-400">
                      More Coming Soon
                    </h3>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Soon
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    New tools and integrations on the way
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Activity Section - Takes 1 column */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                Recent Activity
              </h2>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Clock className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">No recent activity</p>
                  <p className="text-xs text-slate-400 mt-1">Your actions will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-4">
                      <Avatar
                        src={activity.userAvatar}
                        name={activity.userName}
                        email={activity.userEmail}
                        className="h-8 w-8 text-xs shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 leading-snug">
                          <span className="font-medium text-slate-900">
                            {activity.userName || activity.userEmail?.split('@')[0] || 'Someone'}
                          </span>
                          {' '}{getActionDescription(activity.action)}{' '}
                          <span className="font-medium text-slate-900">
                            "{activity.resourceName}"
                          </span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatRelativeTime(activity.createdAt instanceof Date ? activity.createdAt : new Date(activity.createdAt))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}
