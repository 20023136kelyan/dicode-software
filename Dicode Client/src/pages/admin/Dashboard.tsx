import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, Target, Award } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const metrics = [
    {
      label: 'Total Employees',
      value: '247',
      change: '+12%',
      trend: 'up',
      icon: Users,
    },
    {
      label: 'Avg Leadership Score',
      value: '76',
      change: '+3.03%',
      trend: 'up',
      icon: TrendingUp,
    },
    {
      label: 'Completion Rate',
      value: '78%',
      change: '+5%',
      trend: 'up',
      icon: Target,
    },
    {
      label: 'Engagement Level',
      value: '85',
      change: '+2%',
      trend: 'up',
      icon: Award,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Overview</h1>
        <p className="text-dark-text-muted">
          Welcome back! Here's what's happening with your behavioral coaching platform.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.label} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <metric.icon size={24} className="text-primary" />
              </div>
              <div className={`text-sm font-medium ${metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {metric.change}
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{metric.value}</div>
            <div className="text-sm text-dark-text-muted">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <button
          onClick={() => navigate('/admin/analytics')}
          className="card hover:border-primary transition-colors text-left p-8"
        >
          <TrendingUp size={32} className="text-primary mb-4" />
          <h3 className="text-xl font-semibold mb-2">View Analytics</h3>
          <p className="text-dark-text-muted">
            Explore detailed analytics and insights on leadership competencies and employee progress.
          </p>
        </button>

        <div className="card p-8">
          <Users size={32} className="text-blue-light mb-4" />
          <h3 className="text-xl font-semibold mb-2">Employee Progress</h3>
          <p className="text-dark-text-muted">
            Monitor individual employee learning journeys and module completion rates.
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { employee: 'Sarah Johnson', action: 'completed Module 8', time: '2 hours ago', department: 'Marketing' },
            { employee: 'Mike Chen', action: 'started Onboarding Assessment', time: '5 hours ago', department: 'Technology' },
            { employee: 'Emily Davis', action: 'completed Module 9', time: '1 day ago', department: 'Operations' },
          ].map((activity, idx) => (
            <div key={idx} className="flex items-center justify-between py-3 border-b border-dark-border last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-light to-primary flex items-center justify-center text-white font-semibold">
                  {activity.employee.charAt(0)}
                </div>
                <div>
                  <div className="font-medium">{activity.employee}</div>
                  <div className="text-sm text-dark-text-muted">
                    {activity.action} • {activity.department}
                  </div>
                </div>
              </div>
              <div className="text-sm text-dark-text-muted">{activity.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
