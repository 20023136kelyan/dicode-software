import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Printer, TrendingUp, TrendingDown, Users, BarChart3, RefreshCw, Loader2, Building2, ChevronDown } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import {
  useOrganizationAnalyticsWithHistory,
  transformHistoryForChart,
  calculateTrendChange,
  useRefreshOrganizationAnalytics,
  getCurrentScore,
} from '@/hooks/useOrganizationAnalytics';
import { useCampaignAnalytics, type VideoAggregate, type QuestionAggregate } from '@/hooks/useCampaignAnalytics';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCompetencyById, getSkillById } from '@/lib/competencies';

import {
  getCampaignsForAdmin,
  getCampaignEnrollments,
  getOrganization,
  getCohortsByOrganization,
} from '@/lib/firestore';
import type { Cohort } from '@/types';

interface CampaignWithStats {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'completed';
  startDate: Date | null;
  endDate: Date | null;
  completionRate: number;
  totalEnrollments: number;
  completedCount: number;
  inProgressCount: number;
  participants: number;
  targetCompetencies: string[];
}

type CompetencyType = 'overview' | 'psychological-safety' | 'prosocial-norms' | 'collaboration' | 'growth';

const AnalyticsTrend: React.FC = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyType>('overview');
  const [dateRange, setDateRange] = useState('last-30');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  // Fetch organization departments
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!user?.organization) {
        setDepartmentsLoading(false);
        return;
      }

      try {
        const orgRef = doc(db, 'organizations', user.organization);
        const orgDoc = await getDoc(orgRef);

        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          setDepartments(orgData.departments || []);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setDepartmentsLoading(false);
      }
    };

    fetchDepartments();
  }, [user?.organization]);

  // Get date range for query
  const dateRangeParams = useMemo(() => {
    const endDate = new Date().toISOString().split('T')[0];
    let startDate: string;

    switch (dateRange) {
      case 'last-7':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last-30':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last-90':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last-365':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return { startDate, endDate };
  }, [dateRange]);

  // Fetch real organization analytics
  const { current: analytics, history, isLoading } =
    useOrganizationAnalyticsWithHistory(user?.organization || null, dateRangeParams);

  const { refresh: manualRefresh, isRefreshing } = useRefreshOrganizationAnalytics();

  // Transform history for charts (filtered by department if selected)
  const chartData = useMemo(() => {
    if (history.length === 0) {
      // Return placeholder data if no history yet
      return [];
    }
    return transformHistoryForChart(history, selectedDepartment);
  }, [history, selectedDepartment]);

  // Calculate trend change
  const trendChange = useMemo(() => {
    return calculateTrendChange(history, 'overallScore');
  }, [history]);

  const handleRefresh = async () => {
    if (user?.organization) {
      await manualRefresh(user.organization);
    }
  };

  const tabs = [
    { id: 'trend', label: 'Trend' },
    { id: 'campaigns', label: 'Campaigns' },
  ];

  const competencyOptions = [
    { value: 'overview', label: 'Overview' },
    { value: 'psychological-safety', label: getCompetencyById('psychological-safety')?.name || 'Foster Psychological Safety' },
    { value: 'prosocial-norms', label: getCompetencyById('prosocial-norms')?.name || 'Establish Prosocial Norms' },
    { value: 'collaboration', label: getCompetencyById('collaboration')?.name || 'Encourage Collaboration' },
    { value: 'growth', label: getCompetencyById('growth')?.name || 'Prioritize Growth' },
  ];

  const dateRangeOptions = [
    { value: 'last-7', label: 'Last 7 days' },
    { value: 'last-30', label: 'Last 30 days' },
    { value: 'last-90', label: 'Last 90 days' },
    { value: 'last-365', label: 'Last year' },
  ];

  // Use real chart data
  const data = chartData;

  const getChartConfig = () => {
    // Get current score from analytics (filtered by department if selected)
    const { overallScore: currentScore, totalEmployees } = getCurrentScore(analytics, selectedDepartment);
    const trend = trendChange.change;

    // Helper to get competency score (department-aware, no fallback to org-wide)
    const getCompetencyScore = (competencyId: 'psychological-safety' | 'prosocial-norms' | 'collaboration' | 'growth') => {
      if (selectedDepartment && selectedDepartment !== 'all') {
        // Return department data if exists, otherwise 0 (not org-wide fallback)
        return analytics?.departmentAnalytics?.[selectedDepartment]?.competencyScores[competencyId]?.averageScore || 0;
      }
      return analytics?.competencyScores[competencyId]?.averageScore || 0;
    };

    // Get competency names from definitions
    const psName = getCompetencyById('psychological-safety')?.name || 'Foster Psychological Safety';
    const pnName = getCompetencyById('prosocial-norms')?.name || 'Establish Prosocial Norms';
    const colName = getCompetencyById('collaboration')?.name || 'Encourage Collaboration';
    const grName = getCompetencyById('growth')?.name || 'Prioritize Growth';

    if (selectedCompetency === 'psychological-safety') {
      return {
        title: psName,
        score: getCompetencyScore('psychological-safety'),
        trend: trend,
        totalEmployees,
        lines: [
          { key: 'overallScore', color: '#E5E5E5', label: 'Overall Score', strokeDasharray: '5 5' },
          { key: 'psychologicalSafety', color: '#EF4444', label: psName },
        ],
      };
    }

    if (selectedCompetency === 'prosocial-norms') {
      return {
        title: pnName,
        score: getCompetencyScore('prosocial-norms'),
        trend: trend,
        totalEmployees,
        lines: [
          { key: 'overallScore', color: '#E5E5E5', label: 'Overall Score', strokeDasharray: '5 5' },
          { key: 'prosocialNorms', color: '#3B82F6', label: pnName },
        ],
      };
    }

    if (selectedCompetency === 'collaboration') {
      return {
        title: colName,
        score: getCompetencyScore('collaboration'),
        trend: trend,
        totalEmployees,
        lines: [
          { key: 'overallScore', color: '#E5E5E5', label: 'Overall Score', strokeDasharray: '5 5' },
          { key: 'collaboration', color: '#A855F7', label: colName },
        ],
      };
    }

    if (selectedCompetency === 'growth') {
      return {
        title: grName,
        score: getCompetencyScore('growth'),
        trend: trend,
        totalEmployees,
        lines: [
          { key: 'overallScore', color: '#E5E5E5', label: 'Overall Score', strokeDasharray: '5 5' },
          { key: 'growth', color: '#F59E0B', label: grName },
        ],
      };
    }

    // Overview - show all competencies
    return {
      title: 'Leadership Competencies Over Time',
      score: currentScore,
      trend: trend,
      totalEmployees,
      lines: [
        { key: 'overallScore', color: '#E5E5E5', label: 'Overall Score', strokeDasharray: '5 5' },
        { key: 'psychologicalSafety', color: '#EF4444', label: psName },
        { key: 'prosocialNorms', color: '#3B82F6', label: pnName },
        { key: 'collaboration', color: '#A855F7', label: colName },
        { key: 'growth', color: '#F59E0B', label: grName },
      ],
    };
  };

  const chartConfig = getChartConfig();

  const CampaignsAnalytics = () => {
    const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(true);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

    // Department/Cohort filters
    const [campaignDepartments, setCampaignDepartments] = useState<string[]>([]);
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [campaignDepartmentFilter, setCampaignDepartmentFilter] = useState<string>('all');
    const [cohortFilter, setCohortFilter] = useState<string>('all');

    // Analytics from cloud function (includes stats, skillAggregates, videoAggregates)
    const { analytics, isLoading: analyticsLoading, fetchAnalytics, clearAnalytics } = useCampaignAnalytics();

    // Export menu
    const [exportMenuOpen, setExportMenuOpen] = useState(false);

    // Export to PDF (print)
    const handlePrintPDF = () => {
      window.print();
    };

    // Export to Excel (CSV format)
    const handleExportExcel = () => {
      const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
      if (!selectedCampaign) return;

      // Build CSV data
      const rows: string[][] = [];

      // Header
      rows.push(['Campaign Analytics Report']);
      rows.push(['Campaign', selectedCampaign.name]);
      rows.push(['Generated', new Date().toLocaleString()]);
      rows.push([]);

      // Stats
      rows.push(['Summary Statistics']);
      rows.push(['Metric', 'Value']);
      rows.push(['Total Enrolled', String(analytics?.stats?.enrolled || selectedCampaign.totalEnrollments)]);
      rows.push(['Completed', String(analytics?.stats?.completed || selectedCampaign.completedCount)]);
      rows.push(['In Progress', String(analytics?.stats?.inProgress || selectedCampaign.inProgressCount)]);
      rows.push(['Completion Rate', `${analytics?.stats?.avgCompletion ?? selectedCampaign.completionRate}%`]);
      rows.push(['Total Responses', String(analytics?.stats?.totalResponses || 0)]);
      rows.push([]);

      // Skill Assessments
      if (skillAggregates.length > 0) {
        rows.push(['Skill Assessments']);
        rows.push(['Skill', 'Average Score', 'Count']);
        skillAggregates.forEach(skill => {
          rows.push([skill.skillName, `${skill.avgScore}%`, String(skill.count)]);
        });
        rows.push([]);
      }

      // Response Distribution by Video
      if (videoAggregates.length > 0) {
        rows.push(['Response Distribution by Video']);
        videoAggregates.forEach(videoAgg => {
          rows.push([`Video: ${videoAgg.videoTitle}`]);
          videoAgg.questions.forEach((qAgg, qIdx) => {
            rows.push([`Q${qIdx + 1}`, qAgg.question.statement]);
            rows.push(['Responses', String(qAgg.responses.length)]);
            if (qAgg.avgScore !== undefined) {
              rows.push(['Average Score', qAgg.avgScore.toFixed(1)]);
            }
            if (qAgg.question.benchmarkScore) {
              rows.push(['Benchmark', String(qAgg.question.benchmarkScore)]);
            }
            if (qAgg.distribution) {
              rows.push(['Score Distribution (1-7)', Object.entries(qAgg.distribution).map(([k, v]) => `${k}:${v}`).join(', ')]);
            }
            if (qAgg.choiceDistribution && qAgg.question.options) {
              qAgg.question.options.forEach((opt, idx) => {
                const count = qAgg.choiceDistribution![opt.id] || 0;
                rows.push([`Option ${String.fromCharCode(65 + idx)}`, opt.text, String(count), `Intent: ${opt.intentScore}`]);
              });
            }
          });
          rows.push([]);
        });
      }

      // Convert to CSV
      const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedCampaign.name.replace(/[^a-z0-9]/gi, '_')}_analytics_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    // Fetch departments and cohorts
    useEffect(() => {
      const fetchFilters = async () => {
        if (!user?.organization) return;
        try {
          const org = await getOrganization(user.organization);
          if (org?.departments) {
            setCampaignDepartments(org.departments);
          }
          const cohortsList = await getCohortsByOrganization(user.organization);
          setCohorts(cohortsList);
        } catch (error) {
          console.error('Error fetching filters:', error);
        }
      };
      fetchFilters();
    }, [user?.organization]);

    // Fetch analytics when campaign or filters change
    useEffect(() => {
      if (!selectedCampaignId || !user?.organization) {
        clearAnalytics();
        return;
      }
      fetchAnalytics(
        selectedCampaignId,
        user.organization,
        campaignDepartmentFilter !== 'all' ? campaignDepartmentFilter : undefined,
        cohortFilter !== 'all' ? cohortFilter : undefined
      );
    }, [selectedCampaignId, user?.organization, campaignDepartmentFilter, cohortFilter, fetchAnalytics, clearAnalytics]);

    // Fetch campaigns with enrollment stats using the same function as CampaignManagement
    useEffect(() => {
      const fetchCampaigns = async () => {
        if (!user?.organization) return;

        setCampaignsLoading(true);
        try {
          // Use getCampaignsForAdmin to get all campaigns (same as CampaignManagement)
          const allCampaigns = await getCampaignsForAdmin(user.organization);
          const campaignsList: CampaignWithStats[] = [];

          for (const campaign of allCampaigns) {
            // Fetch enrollment stats for this campaign
            const enrollments = await getCampaignEnrollments(campaign.id, user.organization);

            const totalEnrollments = enrollments.length;
            const completedCount = enrollments.filter(e => e.status === 'completed').length;
            const inProgressCount = enrollments.filter(e => e.status === 'in-progress').length;
            const completionRate = totalEnrollments > 0 ? Math.round((completedCount / totalEnrollments) * 100) : 0;

            // Parse dates from campaign schedule
            const startDate = campaign.schedule?.startDate ? new Date(campaign.schedule.startDate) : null;
            const endDate = campaign.schedule?.endDate ? new Date(campaign.schedule.endDate) : null;

            campaignsList.push({
              id: campaign.id,
              name: campaign.title || 'Untitled Campaign',
              description: campaign.description || '',
              status: campaign.metadata?.isPublished ? 'active' : 'draft',
              startDate,
              endDate,
              completionRate,
              totalEnrollments,
              completedCount,
              inProgressCount,
              participants: totalEnrollments,
              targetCompetencies: (campaign as any).targetCompetencies || [],
            });
          }

          // Filter to only show published campaigns with at least 1 enrollment
          // Draft campaigns and campaigns with no enrollments don't have meaningful analytics
          const analyticsReady = campaignsList.filter(c =>
            c.status === 'active' && c.totalEnrollments > 0
          );

          setCampaigns(analyticsReady);
          if (analyticsReady.length > 0 && !selectedCampaignId) {
            setSelectedCampaignId(analyticsReady[0].id);
          }
        } catch (error) {
          console.error('Error fetching campaigns:', error);
        } finally {
          setCampaignsLoading(false);
        }
      };

      fetchCampaigns();
    }, [user?.organization]);

    // Use analytics data from Cloud Function
    const skillAggregates = analytics?.skillAggregates || [];
    const videoAggregates = analytics?.videoAggregates || [];

    // Filter campaigns based on selection
    const filteredCampaigns = campaigns.filter(campaign => campaign.id === selectedCampaignId);

    // Loading state for campaigns
    if (campaignsLoading) {
      return (
        <div className="card flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-dark-text-muted">Loading campaigns...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Empty State */}
        {campaigns.length === 0 ? (
          <div className="card text-center py-16">
            <BarChart3 size={48} className="text-dark-text-muted mx-auto mb-4" />
            <p className="text-dark-text-muted">No campaigns found</p>
            <p className="text-sm text-dark-text-muted mt-2">Create and launch a campaign to see analytics here</p>
          </div>
        ) : (
          <>
            {/* Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="input px-4 py-2.5 min-w-[240px] font-medium"
                >
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2 border-l border-dark-border pl-3">
                  <select
                    value={campaignDepartmentFilter}
                    onChange={(e) => setCampaignDepartmentFilter(e.target.value)}
                    className="input px-3 py-2 text-sm min-w-[150px]"
                  >
                    <option value="all">All Departments</option>
                    {campaignDepartments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <select
                    value={cohortFilter}
                    onChange={(e) => setCohortFilter(e.target.value)}
                    className="input px-3 py-2 text-sm min-w-[150px]"
                  >
                    <option value="all">All Cohorts</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                    ))}
                  </select>
                  {(campaignDepartmentFilter !== 'all' || cohortFilter !== 'all') && (
                    <button
                      onClick={() => { setCampaignDepartmentFilter('all'); setCohortFilter('all'); }}
                      className="text-xs text-primary hover:underline whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {analyticsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Download size={16} />
                  Export
                  <ChevronDown size={14} />
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-dark-card border border-dark-border rounded-lg shadow-lg z-10 min-w-[160px]">
                    <button
                      onClick={() => { handlePrintPDF(); setExportMenuOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-dark-text hover:bg-dark-bg flex items-center gap-2 rounded-t-lg"
                    >
                      <Printer size={14} />
                      Print / PDF
                    </button>
                    <button
                      onClick={() => { handleExportExcel(); setExportMenuOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-dark-text hover:bg-dark-bg flex items-center gap-2 rounded-b-lg"
                    >
                      <Download size={14} />
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filteredCampaigns.map((campaign) => {
              const completionStatusData = analytics?.completionStatus ? [
                { name: 'Completed', value: analytics.completionStatus.completed, color: '#10B981' },
                { name: 'In Progress', value: analytics.completionStatus.inProgress, color: '#3B82F6' },
                { name: 'Not Started', value: analytics.completionStatus.notStarted, color: '#6B7280' },
              ].filter(d => d.value > 0) : [
                { name: 'Completed', value: campaign.completedCount, color: '#10B981' },
                { name: 'Pending', value: campaign.totalEnrollments - campaign.completedCount, color: '#F59E0B' },
              ];

              return (
                <div key={campaign.id} className="space-y-6">
                  {/* Stats Row */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
                      <div className="text-3xl font-bold text-dark-text">{analytics?.stats?.enrolled || campaign.totalEnrollments}</div>
                      <div className="text-sm text-dark-text-muted mt-1">Enrolled</div>
                    </div>
                    <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
                      <div className="text-3xl font-bold text-emerald-500">{analytics?.stats?.completed || campaign.completedCount}</div>
                      <div className="text-sm text-dark-text-muted mt-1">Completed</div>
                    </div>
                    <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
                      <div className="text-3xl font-bold text-blue-500">{analytics?.stats?.inProgress || campaign.inProgressCount}</div>
                      <div className="text-sm text-dark-text-muted mt-1">In Progress</div>
                    </div>
                    <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
                      <div className="text-3xl font-bold text-dark-text">{analytics?.stats?.totalResponses || 0}</div>
                      <div className="text-sm text-dark-text-muted mt-1">Responses</div>
                    </div>
                  </div>

                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Enrollments & Completions Over Time */}
                    <div className="card">
                      <h3 className="text-base font-medium text-dark-text mb-4">Enrollments & Completions Over Time</h3>
                      <div className="h-[280px]">
                        {analytics?.enrollmentsOverTime && analytics.enrollmentsOverTime.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.enrollmentsOverTime}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                              <XAxis dataKey="date" stroke="#6B7280" tick={{ fontSize: 12 }} />
                              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#1F1F1F',
                                  border: '1px solid #374151',
                                  borderRadius: '6px',
                                  color: '#E5E5E5',
                                }}
                                itemStyle={{ color: '#E5E5E5' }}
                                labelStyle={{ color: '#E5E5E5' }}
                              />
                              <Legend />
                              <Area
                                type="monotone"
                                dataKey="cumulative"
                                stroke="#3B82F6"
                                fill="#3B82F6"
                                fillOpacity={0.2}
                                strokeWidth={2}
                                name="Enrollments"
                              />
                              {analytics?.completionsOverTime && (
                                <Line
                                  type="monotone"
                                  data={analytics.completionsOverTime}
                                  dataKey="cumulative"
                                  stroke="#10B981"
                                  strokeWidth={2}
                                  name="Completions"
                                  dot={false}
                                />
                              )}
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-dark-text-muted">
                            {analyticsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'No data available'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Completion Status */}
                    <div className="card">
                      <h3 className="text-base font-medium text-dark-text mb-4">Completion Status</h3>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={completionStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {completionStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1F1F1F',
                                border: '1px solid #374151',
                                borderRadius: '6px',
                                color: '#E5E5E5',
                              }}
                              itemStyle={{ color: '#E5E5E5' }}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Weekly Response Trends */}
                    <div className="card">
                      <h3 className="text-base font-medium text-dark-text mb-4">Weekly Response Trends</h3>
                      <div className="h-[280px]">
                        {analytics?.weeklyResponseTrends && analytics.weeklyResponseTrends.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.weeklyResponseTrends}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                              <XAxis dataKey="week" stroke="#6B7280" tick={{ fontSize: 12 }} />
                              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#1F1F1F',
                                  border: '1px solid #374151',
                                  borderRadius: '6px',
                                  color: '#E5E5E5',
                                }}
                                itemStyle={{ color: '#E5E5E5' }}
                                labelStyle={{ color: '#E5E5E5' }}
                              />
                              <Legend />
                              <Bar dataKey="responses" fill="#3B82F6" name="Weekly Responses" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-dark-text-muted">
                            {analyticsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'No data available'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Daily Distribution */}
                    <div className="card">
                      <h3 className="text-base font-medium text-dark-text mb-4">Daily Response Distribution</h3>
                      <div className="h-[280px]">
                        {analytics?.dailyDistribution && analytics.dailyDistribution.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.dailyDistribution}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />
                              <XAxis dataKey="day" stroke="#6B7280" tick={{ fontSize: 12 }} />
                              <YAxis stroke="#6B7280" tick={{ fontSize: 12 }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#1F1F1F',
                                  border: '1px solid #374151',
                                  borderRadius: '6px',
                                  color: '#E5E5E5',
                                }}
                                itemStyle={{ color: '#E5E5E5' }}
                                labelStyle={{ color: '#E5E5E5' }}
                              />
                              <Bar dataKey="count" fill="#6366F1" name="Responses" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-dark-text-muted">
                            {analyticsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'No data available'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Skill Assessments Section */}
                  {skillAggregates.length > 0 && (
                    <div className="card">
                      <h3 className="text-base font-medium text-dark-text mb-4">Skill Assessment Summary</h3>
                      {analyticsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {skillAggregates.map((skill) => {
                            const skillDef = getSkillById(skill.skillId);
                            const displayName = skillDef?.name || skill.skillName || skill.skillId;

                            return (
                              <div key={skill.skillId} className="bg-dark-bg rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-dark-text">{displayName}</span>
                                  <span className="text-sm text-dark-text-muted">
                                    {skill.count} assessment{skill.count !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-dark-border rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${skill.avgScore >= 70 ? 'bg-green-500' : skill.avgScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                      style={{ width: `${skill.avgScore}%` }}
                                    />
                                  </div>
                                  <span className="text-sm font-medium text-dark-text w-12 text-right">
                                    {skill.avgScore}%
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Per-Video Response Distribution */}
                  {videoAggregates.length > 0 && (
                    <>
                      <h3 className="text-base font-medium text-dark-text">Response Distribution by Video</h3>
                      {analyticsLoading ? (
                        <div className="card flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <>
                          {videoAggregates.map((videoAgg) => (
                            <div key={videoAgg.videoId} className="card">
                              <h4 className="text-sm font-medium text-dark-text mb-4">{videoAgg.videoTitle}</h4>
                              {/* Desktop: 3 columns for Q1, Q2, Q3 side by side */}
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {videoAgg.questions.map((qAgg, qIdx) => (
                                  <div key={qAgg.question.id} className="bg-dark-bg rounded-lg p-4">
                                    <div className="mb-3">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-primary">
                                          Q{qIdx + 1} • {qAgg.question.type === 'behavioral-perception' ? 'Likert' : qAgg.question.type === 'behavioral-intent' ? 'SJT' : 'Open'}
                                        </span>
                                        <span className="text-xs text-dark-text-muted">
                                          {qAgg.responses.length} resp.
                                        </span>
                                      </div>
                                      <p className="text-xs text-dark-text line-clamp-2" title={qAgg.question.statement}>
                                        {qAgg.question.statement}
                                      </p>
                                    </div>

                                    {/* Q1: Likert Scale Distribution with Recharts */}
                                    {qAgg.question.type === 'behavioral-perception' && qAgg.distribution && (
                                      <div>
                                        <div className="h-[100px]">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={[1, 2, 3, 4, 5, 6, 7].map(score => ({
                                              score,
                                              count: qAgg.distribution![score] || 0,
                                            }))}>
                                              <XAxis dataKey="score" stroke="#6B7280" tick={{ fontSize: 11 }} />
                                              <YAxis hide />
                                              <Tooltip
                                                contentStyle={{
                                                  backgroundColor: '#1F1F1F',
                                                  border: '1px solid #374151',
                                                  borderRadius: '6px',
                                                  color: '#E5E5E5',
                                                }}
                                                itemStyle={{ color: '#E5E5E5' }}
                                                labelStyle={{ color: '#E5E5E5' }}
                                                formatter={(value: number) => [`${value} responses`, 'Count']}
                                              />
                                              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                                                  <Cell
                                                    key={score}
                                                    fill={qAgg.question.benchmarkScore && score < qAgg.question.benchmarkScore ? '#EF4444' : '#10B981'}
                                                  />
                                                ))}
                                              </Bar>
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>
                                        <div className="flex items-center justify-between mt-1 text-[10px]">
                                          <span className="text-dark-text-muted">
                                            Avg: {qAgg.avgScore?.toFixed(1)}{qAgg.question.benchmarkScore ? ` • Exp: ${qAgg.question.benchmarkScore}` : ''}
                                          </span>
                                          {qAgg.question.benchmarkScore && (
                                            <span className={`font-medium ${(qAgg.avgScore || 0) >= qAgg.question.benchmarkScore ? 'text-green-500' : 'text-red-500'}`}>
                                              {(qAgg.avgScore || 0) >= qAgg.question.benchmarkScore ? '+' : ''}{((qAgg.avgScore || 0) - qAgg.question.benchmarkScore).toFixed(1)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Q2: Multiple Choice Distribution with Recharts */}
                                    {qAgg.question.type === 'behavioral-intent' && qAgg.question.options && qAgg.choiceDistribution && (
                                      <div className="space-y-2">
                                        <div className="h-[100px]">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                              data={qAgg.question.options.map((opt, idx) => ({
                                                label: String.fromCharCode(65 + idx),
                                                count: qAgg.choiceDistribution![opt.id] || 0,
                                                intentScore: opt.intentScore,
                                                isBest: opt.id === qAgg.benchmarkOptionId,
                                              }))}
                                              layout="vertical"
                                            >
                                              <XAxis type="number" hide />
                                              <YAxis dataKey="label" type="category" width={30} tick={{ fontSize: 12 }} stroke="#6B7280" />
                                              <Tooltip
                                                contentStyle={{
                                                  backgroundColor: '#1F1F1F',
                                                  border: '1px solid #374151',
                                                  borderRadius: '6px',
                                                  color: '#E5E5E5',
                                                }}
                                                itemStyle={{ color: '#E5E5E5' }}
                                                labelStyle={{ color: '#E5E5E5' }}
                                                formatter={(value: number, name: string, props: any) => [
                                                  `${value} responses (Score: ${props.payload.intentScore})`,
                                                  props.payload.isBest ? 'Best Answer' : 'Selection'
                                                ]}
                                              />
                                              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                                {qAgg.question.options.map((opt) => (
                                                  <Cell
                                                    key={opt.id}
                                                    fill={opt.intentScore >= 6 ? '#10B981' : opt.intentScore >= 4 ? '#3B82F6' : '#EF4444'}
                                                    stroke={opt.id === qAgg.benchmarkOptionId ? '#F59E0B' : 'transparent'}
                                                    strokeWidth={opt.id === qAgg.benchmarkOptionId ? 2 : 0}
                                                  />
                                                ))}
                                              </Bar>
                                            </BarChart>
                                          </ResponsiveContainer>
                                        </div>

                                        {/* Compact Options Legend for Desktop */}
                                        <div className="space-y-1 pt-2 border-t border-dark-border">
                                          {qAgg.question.options.map((option, idx) => {
                                            const count = qAgg.choiceDistribution![option.id] || 0;
                                            const total = qAgg.responses.length;
                                            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                                            const isBenchmark = option.id === qAgg.benchmarkOptionId;

                                            return (
                                              <div key={option.id} className={`flex items-center gap-1.5 px-2 py-1 rounded ${isBenchmark ? 'bg-amber-500/10 border border-amber-500/30' : ''
                                                }`} title={option.text}>
                                                <span className={`text-[10px] font-bold ${option.intentScore >= 6 ? 'text-emerald-400'
                                                  : option.intentScore <= 2 ? 'text-red-400'
                                                    : 'text-dark-text-muted'
                                                  }`}>
                                                  {String.fromCharCode(65 + idx)}
                                                </span>
                                                <span className={`flex-1 text-[10px] truncate ${isBenchmark ? 'text-amber-400' : 'text-dark-text-muted'}`}>
                                                  {option.text.slice(0, 25)}{option.text.length > 25 ? '...' : ''}
                                                </span>
                                                <span className="text-[10px] text-dark-text-muted">
                                                  {percentage}%
                                                </span>
                                                {isBenchmark && (
                                                  <span className="text-[9px] text-amber-500 font-medium">★</span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Q3: Qualitative - Compact Word Cloud + Sample */}
                                    {qAgg.question.type === 'qualitative' && qAgg.responses.length > 0 && (
                                      <div className="space-y-3">
                                        {/* Compact Word Cloud */}
                                        {(() => {
                                          const wordFrequency: Record<string, number> = {};
                                          qAgg.responses.forEach((r) => {
                                            if (typeof r.answer === 'string') {
                                              const words = r.answer.toLowerCase()
                                                .replace(/[^\w\s]/g, '')
                                                .split(/\s+/)
                                                .filter(w => w.length > 3);
                                              words.forEach((word) => {
                                                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
                                              });
                                            }
                                          });

                                          const sortedWords = Object.entries(wordFrequency)
                                            .sort((a, b) => b[1] - a[1])
                                            .slice(0, 12);

                                          if (sortedWords.length === 0) return null;

                                          const maxCount = sortedWords[0][1];
                                          const minCount = sortedWords[sortedWords.length - 1][1];
                                          const colors = ['text-blue-400', 'text-green-400', 'text-purple-400', 'text-amber-400', 'text-pink-400'];

                                          return (
                                            <div>
                                              <p className="text-[10px] text-dark-text-muted mb-1">Keywords</p>
                                              <div className="bg-dark-card rounded-lg p-2 flex flex-wrap gap-1.5 justify-center items-center min-h-[60px]">
                                                {sortedWords.map(([word, count], idx) => {
                                                  const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
                                                  const fontSize = Math.round(10 + ratio * 8);
                                                  const colorClass = colors[idx % colors.length];

                                                  return (
                                                    <span
                                                      key={word}
                                                      className={`${colorClass} cursor-default`}
                                                      style={{ fontSize: `${fontSize}px`, opacity: 0.6 + ratio * 0.4 }}
                                                      title={`"${word}" (${count}x)`}
                                                    >
                                                      {word}
                                                    </span>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        })()}

                                        {/* Sample Responses - Compact */}
                                        <div>
                                          <p className="text-[10px] text-dark-text-muted mb-1">Samples</p>
                                          <div className="space-y-1 max-h-24 overflow-y-auto">
                                            {qAgg.responses.slice(0, 2).map((r) => (
                                              <div key={r.id} className="bg-dark-card rounded px-2 py-1 text-[10px] text-dark-text-muted line-clamp-2">
                                                "{typeof r.answer === 'string' ? r.answer : String(r.answer)}"
                                              </div>
                                            ))}
                                            {qAgg.responses.length > 2 && (
                                              <p className="text-[10px] text-dark-text-muted text-center">
                                                +{qAgg.responses.length - 2} more
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* No data */}
                                    {qAgg.responses.length === 0 && (
                                      <p className="text-sm text-dark-text-muted">No responses yet</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-dark-border">
        <div className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/admin/analytics/${t.id}`)}
              className={`pb-3 px-1 relative ${(tab === t.id || (!tab && t.id === 'trend'))
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
          {/* Filters */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-dark-text-muted mb-2">Competencies</label>
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
                {dateRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs text-dark-text-muted mb-2 flex items-center gap-1">
                <Building2 size={12} />
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="input w-full"
                disabled={departmentsLoading}
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="btn-secondary flex items-center gap-2 h-10"
              title="Refresh analytics data"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="card flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-dark-text-muted">Loading analytics data...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && chartData.length === 0 && (
            <div className="card flex items-center justify-center py-20">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-dark-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-dark-text mb-2">No Analytics Data Yet</h3>
                <p className="text-dark-text-muted mb-4 max-w-md">
                  Analytics data is generated daily based on employee campaign completions and skill assessments.
                  Once employees start completing campaigns, you'll see trends here.
                </p>
                <button onClick={handleRefresh} className="btn-primary">
                  Generate Analytics Now
                </button>
              </div>
            </div>
          )}

          {/* Chart Container - Only show when we have data */}
          {!isLoading && chartData.length > 0 && (
            <div className="flex gap-6">
              {/* Chart */}
              <div className="flex-1 min-w-0 card">
                {/* Department filter indicator */}
                {selectedDepartment !== 'all' && (
                  <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                    <Building2 size={16} className="text-primary" />
                    <span className="text-sm text-dark-text">
                      Showing data for <span className="font-semibold text-primary">{selectedDepartment}</span> department
                    </span>
                    <span className="text-xs text-dark-text-muted ml-auto">
                      Department-level filtering active
                    </span>
                  </div>
                )}
                <div className="h-[400px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
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
                        itemStyle={{ color: '#E5E5E5' }}
                        labelStyle={{ color: '#E5E5E5' }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="line"
                      />

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
                  {selectedCompetency === 'overview'
                    ? 'Current Leadership Score'
                    : `Average ${competencyOptions.find(c => c.value === selectedCompetency)?.label} Score`}
                </div>
                <div className="text-6xl font-bold mb-2">{chartConfig.score || '—'}</div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">{trendChange.trend === 'up' ? 'Improving' : trendChange.trend === 'down' ? 'Declining' : 'Stable'}</span>
                  <div className={`flex items-center gap-1 ${chartConfig.trend > 0 ? 'text-green-500' : chartConfig.trend < 0 ? 'text-red-500' : 'text-dark-text-muted'}`}>
                    <span className="font-medium">{chartConfig.trend > 0 ? '+' : ''}{chartConfig.trend.toFixed(1)}%</span>
                    {chartConfig.trend > 0 ? <TrendingUp size={16} /> : chartConfig.trend < 0 ? <TrendingDown size={16} /> : null}
                  </div>
                </div>
                {/* Employee count */}
                <div className="flex items-center gap-2 text-sm text-dark-text-muted border-t border-dark-border pt-3">
                  <Users size={14} />
                  <span>{chartConfig.totalEmployees || 0} {selectedDepartment !== 'all' ? 'in department' : 'employees'}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsTrend;
