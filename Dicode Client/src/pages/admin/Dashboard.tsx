import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  Target, 
  Award, 
  ArrowUpRight, 
  Clock,
  Megaphone,
  BarChart3,
  UserPlus,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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

const quickActions = [
  { label: 'New Campaign', path: '/admin/campaigns', icon: <Plus className="h-4 w-4" /> },
  { label: 'Invite Employee', path: '/admin/employees', icon: <UserPlus className="h-4 w-4" /> },
  { label: 'View Analytics', path: '/admin/analytics', icon: <TrendingUp className="h-4 w-4" /> },
];

const metrics = [
  {
    label: 'Total Employees',
    value: '247',
    change: '+12%',
    trend: 'up' as const,
    icon: Users,
  },
  {
    label: 'Avg Leadership Score',
    value: '76',
    change: '+3.03%',
    trend: 'up' as const,
    icon: TrendingUp,
  },
  {
    label: 'Completion Rate',
    value: '78%',
    change: '+5%',
    trend: 'up' as const,
    icon: Target,
  },
  {
    label: 'Engagement Level',
    value: '85',
    change: '+2%',
    trend: 'up' as const,
    icon: Award,
  },
];

const recentActivity = [
  { employee: 'Sarah Johnson', action: 'completed Module 8', time: '2 hours ago', department: 'Marketing' },
  { employee: 'Mike Chen', action: 'started Onboarding Assessment', time: '5 hours ago', department: 'Technology' },
  { employee: 'Emily Davis', action: 'completed Module 9', time: '1 day ago', department: 'Operations' },
  { employee: 'James Wilson', action: 'joined the platform', time: '2 days ago', department: 'Sales' },
];

function formatRelativeTime(time: string): string {
  return time;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Hero */}
      <section className="card bg-gradient-to-br from-dark-card to-dark-bg border-dark-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-dark-text">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-dark-text-muted text-sm mt-1">
              Here's what's happening with your behavioral coaching platform.
            </p>
          </div>
          <div className="flex gap-2">
            {quickActions.map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="btn-secondary flex items-center gap-2"
              >
                {action.icon}
                <span className="hidden sm:inline">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
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
              <div className={`flex items-center gap-1 text-sm font-medium ${
                metric.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                <TrendingUp size={14} className={metric.trend === 'down' ? 'rotate-180' : ''} />
                {metric.change}
              </div>
            </div>
            <div className="text-3xl font-bold text-dark-text mb-1">{metric.value}</div>
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
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="h-10 w-10 rounded-full bg-dark-card flex items-center justify-center mb-3">
                  <Clock className="h-5 w-5 text-dark-text-muted" />
                </div>
                <p className="text-sm font-medium text-dark-text">No recent activity</p>
                <p className="text-xs text-dark-text-muted mt-1">Your team's actions will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-border">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 transition hover:bg-dark-card-hover">
                    <div className="avatar avatar--md avatar--gradient flex-shrink-0">
                      {activity.employee.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dark-text leading-snug">
                        <span className="font-medium">
                          {activity.employee}
                        </span>
                        {' '}{activity.action}
                      </p>
                      <p className="text-xs text-dark-text-muted mt-1">
                        {activity.department} • {formatRelativeTime(activity.time)}
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
