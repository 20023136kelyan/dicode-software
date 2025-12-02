import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Share2, TrendingUp, TrendingDown, Users, Target, Calendar, BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { generateTimeSeriesData, psychologicalSafetyData } from '@/utils/mockData';

type CompetencyType = 'overview' | 'psychological-safety' | 'prosocial-norms' | 'collaboration' | 'growth';

const AnalyticsTrend: React.FC = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyType>('overview');
  const [dateRange, setDateRange] = useState('1 Jan 2023 - 31 Dec 2023');
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  const tabs = [
    { id: 'trend', label: 'Trend' },
    { id: 'campaigns', label: 'Campaigns' },
  ];

  const competencyOptions = [
    { value: 'overview', label: 'Overview' },
    { value: 'psychological-safety', label: 'Psychological Safety' },
    { value: 'prosocial-norms', label: 'Prosocial Norms' },
    { value: 'collaboration', label: 'Collaboration' },
    { value: 'growth', label: 'Growth' },
  ];

  const data = selectedCompetency === 'psychological-safety'
    ? psychologicalSafetyData
    : generateTimeSeriesData();

  const getChartConfig = () => {
    if (selectedCompetency === 'psychological-safety') {
      return {
        title: 'Psychological Safety',
        score: 55,
        trend: -15.2,
        lines: [
          { key: 'overall', color: '#E5E5E5', label: 'Overall Score', strokeDasharray: '5 5' },
          { key: 'empathy', color: '#10B981', label: 'Empathy' },
          { key: 'strengths', color: '#3B82F6', label: 'Strengths' },
          { key: 'allyship', color: '#6366F1', label: 'Allyship' },
          { key: 'decisionMaking', color: '#EC4899', label: 'Decision-making' },
        ],
      };
    }

    return {
      title: 'Leadership Competencies Over Time',
      score: 76,
      trend: 3.03,
      lines: [
        { key: 'overallScore', color: '#E5E5E5', label: 'Overall Score', strokeDasharray: '5 5' },
        { key: 'psychologicalSafety', color: '#EF4444', label: 'Psychological Safety' },
        { key: 'prosocialNorms', color: '#3B82F6', label: 'Prosocial Norms' },
        { key: 'collaboration', color: '#A855F7', label: 'Collaboration' },
        { key: 'growth', color: '#F59E0B', label: 'Growth' },
      ],
    };
  };

  const chartConfig = getChartConfig();

  // Mock active campaigns data (in production, this would come from CampaignManagement or API)
  const activeCampaigns = [
    {
      id: '1',
      name: 'Q1 Leadership Development',
      description: 'Quarterly leadership check-in for all managers',
      status: 'active' as const,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-03-31'),
      completionRate: 67,
      totalResponses: 45,
      participants: 67,
      targetCompetencies: ['Leadership', 'Communication'],
    },
    {
      id: '2',
      name: 'Culture Pulse Survey',
      description: 'Monthly culture and competency assessment',
      status: 'active' as const,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-29'),
      completionRate: 82,
      totalResponses: 120,
      participants: 146,
      targetCompetencies: ['Culture', 'Inclusion'],
    },
    {
      id: '3',
      name: 'Q2 Team Collaboration',
      description: 'Quarterly team collaboration assessment',
      status: 'active' as const,
      startDate: new Date('2024-04-01'),
      endDate: new Date('2024-06-30'),
      completionRate: 54,
      totalResponses: 38,
      participants: 70,
      targetCompetencies: ['Collaboration', 'Teamwork'],
    },
    {
      id: '4',
      name: 'Skills Tomorrow Initiative',
      description: 'Future skills development program',
      status: 'active' as const,
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-05-31'),
      completionRate: 91,
      totalResponses: 95,
      participants: 104,
      targetCompetencies: ['Growth', 'Innovation'],
    },
  ];

  // Generate campaign analytics data
  const generateCampaignResponseData = (campaign: typeof activeCampaigns[0]) => {
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10', 'Week 11', 'Week 12'];
    return weeks.map((week, index) => ({
      week,
      responses: Math.floor(Math.random() * 8) + 2,
      completionRate: Math.min(100, 30 + index * 5 + Math.random() * 10),
      cumulative: Math.min(campaign.participants, Math.floor((30 + index * 5) * campaign.participants / 100)),
    }));
  };

  const generateDailyResponseData = () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day) => ({
      day,
      responses: Math.floor(Math.random() * 12) + 1,
      completed: Math.floor(Math.random() * 8) + 1,
    }));
  };

  const CampaignsAnalytics = () => {
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
      activeCampaigns.length > 0 ? activeCampaigns[0].id : ''
    );
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Filter campaigns based on selection
    const filteredCampaigns = activeCampaigns.filter(campaign => campaign.id === selectedCampaignId);

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-dark-text font-semibold">{activeCampaigns.length}</span>
              <span className="text-dark-text-muted ml-1">campaigns</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="input px-3 py-2 min-w-[200px]"
            >
              {activeCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
            <button className="btn-secondary flex items-center gap-2">
              <Share2 size={16} />
              Share
            </button>
          </div>
        </div>

        {/* Campaign Analytics */}
        {filteredCampaigns.length === 0 ? (
          <div className="card text-center py-12">
            <BarChart3 size={48} className="text-dark-text-muted mx-auto mb-4" />
            <p className="text-dark-text-muted">No campaigns found</p>
            <p className="text-sm text-dark-text-muted mt-2">Create and launch a campaign to see analytics here</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-6">
            {filteredCampaigns.map((campaign) => {
              const responseData = generateCampaignResponseData(campaign);
              const dailyData = generateDailyResponseData();
              const completed = Math.round(campaign.totalResponses * (campaign.completionRate / 100));
              const pending = campaign.totalResponses - completed;
              
              const completionData = [
                { name: 'Completed', value: completed, color: '#10B981' },
                { name: 'Pending', value: pending, color: '#F59E0B' },
              ];

              return (
                <div key={campaign.id} className="space-y-6">
                  {/* Campaign Header */}
                  <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-dark-text mb-2">{campaign.name}</h2>
                  <p className="text-sm text-dark-text-muted mb-4">{campaign.description}</p>
                  
                  {/* Campaign Info */}
                        <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2 text-sm text-dark-text-muted">
                      <Calendar size={16} />
                      <span>{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-dark-text-muted">
                      <Users size={16} />
                      <span>{campaign.participants} participants</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-dark-text-muted">
                      <Target size={16} />
                      <span>{campaign.completionRate}% completion</span>
                    </div>
                  </div>

                  {/* Target Competencies */}
                        <div className="mt-4">
                          <div className="text-sm font-medium text-dark-text mb-2">Target Competencies</div>
                    <div className="flex flex-wrap gap-2">
                      {campaign.targetCompetencies.map((comp) => (
                        <span key={comp} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Response Rate Over Time */}
                    <div className="card">
                      <h3 className="text-lg font-semibold text-dark-text mb-4">Response Rate Over Time</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={responseData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                            <XAxis dataKey="week" stroke="#A0A0A0" />
                            <YAxis stroke="#A0A0A0" domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#2A2A2A',
                                border: '1px solid #3A3A3A',
                                borderRadius: '8px',
                                color: '#E5E5E5',
                              }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="completionRate"
                              stroke="#3B82F6"
                              strokeWidth={2}
                              name="Completion Rate (%)"
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Completion Status */}
                    <div className="card">
                      <h3 className="text-lg font-semibold text-dark-text mb-4">Completion Status</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={completionData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={(props) => {
                                const name = props.name ?? '';
                                const value =
                                  typeof props.value === 'number' ? props.value : Number(props.value ?? 0);
                                const percent =
                                  typeof props.percent === 'number' ? props.percent : Number(props.percent ?? 0);
                                return `${name}: ${value} (${Math.round(percent * 100)}%)`;
                              }}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {completionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#2A2A2A',
                                border: '1px solid #3A3A3A',
                                borderRadius: '8px',
                                color: '#E5E5E5',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Weekly Response Trends */}
                    <div className="card">
                      <h3 className="text-lg font-semibold text-dark-text mb-4">Weekly Response Trends</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={responseData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                            <XAxis dataKey="week" stroke="#A0A0A0" />
                            <YAxis stroke="#A0A0A0" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#2A2A2A',
                                border: '1px solid #3A3A3A',
                                borderRadius: '8px',
                                color: '#E5E5E5',
                              }}
                            />
                            <Legend />
                            <Bar dataKey="responses" fill="#3B82F6" name="Responses" />
                            <Bar dataKey="cumulative" fill="#10B981" name="Cumulative" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
        </div>

                    {/* Daily Response Distribution */}
                    <div className="card">
                      <h3 className="text-lg font-semibold text-dark-text mb-4">Daily Response Distribution</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                            <XAxis dataKey="day" stroke="#A0A0A0" />
                            <YAxis stroke="#A0A0A0" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#2A2A2A',
                                border: '1px solid #3A3A3A',
                                borderRadius: '8px',
                                color: '#E5E5E5',
                              }}
                            />
                            <Legend />
                            <Bar dataKey="responses" fill="#6366F1" name="Total Responses" />
                            <Bar dataKey="completed" fill="#10B981" name="Completed" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="border-b border-dark-border">
        <div className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/admin/analytics/${t.id}`)}
              className={`pb-3 px-1 relative ${
                (tab === t.id || (!tab && t.id === 'trend'))
                  ? 'text-primary font-medium'
                  : 'text-dark-text-muted hover:text-dark-text'
              }`}
            >
              {t.label}
              {(tab === t.id || (!tab && t.id === 'trend')) && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Page Content */}
      {tab === 'campaigns' ? (
        <CampaignsAnalytics />
      ) : (
        <>
          {/* Page Title and Share */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">
              {selectedCompetency === 'psychological-safety'
                ? 'Psychological Safety'
                : 'Leadership Competencies Over Time'}
            </h1>
            <button className="flex items-center gap-2 px-4 py-2 hover:bg-dark-card rounded-lg border border-dark-border">
              <span>Share</span>
              <Share2 size={18} />
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-dark-text-muted mb-2">Competancies</label>
              <select
                value={selectedCompetency}
                onChange={(e) => setSelectedCompetency(e.target.value as CompetencyType)}
                className="input w-full"
              >
                {competencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs text-dark-text-muted mb-2">Date Range</label>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="input w-full">
                <option>1 Jan 2023 - 31 Dec 2023</option>
                <option>1 Jul 2023 - 31 Dec 2023</option>
                <option>1 Oct 2023 - 31 Dec 2023</option>
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs text-dark-text-muted mb-2">Milestones</label>
              <select
                value={selectedMilestone || ''}
                onChange={(e) => setSelectedMilestone(e.target.value || null)}
                className="input w-full"
              >
                <option value="">Please select</option>
                <option value="1">RTO Policy (May 2023)</option>
                <option value="2">Leadership Training (Aug 2023)</option>
              </select>
            </div>
          </div>

          {/* Chart Container */}
          <div className="flex gap-6">
            {/* Chart */}
            <div className="flex-1 card">
              <div className="h-[400px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    onMouseMove={(e: any) => {
                      if (e && e.activePayload) {
                        setHoveredPoint(e.activePayload[0]?.payload);
                      }
                    }}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                    <XAxis dataKey="date" stroke="#A0A0A0" />
                    <YAxis stroke="#A0A0A0" domain={[0, 90]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#2A2A2A',
                        border: '1px solid #3A3A3A',
                        borderRadius: '8px',
                        color: '#E5E5E5',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="line"
                    />

                    {selectedMilestone === '1' && (
                      <ReferenceLine
                        x="May"
                        stroke="#F7B500"
                        strokeDasharray="3 3"
                        label={{ value: 'RTO', position: 'top', fill: '#F7B500', fontSize: 12 }}
                      />
                    )}

                    {chartConfig.lines.map((line) => (
                      <Line
                        key={line.key}
                        type="monotone"
                        dataKey={line.key}
                        stroke={line.color}
                        strokeWidth={2}
                        strokeDasharray={line.strokeDasharray}
                        name={line.label}
                        dot={false}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                {/* Milestone Marker */}
                {selectedMilestone === '1' && hoveredPoint?.date === 'May' && (
                  <div className="absolute top-[45%] left-[45%] bg-primary rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                    <span className="text-dark-bg text-xs font-bold">!</span>
                  </div>
                )}
              </div>

              {/* Legend Buttons */}
              <div className="flex gap-2 mt-6 flex-wrap">
                {chartConfig.lines.map((line) => (
                  <button
                    key={line.key}
                    className="px-4 py-2 rounded-lg bg-dark-bg text-sm flex items-center gap-2"
                  >
                    <div
                      className="w-8 h-0.5"
                      style={{
                        backgroundColor: line.color,
                        ...(line.strokeDasharray && { backgroundImage: `repeating-linear-gradient(to right, ${line.color} 0, ${line.color} 5px, transparent 5px, transparent 10px)` })
                      }}
                    />
                    <span>{line.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Score Card */}
            <div className="w-64 card">
              <div className="text-sm text-dark-text-muted mb-2">
                {selectedCompetency === 'psychological-safety'
                  ? 'Average Psychological Safety Score'
                  : 'Current Leadership Score'}
              </div>
              <div className="text-6xl font-bold mb-2">{chartConfig.score}</div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Outperforming</span>
                <div className={`flex items-center gap-1 ${chartConfig.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  <span className="font-medium">{chartConfig.trend > 0 ? '+' : ''}{chartConfig.trend}%</span>
                  {chartConfig.trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsTrend;
