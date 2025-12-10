'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  BarChart3,
  MessageSquare,
  Users,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  TrendingUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getCampaignResponses,
  getCampaignResponseStats,
  getCampaignEnrollments,
  getVideo,
  type CampaignResponseStats,
} from '@/lib/firestore';
import type { Campaign, CampaignResponse, Video, CampaignEnrollment } from '@/lib/types';

interface ResponsesPanelProps {
  campaign: Campaign;
  isOpen: boolean;
  onClose: () => void;
}

interface QuestionInfo {
  id: string;
  statement: string;
  type: 'perception' | 'intent' | 'qualitative';
  videoId: string;
  videoTitle: string;
}

export default function ResponsesPanel({ campaign, isOpen, onClose }: ResponsesPanelProps) {
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<CampaignResponse[]>([]);
  const [stats, setStats] = useState<CampaignResponseStats | null>(null);
  const [enrollments, setEnrollments] = useState<CampaignEnrollment[]>([]);
  const [videos, setVideos] = useState<Record<string, Video>>({});
  const [selectedVideo, setSelectedVideo] = useState<string>('all');
  const [selectedQuestionType, setSelectedQuestionType] = useState<string>('all');
  const [showAnonymous, setShowAnonymous] = useState(campaign.anonymousResponses ?? false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && campaign.id) {
      loadData();
    }
  }, [isOpen, campaign.id]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [responsesData, statsData, enrollmentsData] = await Promise.all([
        getCampaignResponses(campaign.id),
        getCampaignResponseStats(campaign.id),
        getCampaignEnrollments(campaign.id),
      ]);

      setResponses(responsesData);
      setStats(statsData);
      setEnrollments(enrollmentsData);

      // Load video details
      const videoIds = [...new Set(campaign.items.map(item => item.videoId))];
      const videoPromises = videoIds.map(id => getVideo(id));
      const videoResults = await Promise.all(videoPromises);
      const videoMap: Record<string, Video> = {};
      videoResults.forEach((video, index) => {
        if (video) {
          videoMap[videoIds[index]] = video;
        }
      });
      setVideos(videoMap);
    } catch (error) {
      console.error('Failed to load responses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build question info map
  const questionMap = useMemo(() => {
    const map: Record<string, QuestionInfo> = {};
    campaign.items.forEach(item => {
      const video = videos[item.videoId];
      if (item.questions) {
        item.questions.forEach(q => {
          map[q.id || `${item.videoId}-${q.type}`] = {
            id: q.id || `${item.videoId}-${q.type}`,
            statement: q.statement,
            type: q.type as 'perception' | 'intent' | 'qualitative',
            videoId: item.videoId,
            videoTitle: video?.title || 'Unknown Video',
          };
        });
      }
    });
    return map;
  }, [campaign.items, videos]);

  // Filter responses
  const filteredResponses = useMemo(() => {
    return responses.filter(r => {
      if (selectedVideo !== 'all' && r.videoId !== selectedVideo) return false;
      if (selectedQuestionType !== 'all') {
        const question = questionMap[r.questionId];
        if (question && question.type !== selectedQuestionType) return false;
      }
      return true;
    });
  }, [responses, selectedVideo, selectedQuestionType, questionMap]);

  // Group responses by question
  const responsesByQuestion = useMemo(() => {
    const grouped: Record<string, CampaignResponse[]> = {};
    filteredResponses.forEach(r => {
      if (!grouped[r.questionId]) {
        grouped[r.questionId] = [];
      }
      grouped[r.questionId].push(r);
    });
    return grouped;
  }, [filteredResponses]);

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Video', 'Question', 'Question Type', 'Response', 'User ID', 'Answered At'];
    const rows = filteredResponses.map(r => {
      const question = questionMap[r.questionId];
      return [
        question?.videoTitle || 'Unknown',
        question?.statement || r.questionId,
        question?.type || 'unknown',
        String(r.answer),
        showAnonymous ? 'Anonymous' : r.userId,
        new Date(r.answeredAt).toISOString(),
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${campaign.title.replace(/[^a-z0-9]/gi, '_')}_responses.csv`;
    link.click();
  };

  // Render Likert distribution chart
  const renderLikertChart = (distribution: Record<number, number>) => {
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...Object.values(distribution));

    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map(value => {
          const count = distribution[value] || 0;
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div key={value} className="flex items-center gap-3">
              <span className="w-4 text-xs font-medium text-slate-600 text-right">{value}</span>
              <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="w-16 text-xs text-slate-500 text-right">
                {count} ({percentage.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-3xl bg-white shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Campaign Responses</h2>
              <p className="text-sm text-slate-500">{campaign.title}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Stats Cards */}
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <div className="grid grid-cols-4 gap-4">
                  <div className="rounded-xl bg-white border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                        <MessageSquare className="h-5 w-5 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {stats?.totalResponses || 0}
                        </p>
                        <p className="text-xs text-slate-500">Total Responses</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                        <Users className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {stats?.uniqueRespondents || 0}
                        </p>
                        <p className="text-xs text-slate-500">Respondents</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                        <TrendingUp className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {stats?.completionRate.toFixed(0) || 0}%
                        </p>
                        <p className="text-xs text-slate-500">Completion Rate</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                        <FileText className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {enrollments.length}
                        </p>
                        <p className="text-xs text-slate-500">Enrolled</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="p-6 border-b border-slate-200 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Filters:</span>
                </div>

                <select
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">All Videos</option>
                  {Object.entries(videos).map(([id, video]) => (
                    <option key={id} value={id}>{video.title}</option>
                  ))}
                </select>

                <select
                  value={selectedQuestionType}
                  onChange={(e) => setSelectedQuestionType(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">All Question Types</option>
                  <option value="perception">Perception</option>
                  <option value="intent">Intent</option>
                  <option value="qualitative">Qualitative</option>
                </select>

                <button
                  onClick={() => setShowAnonymous(!showAnonymous)}
                  className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition ${
                    showAnonymous
                      ? 'border-violet-200 bg-violet-50 text-violet-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {showAnonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showAnonymous ? 'Anonymous Mode' : 'Show User IDs'}
                </button>

                <div className="flex-1" />

                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>

              {/* Responses by Question */}
              <div className="p-6 space-y-4">
                {Object.entries(responsesByQuestion).length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">No responses yet</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Responses will appear here once participants complete the campaign
                    </p>
                  </div>
                ) : (
                  Object.entries(responsesByQuestion).map(([questionId, questionResponses]) => {
                    const question = questionMap[questionId];
                    const isExpanded = expandedQuestions.has(questionId);
                    const isLikert = question?.type === 'perception' || question?.type === 'intent';
                    const likertDistribution = stats?.responsesByQuestion[questionId]?.likertDistribution;
                    const avgScore = stats?.averageLikertScores[questionId];

                    return (
                      <div
                        key={questionId}
                        className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                      >
                        <button
                          onClick={() => toggleQuestion(questionId)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                question?.type === 'perception'
                                  ? 'bg-sky-100 text-sky-700'
                                  : question?.type === 'intent'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {question?.type || 'Unknown'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {question?.videoTitle}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">
                              {question?.statement || questionId}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 ml-4">
                            <div className="text-right">
                              <p className="text-lg font-semibold text-slate-900">
                                {questionResponses.length}
                              </p>
                              <p className="text-xs text-slate-500">responses</p>
                            </div>
                            {isLikert && avgScore && (
                              <div className="text-right">
                                <p className="text-lg font-semibold text-sky-600">
                                  {avgScore.toFixed(1)}
                                </p>
                                <p className="text-xs text-slate-500">avg score</p>
                              </div>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-100 p-4 bg-slate-50">
                            {isLikert && likertDistribution ? (
                              <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-3">
                                  Response Distribution (1-7 Scale)
                                </h4>
                                {renderLikertChart(likertDistribution)}
                              </div>
                            ) : (
                              <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-3">
                                  Text Responses ({questionResponses.length})
                                </h4>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {questionResponses.map((r, idx) => (
                                    <div
                                      key={r.id || idx}
                                      className="rounded-lg bg-white border border-slate-200 p-3"
                                    >
                                      <p className="text-sm text-slate-700">{String(r.answer)}</p>
                                      <p className="text-xs text-slate-400 mt-2">
                                        {showAnonymous ? 'Anonymous' : r.userId.slice(0, 8) + '...'} •{' '}
                                        {new Date(r.answeredAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

