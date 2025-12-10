'use client';

import { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAllCampaigns,
  getCampaignEnrollments,
  getCampaignProgressList,
  getCampaignResponses,
  getRecentActivities,
  getAllVideos,
} from '@/lib/firestore';
import type { Campaign, Video, Activity, CampaignEnrollment, CampaignProgress, CampaignResponse } from '@/lib/types';
import {
  BarChart3,
  TrendingUp,
  Users,
  Film,
  LayoutGrid,
  Calendar,
  Clock,
  CheckCircle,
  Play,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronLeft,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { Skeleton, StatCardSkeleton, TableRowSkeleton, ChartSkeleton } from '@/components/ui/skeleton';

interface CampaignStats {
  campaign: Campaign;
  enrollments: number;
  completions: number;
  inProgress: number;
  responseCount: number;
  completionRate: number;
}

interface TimeSeriesData {
  date: string;
  enrollments: number;
  completions: number;
  responses: number;
}

const PAGE_SIZE = 10;

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [campaignStats, setCampaignStats] = useState<CampaignStats[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [currentPage, setCurrentPage] = useState(1);
  const [allEnrollments, setAllEnrollments] = useState<CampaignEnrollment[]>([]);
  const [allResponses, setAllResponses] = useState<CampaignResponse[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campaignsData, videosData, activitiesData] = await Promise.all([
        getAllCampaigns(),
        getAllVideos(),
        getRecentActivities(100),
      ]);

      setCampaigns(campaignsData);
      setVideos(videosData);
      setActivities(activitiesData);

      // Load stats for each campaign and collect all enrollments/responses for time series
      const collectedEnrollments: CampaignEnrollment[] = [];
      const collectedResponses: CampaignResponse[] = [];

      const statsPromises = campaignsData.map(async (campaign) => {
        try {
          const [enrollments, progress, responses] = await Promise.all([
            getCampaignEnrollments(campaign.id),
            getCampaignProgressList(campaign.id),
            getCampaignResponses(campaign.id),
          ]);

          // Collect for time series
          collectedEnrollments.push(...enrollments);
          collectedResponses.push(...responses);

          // Count enrollments by status for accurate completion rate
          const completedEnrollments = enrollments.filter(e => e.status === 'completed').length;
          const inProgressEnrollments = enrollments.filter(e => e.status === 'in-progress').length;
          const completionRate = enrollments.length > 0 ? (completedEnrollments / enrollments.length) * 100 : 0;

          return {
            campaign,
            enrollments: enrollments.length,
            completions: completedEnrollments,
            inProgress: inProgressEnrollments,
            responseCount: responses.length,
            completionRate,
          };
        } catch (error) {
          console.error(`Failed to load stats for campaign ${campaign.id}:`, error);
          return {
            campaign,
            enrollments: 0,
            completions: 0,
            inProgress: 0,
            responseCount: 0,
            completionRate: 0,
          };
        }
      });

      const stats = await Promise.all(statsPromises);
      setCampaignStats(stats);
      setAllEnrollments(collectedEnrollments);
      setAllResponses(collectedResponses);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate overview stats
  const overviewStats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const publishedCampaigns = campaigns.filter(c => c.metadata.isPublished).length;
    const totalVideos = videos.length;
    const totalEnrollments = campaignStats.reduce((sum, s) => sum + s.enrollments, 0);
    const totalCompletions = campaignStats.reduce((sum, s) => sum + s.completions, 0);
    const totalResponses = campaignStats.reduce((sum, s) => sum + s.responseCount, 0);
    const avgCompletionRate = campaignStats.length > 0
      ? campaignStats.reduce((sum, s) => sum + s.completionRate, 0) / campaignStats.length
      : 0;

    return {
      totalCampaigns,
      publishedCampaigns,
      totalVideos,
      totalEnrollments,
      totalCompletions,
      totalResponses,
      avgCompletionRate,
    };
  }, [campaigns, videos, campaignStats]);

  // Calculate time series data for learner engagement
  const timeSeriesData = useMemo(() => {
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data: TimeSeriesData[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Count enrollments on this day
      const dayEnrollments = allEnrollments.filter(e => {
        const enrollDate = e.enrolledAt instanceof Date ? e.enrolledAt : new Date(e.enrolledAt);
        return enrollDate.toISOString().split('T')[0] === dateStr;
      });

      // Count completions on this day (enrollments with completedAt on this day)
      const dayCompletions = allEnrollments.filter(e => {
        if (e.status !== 'completed' || !e.completedAt) return false;
        const completedDate = e.completedAt instanceof Date ? e.completedAt : new Date(e.completedAt);
        return completedDate.toISOString().split('T')[0] === dateStr;
      });

      // Count responses on this day
      const dayResponses = allResponses.filter(r => {
        const responseDate = r.answeredAt instanceof Date ? r.answeredAt : new Date(r.answeredAt);
        return responseDate.toISOString().split('T')[0] === dateStr;
      });

      data.push({
        date: dateStr,
        enrollments: dayEnrollments.length,
        completions: dayCompletions.length,
        responses: dayResponses.length,
      });
    }

    return data;
  }, [allEnrollments, allResponses, timeRange]);

  // Pagination for campaign stats table
  const paginatedStats = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return campaignStats.slice(startIndex, endIndex);
  }, [campaignStats, currentPage]);

  const totalPages = Math.ceil(campaignStats.length / PAGE_SIZE);

  // Top performing campaigns
  const topCampaigns = useMemo(() => {
    return [...campaignStats]
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);
  }, [campaignStats]);

  
  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>

          {/* Charts Skeleton */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartSkeleton />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <th key={i} className="px-6 py-3">
                      <Skeleton className="h-3 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={8} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Time Range Filter */}
        <div className="flex items-center justify-end gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100">
                <LayoutGrid className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">
                  {overviewStats.totalCampaigns}
                </p>
                <p className="text-xs text-slate-500">
                  Total Campaigns ({overviewStats.publishedCampaigns} published)
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">
                  {overviewStats.totalEnrollments}
                </p>
                <p className="text-xs text-slate-500">Total Enrollments</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">
                  {overviewStats.avgCompletionRate.toFixed(0)}%
                </p>
                <p className="text-xs text-slate-500">Avg. Completion Rate</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
                <BarChart3 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">
                  {overviewStats.totalResponses}
                </p>
                <p className="text-xs text-slate-500">Total Responses</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Learner Engagement Chart */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Learner Engagement</h2>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  <span className="text-slate-600">Enrollments</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-slate-600">Completions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-slate-600">Responses</span>
                </div>
              </div>
            </div>

            {/* Stacked Bar Chart */}
            <div className="h-48 flex items-end gap-1">
              {timeSeriesData.map((day) => {
                const maxTotal = Math.max(...timeSeriesData.map(d => d.enrollments + d.completions + d.responses), 1);
                const total = day.enrollments + day.completions + day.responses;
                const totalHeight = (total / maxTotal) * 100;

                // Calculate individual heights proportionally
                const enrollmentHeight = total > 0 ? (day.enrollments / total) * totalHeight : 0;
                const completionHeight = total > 0 ? (day.completions / total) * totalHeight : 0;
                const responseHeight = total > 0 ? (day.responses / total) * totalHeight : 0;

                return (
                  <div
                    key={day.date}
                    className="flex-1 group relative flex flex-col justify-end"
                    style={{ height: '100%' }}
                  >
                    <div className="flex flex-col" style={{ height: `${Math.max(totalHeight, 2)}%` }}>
                      {/* Responses (top) */}
                      {day.responses > 0 && (
                        <div
                          className="w-full bg-gradient-to-t from-amber-400 to-amber-500 rounded-t transition-all hover:from-amber-500 hover:to-amber-600"
                          style={{ flex: responseHeight }}
                        />
                      )}
                      {/* Completions (middle) */}
                      {day.completions > 0 && (
                        <div
                          className={`w-full bg-gradient-to-t from-emerald-400 to-emerald-500 transition-all hover:from-emerald-500 hover:to-emerald-600 ${day.responses === 0 ? 'rounded-t' : ''}`}
                          style={{ flex: completionHeight }}
                        />
                      )}
                      {/* Enrollments (bottom) */}
                      {day.enrollments > 0 && (
                        <div
                          className={`w-full bg-gradient-to-t from-violet-400 to-violet-500 transition-all hover:from-violet-500 hover:to-violet-600 ${day.completions === 0 && day.responses === 0 ? 'rounded-t' : ''}`}
                          style={{ flex: enrollmentHeight }}
                        />
                      )}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <div className="font-medium mb-1">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-violet-400" />
                          <span>{day.enrollments} enrolled</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-emerald-400" />
                          <span>{day.completions} completed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-amber-400" />
                          <span>{day.responses} responses</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span>{new Date(timeSeriesData[0]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span>{new Date(timeSeriesData[timeSeriesData.length - 1]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          </div>

          {/* Engagement Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Period Summary</h2>
            <div className="space-y-3">
              {(() => {
                const totalEnrollments = timeSeriesData.reduce((sum, d) => sum + d.enrollments, 0);
                const totalCompletions = timeSeriesData.reduce((sum, d) => sum + d.completions, 0);
                const totalResponses = timeSeriesData.reduce((sum, d) => sum + d.responses, 0);
                const total = totalEnrollments + totalCompletions + totalResponses;

                const metrics = [
                  { label: 'Enrollments', count: totalEnrollments, color: 'bg-violet-500' },
                  { label: 'Completions', count: totalCompletions, color: 'bg-emerald-500' },
                  { label: 'Responses', count: totalResponses, color: 'bg-amber-500' },
                ];

                return metrics.map(({ label, count, color }) => {
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-slate-700">{label}</span>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Time range indicator */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center">
                Showing data for the last {timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : '90 days'}
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Performance Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Campaign Performance</h2>
            <p className="text-sm text-slate-500 mt-1">
              Detailed metrics for all campaigns
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Campaign</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Enrollments</th>
                  <th className="px-6 py-3 text-right">Completions</th>
                  <th className="px-6 py-3 text-right">In Progress</th>
                  <th className="px-6 py-3 text-right">Responses</th>
                  <th className="px-6 py-3 text-right">Completion Rate</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No campaigns found
                    </td>
                  </tr>
                ) : (
                  paginatedStats.map((stat) => (
                    <tr key={stat.campaign.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                            <LayoutGrid className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 line-clamp-1">
                              {stat.campaign.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {stat.campaign.items.length} videos
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          stat.campaign.metadata.isPublished
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {stat.campaign.metadata.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-900">
                        {stat.enrollments}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-900">
                        {stat.completions}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-900">
                        {stat.inProgress}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-900">
                        {stat.responseCount}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${stat.completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-slate-900 w-12 text-right">
                            {stat.completionRate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/campaign?id=${stat.campaign.id}`}
                          className="text-slate-400 hover:text-slate-600 transition"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, campaignStats.length)} of {campaignStats.length} campaigns
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first, last, current, and adjacent pages
                      return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                    })
                    .map((page, index, arr) => (
                      <span key={page}>
                        {index > 0 && arr[index - 1] !== page - 1 && (
                          <span className="px-2 text-slate-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 text-sm font-medium rounded-lg transition ${
                            currentPage === page
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {page}
                        </button>
                      </span>
                    ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Video Stats */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Campaigns */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Performing Campaigns</h2>
            <div className="space-y-3">
              {topCampaigns.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No campaign data yet</p>
              ) : (
                topCampaigns.map((stat, index) => (
                  <Link
                    key={stat.campaign.id}
                    href={`/campaign?id=${stat.campaign.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {stat.campaign.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {stat.enrollments} enrolled • {stat.completions} completed
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-semibold">{stat.completionRate.toFixed(0)}%</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Video Library Stats */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Video Library</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <Film className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-slate-900">{videos.length}</p>
                <p className="text-xs text-slate-500">Total Videos</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <Play className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-slate-900">
                  {videos.filter(v => v.source === 'generated').length}
                </p>
                <p className="text-xs text-slate-500">AI Generated</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <Clock className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-slate-900">
                  {videos.filter(v => v.source === 'uploaded').length}
                </p>
                <p className="text-xs text-slate-500">Uploaded</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-center">
                <LayoutGrid className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-2xl font-semibold text-slate-900">
                  {new Set(campaigns.flatMap(c => c.items.map(i => i.videoId))).size}
                </p>
                <p className="text-xs text-slate-500">Used in Campaigns</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

