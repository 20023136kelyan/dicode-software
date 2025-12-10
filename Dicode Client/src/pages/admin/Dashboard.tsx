import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../components/shared/Avatar';
import {
  TrendingUp,
  Users,
  Target,
  Award,
  ArrowUpRight,
  Clock,
  Megaphone,
  BarChart3,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationAnalyticsRealtime } from '@/hooks/useOrganizationAnalytics';
import { getRecentOrgActivity, type RecentActivityItem } from '@/lib/firestore';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  bgColor: string;
}

const tools: Tool[] = [
  {
    id: 'campaigns',
    name: 'Campaign Manager',
    description: 'Create, publish and manage behavioral coaching campaigns',
    icon: <Megaphone className="h-5 w-5" />,
    path: '/admin/campaigns',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500',
  },
  {
    id: 'analytics',
    name: 'Analytics Dashboard',
    description: 'Track leadership competencies and employee progress',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/admin/analytics',
    color: 'text-sky-500',
    bgColor: 'bg-sky-500',
  },
  {
    id: 'employees',
    name: 'Employee Management',
    description: 'Manage teams, cohorts and user invitations',
    icon: <Users className="h-5 w-5" />,
    path: '/admin/employees',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500',
  },
  {
    id: 'company',
    name: 'Company Settings',
    description: 'Configure branding, departments and organization profile',
    icon: <Award className="h-5 w-5" />,
    path: '/admin/company',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500',
  },
];


function formatRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return timestamp.toLocaleDateString();
}

function formatActionText(action: RecentActivityItem['action'], campaignTitle: string): string {
  switch (action) {
    case 'completed':
      return `completed ${campaignTitle}`;
    case 'started':
      return `started ${campaignTitle}`;
    case 'in_progress':
      return `is working on ${campaignTitle}`;
    case 'enrolled':
      return `enrolled in ${campaignTitle}`;
    case 'invitation_sent':
      return `invited ${campaignTitle}`;
    case 'invitation_accepted':
      return `joined the organization`;
    case 'cohort_created':
      return `created cohort ${campaignTitle}`;
    case 'campaign_published':
      return `published ${campaignTitle}`;
    case 'campaign_assigned':
      return `assigned ${campaignTitle}`;
    default:
      return `activity: ${campaignTitle}`;
  }
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Real-time analytics data
  const { analytics, isLoading: analyticsLoading } = useOrganizationAnalyticsRealtime(user?.organization || null);

  // Recent activity state
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Fetch recent activity
  useEffect(() => {
    const fetchActivity = async () => {
      if (!user?.organization) {
        setActivityLoading(false);
        return;
      }
      try {
        const activities = await getRecentOrgActivity(user.organization, 5);
        setRecentActivity(activities);
      } catch (error) {
        console.error('Failed to fetch recent activity:', error);
      } finally {
        setActivityLoading(false);
      }
    };
    fetchActivity();
  }, [user?.organization]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  // Build metrics from real data
  const metrics = [
    {
      label: 'Total Employees',
      value: analytics?.totalEmployees?.toString() || '—',
      change: analytics ? `${analytics.activeUsersLast30Days} active` : '',
      trend: 'up' as const,
      icon: Users,
      isLoading: analyticsLoading,
    },
    {
      label: 'Avg Leadership Score',
      value: analytics?.overallScore ? Math.round(analytics.overallScore).toString() : '—',
      change: '',
      trend: 'up' as const,
      icon: TrendingUp,
      isLoading: analyticsLoading,
    },
    {
      label: 'Completion Rate',
      value: analytics?.completionRate ? `${Math.round(analytics.completionRate)}%` : '—',
      change: '',
      trend: 'up' as const,
      icon: Target,
      isLoading: analyticsLoading,
    },
    {
      label: 'Engagement Rate',
      value: analytics?.engagementRate ? Math.round(analytics.engagementRate).toString() : '—',
      change: '',
      trend: 'up' as const,
      icon: Award,
      isLoading: analyticsLoading,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Hero */}
      <section>
        <h1 className="text-xl font-semibold text-dark-text">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-dark-text-muted text-sm mt-1">
          Here's what's happening with your behavioral coaching platform.
        </p>
      </section>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="card group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <metric.icon size={20} className="text-primary" />
              </div>
              {metric.change && (
                <div className="text-xs text-dark-text-muted">
                  {metric.change}
                </div>
              )}
            </div>
            {metric.isLoading ? (
              <div className="h-9 w-16 bg-dark-card-hover rounded animate-pulse mb-1" />
            ) : (
              <div className="text-3xl font-bold text-dark-text mb-1">{metric.value}</div>
            )}
            <div className="text-sm text-dark-text-muted">{metric.label}</div>
          </div>
        ))}
      </section>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tools Section - Takes 2 columns */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-header">
              Quick Access
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => navigate(tool.path)}
                className="card card--interactive group relative flex items-start gap-4 text-left"
              >
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${tool.bgColor} text-white shadow-sm`}>
                  {tool.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-dark-text">
                    {tool.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-dark-text-muted line-clamp-2">
                    {tool.description}
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-dark-text-muted transition-all group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            ))}
          </div>
        </section>

        {/* Activity Section - Takes 1 column */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-header flex items-center gap-2">
              <Clock className="h-4 w-4 text-dark-text-muted" />
              Recent Activity
            </h2>
          </div>

          <div className="card p-0 overflow-hidden">
            {activityLoading ? (
              <div className="divide-y divide-dark-border">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-4">
                    <div className="h-10 w-10 rounded-full bg-dark-card-hover animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-dark-card-hover rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-dark-card-hover rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="h-10 w-10 rounded-full bg-dark-card flex items-center justify-center mb-3">
                  <Clock className="h-5 w-5 text-dark-text-muted" />
                </div>
                <p className="text-sm font-medium text-dark-text">No recent activity</p>
                <p className="text-xs text-dark-text-muted mt-1">Your team's actions will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-border">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-4 transition hover:bg-dark-card-hover">
                    <Avatar
                      src={activity.userAvatar}
                      name={activity.userName}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-text leading-snug">
                        <span className="font-medium">
                          {activity.userName}
                        </span>
                        {' '}{formatActionText(activity.action, activity.campaignTitle)}
                      </p>
                      <p className="text-xs text-dark-text-muted mt-1">
                        {activity.department || 'Team'} • {formatRelativeTime(activity.timestamp)}
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
  );
};

export default Dashboard;
