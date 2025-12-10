import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, MessageSquare, Video as VideoIcon, Users } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import AICopilot from '@/components/shared/AICopilot';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignResponses, getUserCampaignResponses, getCampaign, getVideo } from '@/lib/firestore';
import { getTopWords, getUserWordMatches } from '@/lib/textProcessing';
import MobilePeerComparison from './MobilePeerComparison';

interface ComparisonData {
  questionId: string;
  question: string;
  userAnswer: string | number | boolean;
  answerDistribution: Record<string | number, number>;
  totalResponses: number;
  videoId?: string;
  type?: 'behavioral-perception' | 'behavioral-intent' | 'qualitative' | 'scale' | 'multiple-choice' | 'text';
  textResponses?: string[]; // For qualitative questions - all responses for word cloud
}

interface VideoGroup {
  videoId: string;
  videoTitle: string;
  comparisons: ComparisonData[];
}

interface PeerComparisonProps {
  campaignIdOverride?: string;
  embedded?: boolean;
}

// ============================================================================
// CHART COMPONENTS (using Recharts)
// ============================================================================

// Custom tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-white text-sm font-medium">{payload[0].value} responses</p>
        <p className="text-white/50 text-xs">{payload[0].payload.percentage}% of total</p>
      </div>
    );
  }
  return null;
};

/**
 * Likert Distribution Chart - Shows frequency distribution for 1-7 scale questions
 * Uses Recharts BarChart to show how responses are distributed across the scale
 */
const LikertDistributionChart = ({
  distribution,
  userAnswer,
  totalResponses
}: {
  distribution: Record<string, number>;
  userAnswer: number;
  totalResponses: number;
}) => {
  // Prepare data for Recharts
  const chartData = [1, 2, 3, 4, 5, 6, 7].map(val => {
    const count = distribution[String(val)] || 0;
    const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
    return {
      scale: val,
      count,
      percentage,
      isUser: val === userAnswer
    };
  });

  // Calculate where user stands
  const userPercentage = chartData.find(d => d.isUser)?.percentage || 0;
  const mostCommon = chartData.reduce((max, d) => d.count > max.count ? d : max, chartData[0]);

  // Generate explanation
  const getExplanation = () => {
    if (userAnswer === mostCommon.scale) {
      return `Your response (${userAnswer}) aligns with the majority. ${userPercentage}% of your colleagues responded the same way.`;
    } else if (userPercentage >= 20) {
      return `Your response (${userAnswer}) is a common perspective, shared by ${userPercentage}% of colleagues. Most people chose ${mostCommon.scale} (${mostCommon.percentage}%).`;
    } else if (userPercentage > 0) {
      return `Your response (${userAnswer}) represents a unique perspective (${userPercentage}%). The most common response was ${mostCommon.scale} (${mostCommon.percentage}%).`;
    } else {
      return `You chose ${userAnswer}. The most common response was ${mostCommon.scale} (${mostCommon.percentage}%).`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="scale"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isUser ? '#00A3FF' : 'rgba(255,255,255,0.2)'}
                />
              ))}
              <LabelList
                dataKey="percentage"
                position="top"
                formatter={(value) => typeof value === 'number' && value > 0 ? `${value}%` : ''}
                fill="rgba(255,255,255,0.5)"
                fontSize={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#00A3FF]" />
          <span className="text-white/70">Your response ({userAnswer})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-white/20" />
          <span className="text-white/50">Team responses</span>
        </div>
        <span className="text-white/40 ml-auto">{totalResponses} total</span>
      </div>

      {/* Explanation */}
      <p className="text-sm text-white/50 leading-relaxed">
        {getExplanation()}
      </p>
    </div>
  );
};

/**
 * Choice Distribution Chart - Shows horizontal bar distribution for multiple choice
 * Uses Recharts horizontal BarChart to show response distribution
 */
const ChoiceDistributionChart = ({
  distribution,
  userAnswer,
  totalResponses
}: {
  distribution: Record<string, number>;
  userAnswer: string;
  totalResponses: number;
}) => {
  // Prepare data for Recharts (sorted by count, limited to top 6)
  const chartData = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([option, count]) => {
      const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
      const isUser = String(option) === String(userAnswer);
      // Truncate long option labels
      const label = option.length > 40 ? `${option.substring(0, 40)}...` : option;
      return {
        option: label,
        fullOption: option,
        count,
        percentage,
        isUser
      };
    });

  const userEntry = chartData.find(d => d.isUser);
  const userPercentage = userEntry?.percentage || 0;
  const mostCommon = chartData[0];

  // Generate explanation
  const getExplanation = () => {
    if (userEntry && userEntry === mostCommon) {
      return `Your choice is the most popular option, selected by ${userPercentage}% of your colleagues.`;
    } else if (userPercentage >= 25) {
      return `${userPercentage}% of colleagues made the same choice as you. This is a common perspective within your team.`;
    } else if (userPercentage > 0) {
      return `Your choice represents ${userPercentage}% of responses. The most common choice was selected by ${mostCommon?.percentage}% of colleagues.`;
    } else {
      return `The most common choice was selected by ${mostCommon?.percentage}% of colleagues.`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div style={{ height: Math.max(chartData.length * 45 + 20, 150) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="option"
              tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={150}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isUser ? '#00A3FF' : 'rgba(255,255,255,0.25)'}
                />
              ))}
              <LabelList
                dataKey="percentage"
                position="right"
                formatter={(value) => typeof value === 'number' ? `${value}%` : ''}
                fill="rgba(255,255,255,0.6)"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#00A3FF]" />
          <span className="text-white/70">Your choice</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-white/25" />
          <span className="text-white/50">Other choices</span>
        </div>
        <span className="text-white/40 ml-auto">{totalResponses} total</span>
      </div>

      {/* Explanation */}
      <p className="text-sm text-white/50 leading-relaxed">
        {getExplanation()}
      </p>
    </div>
  );
};

/**
 * Word Cloud Visualization - Shows common themes from text responses
 * Highlights words that appear in user's response
 */
const WordCloudViz = ({
  allResponses,
  userResponse
}: {
  allResponses: string[];
  userResponse: string;
}) => {
  const topWords = useMemo(() => getTopWords(allResponses, 20), [allResponses]);
  const userMatches = useMemo(
    () => getUserWordMatches(userResponse, topWords),
    [userResponse, topWords]
  );
  const maxCount = Math.max(...topWords.map(w => w.count), 1);
  const matchCount = userMatches.size;
  const matchPercentage = topWords.length > 0 ? Math.round((matchCount / topWords.length) * 100) : 0;

  if (topWords.length === 0) {
    return (
      <div className="text-center py-8 text-white/40 text-sm">
        Gathering response themes...
      </div>
    );
  }

  // Generate explanation
  const getExplanation = () => {
    if (matchCount === 0) {
      return `Your response uses different language than most colleagues. The most common themes focus on: ${topWords.slice(0, 3).map(w => w.word).join(', ')}.`;
    } else if (matchPercentage >= 50) {
      return `Your response shares ${matchCount} common themes with your colleagues (${matchPercentage}% alignment). You're using similar language to describe your perspective.`;
    } else {
      return `Your response includes ${matchCount} of the ${topWords.length} most common themes. You share some perspectives while bringing unique viewpoints.`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Word cloud */}
      <div className="flex flex-wrap gap-2 justify-center py-4 min-h-[100px]">
        {topWords.map(({ word, count }) => {
          const isUserWord = userMatches.has(word);
          // Scale font size: 12px to 22px based on frequency
          const fontSize = 12 + (count / maxCount) * 10;

          return (
            <motion.span
              key={word}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`px-3 py-1.5 rounded-full transition-all cursor-default ${
                isUserWord
                  ? 'bg-[#00A3FF]/20 text-[#00A3FF] border border-[#00A3FF]/30 font-medium'
                  : 'bg-white/10 text-white/60 hover:bg-white/15'
              }`}
              style={{ fontSize: `${fontSize}px` }}
              title={`Used by ${count} ${count === 1 ? 'person' : 'people'}`}
            >
              {word}
            </motion.span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2 text-white/50">
          <div className="w-3 h-3 rounded-full bg-[#00A3FF]/20 border border-[#00A3FF]/30" />
          <span>In your response ({matchCount})</span>
        </div>
        <div className="flex items-center gap-2 text-white/50">
          <div className="w-3 h-3 rounded-full bg-white/10" />
          <span>Common themes ({topWords.length - matchCount})</span>
        </div>
      </div>

      {/* Explanation */}
      <p className="text-sm text-white/50 leading-relaxed text-center">
        {getExplanation()}
      </p>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PeerComparison: React.FC<PeerComparisonProps> = ({ campaignIdOverride, embedded = false }) => {
  const { moduleId: moduleIdFromRoute } = useParams();
  const moduleId = campaignIdOverride || moduleIdFromRoute;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const [comparisonGroups, setComparisonGroups] = useState<VideoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>('Campaign');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Set selected video to first module when data loads
  useEffect(() => {
    if (comparisonGroups.length > 0 && !selectedVideoId) {
      setSelectedVideoId(comparisonGroups[0].videoId);
    }
  }, [comparisonGroups, selectedVideoId]);

  useEffect(() => {
    const loadComparisonData = async () => {
      if (!moduleId || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        // 1. Load campaign
        const campaign = await getCampaign(moduleId);
        if (!campaign) throw new Error('Campaign not found');
        setCampaignTitle(campaign.title);

        // 2. Collect Video IDs
        const videoIds = new Set<string>();
        campaign.items.forEach(item => videoIds.add(item.videoId));

        // 3. Fetch Videos and Build Question Map
        const questionMap = new Map<string, { text: string; videoId: string; type?: string }>();
        const videoTitleMap = new Map<string, string>();

        await Promise.all(
          Array.from(videoIds).map(async (vid) => {
            try {
              const video = await getVideo(vid);
              if (video) {
                videoTitleMap.set(vid, video.title);
                video.questions?.forEach(q => {
                  questionMap.set(q.id, {
                    text: q.statement || 'Question',
                    videoId: vid,
                    type: q.type
                  });
                });
              }
            } catch (e) {
              console.warn(`Failed to load video ${vid}`, e);
            }
          })
        );

        // Fallback for legacy items
        campaign.items.forEach(item => {
          item.questions?.forEach(q => {
            if (!questionMap.has(q.id)) {
              questionMap.set(q.id, { text: q.question, videoId: item.videoId });
            }
          });
        });

        // 4. Load Responses
        const allResponses = await getCampaignResponses(moduleId, user.organization);
        const userResponsesRaw = await getUserCampaignResponses(moduleId, user.id);

        // Deduplicate user responses - keep only the most recent answer per question
        const userResponsesMap = new Map<string, any>();
        userResponsesRaw.forEach(response => {
          const existing = userResponsesMap.get(response.questionId);
          if (!existing || response.answeredAt > existing.answeredAt) {
            userResponsesMap.set(response.questionId, response);
          }
        });
        const userResponses = Array.from(userResponsesMap.values());

        // 5. Filter responses by User Role (Applicant vs Employee)
        if (!user.organization) {
          console.warn('User has no organization, skipping role filtering');
          return;
        }
        const { getUsersByOrganization } = await import('@/lib/firestore');
        const orgUsers = await getUsersByOrganization(user.organization);
        const userRoleMap = new Map<string, string>();
        orgUsers.forEach((u: any) => userRoleMap.set(u.id, u.role || 'employee'));

        const currentUserRole = (user as any).role || 'employee';

        // Filter responses: Only include responses from users with the SAME role
        const relevantResponses = allResponses.filter(r => {
          const responderRole = userRoleMap.get(r.userId) || 'employee';
          return responderRole === currentUserRole;
        });

        // 6. Group filtered responses
        const responsesByQuestion = new Map<string, any[]>();
        relevantResponses.forEach(response => {
          const existing = responsesByQuestion.get(response.questionId) || [];
          existing.push(response);
          responsesByQuestion.set(response.questionId, existing);
        });

        // 7. Build Comparison Data
        const comparisonData: ComparisonData[] = [];

        userResponses.forEach(userResponse => {
          const questionId = userResponse.questionId;
          const allQuestionResponses = responsesByQuestion.get(questionId) || [];
          const questionInfo = questionMap.get(questionId);

          const distribution: Record<string | number, number> = {};
          const textResponses: string[] = [];

          allQuestionResponses.forEach(r => {
            const answer = String(r.answer);
            distribution[answer] = (distribution[answer] || 0) + 1;

            // Collect text responses for qualitative questions
            if (questionInfo?.type === 'qualitative' || questionInfo?.type === 'text') {
              textResponses.push(String(r.answer));
            }
          });

          comparisonData.push({
            questionId,
            question: questionInfo?.text || userResponse.metadata?.questionText || 'Question',
            userAnswer: userResponse.answer,
            answerDistribution: distribution,
            totalResponses: allQuestionResponses.length,
            videoId: userResponse.videoId || questionInfo?.videoId,
            type: questionInfo?.type as any,
            textResponses: textResponses.length > 0 ? textResponses : undefined
          });
        });

        // 8. Group by Video
        const groups: VideoGroup[] = [];
        const comparisonsByVideo = new Map<string, ComparisonData[]>();

        comparisonData.forEach(comp => {
          const vid = comp.videoId || 'unknown';
          const existing = comparisonsByVideo.get(vid) || [];
          existing.push(comp);
          comparisonsByVideo.set(vid, existing);
        });

        // Create groups for ALL campaign videos (in campaign order)
        // Include modules even if user hasn't completed them yet
        Array.from(videoIds).forEach(vid => {
          const comps = comparisonsByVideo.get(vid) || [];
          groups.push({
            videoId: vid,
            videoTitle: videoTitleMap.get(vid) || 'Untitled Video',
            comparisons: comps // May be empty if user hasn't answered yet
          });
        });

        // Add unknown group at the end if any
        const unknownComps = comparisonsByVideo.get('unknown');
        if (unknownComps && unknownComps.length > 0) {
          groups.push({
            videoId: 'unknown',
            videoTitle: 'Other Questions',
            comparisons: unknownComps
          });
        }

        setComparisonGroups(groups);
        setIsLoading(false);

      } catch (error) {
        console.error('[PeerComparison] Failed to load comparison data:', error);
        setLoadError('Failed to load peer comparison data');
        setIsLoading(false);
      }
    };

    loadComparisonData();
  }, [moduleId, user]);

  // Filter groups based on selected video (desktop sidebar selection)
  const filteredGroups = useMemo(() => {
    if (!selectedVideoId) return comparisonGroups;
    return comparisonGroups.filter(g => g.videoId === selectedVideoId);
  }, [comparisonGroups, selectedVideoId]);

  // Calculate summary stats (neutral - no scoring)
  const summaryStats = useMemo(() => {
    let totalQuestions = 0;
    let maxResponses = 0;

    filteredGroups.forEach(group => {
      totalQuestions += group.comparisons.length;
      group.comparisons.forEach(comp => {
        if (comp.totalResponses > maxResponses) {
          maxResponses = comp.totalResponses;
        }
      });
    });

    return { totalQuestions, totalResponses: maxResponses };
  }, [filteredGroups]);

  // Determine chart type and render appropriate visualization
  const renderQuestionVisualization = (comparison: ComparisonData) => {
    const hasEnoughData = comparison.totalResponses >= 3;

    if (!hasEnoughData) {
      return (
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <p className="text-white/60 text-sm">
            Your response: <span className="text-white font-medium">{String(comparison.userAnswer)}</span>
          </p>
          <p className="text-white/40 text-xs mt-2">
            Gathering more perspectives ({comparison.totalResponses}/3 needed)
          </p>
        </div>
      );
    }

    // Q2: Multiple Choice (behavioral-intent) - bar chart
    // Check this FIRST because behavioral-intent stores intentScore (1-7) as answer
    // which would otherwise be detected as a Likert scale
    if (comparison.type === 'behavioral-intent' || comparison.type === 'multiple-choice') {
      return (
        <ChoiceDistributionChart
          distribution={comparison.answerDistribution}
          userAnswer={String(comparison.userAnswer)}
          totalResponses={comparison.totalResponses}
        />
      );
    }

    // Q3: Text/Qualitative - word cloud
    if (comparison.type === 'qualitative' || comparison.type === 'text') {
      return (
        <WordCloudViz
          allResponses={comparison.textResponses || [String(comparison.userAnswer)]}
          userResponse={String(comparison.userAnswer)}
        />
      );
    }

    // Q1: Likert Scale (behavioral-perception) - numeric 1-7
    // This is checked last as a fallback for numeric answers
    const isLikertScale =
      comparison.type === 'behavioral-perception' ||
      comparison.type === 'scale' ||
      (typeof comparison.userAnswer === 'number' &&
        comparison.userAnswer >= 1 &&
        comparison.userAnswer <= 7);

    if (isLikertScale) {
      return (
        <LikertDistributionChart
          distribution={comparison.answerDistribution}
          userAnswer={Number(comparison.userAnswer)}
          totalResponses={comparison.totalResponses}
        />
      );
    }

    // Default fallback - treat as choice distribution
    return (
      <ChoiceDistributionChart
        distribution={comparison.answerDistribution}
        userAnswer={String(comparison.userAnswer)}
        totalResponses={comparison.totalResponses}
      />
    );
  };

  const containerClasses = 'min-h-screen bg-[#050608] pb-20 text-white';

  // Skeleton loading component
  const renderSkeletonLoading = () => (
    <div className="flex flex-1">
      {/* Sidebar Skeleton */}
      <aside className="w-80 flex-shrink-0 border-r border-white/5 p-6">
        <Skeleton className="h-4 w-20 mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Summary Card Skeleton */}
          <div className="bg-white/5 border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-5">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center space-y-1">
                  <Skeleton className="h-6 w-8 mx-auto" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="text-center space-y-1 border-l border-white/10 pl-6">
                  <Skeleton className="h-6 w-8 mx-auto" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          </div>

          {/* Module Title Skeleton */}
          <Skeleton className="h-6 w-36 mt-4" />

          {/* Question Cards Skeleton */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
              {/* Question Header */}
              <div className="px-5 py-4 border-b border-white/5">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-6 h-6 rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
              {/* Chart Area */}
              <div className="p-5 space-y-4">
                <div className="h-48 flex items-end gap-2">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Skeleton
                      key={j}
                      className="flex-1 rounded-t"
                      style={{ height: `${Math.random() * 60 + 30}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-3 rounded" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-3 rounded" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  if (isLoading) {
    return embedded ? (
      <div className="hidden lg:flex flex-1 bg-[#050608]">
        {renderSkeletonLoading()}
      </div>
    ) : (
      <div className={containerClasses}>
        {renderSkeletonLoading()}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${containerClasses} flex items-center justify-center px-6 min-h-[200px]`}>
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4 text-white">Unable to Load Data</h1>
          <p className="text-white/50 mb-6">{loadError}</p>
          {!embedded && (
            <button onClick={() => navigate('/employee/home')} className="px-6 py-2.5 rounded-xl bg-[#00A3FF] text-white hover:bg-[#00A3FF]/90 transition">
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderComparisonContent = () => (
    <div className="space-y-6">
      {/* Summary Card - Neutral (no scoring) */}
      {filteredGroups.length > 0 && filteredGroups[0].comparisons.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/5 rounded-xl p-5"
        >
          <div className="flex items-center gap-5">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Users size={24} className="text-white/60" />
            </div>

            {/* Title */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">Response Distribution</h2>
              <p className="text-sm text-white/50">
                Compare perspectives with your colleagues
              </p>
            </div>

            {/* Stats - Neutral */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{summaryStats.totalQuestions}</p>
                <p className="text-xs text-white/40">Questions</p>
              </div>
              <div className="text-center border-l border-white/10 pl-6">
                <p className="text-xl font-bold text-white">{summaryStats.totalResponses}</p>
                <p className="text-xs text-white/40">Peer Responses</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State - No modules at all */}
      {filteredGroups.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 border border-white/5 rounded-xl p-8 text-center"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Users size={24} className="text-white/40" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold text-white">Gathering Perspectives</h3>
              <p className="text-sm text-white/50">Waiting for more teammates to respond</p>
            </div>
          </div>
          {!embedded && (
            <button
              onClick={() => navigate('/employee/learn')}
              className="px-6 py-2 bg-white/10 text-white text-sm font-medium rounded-xl hover:bg-white/15 transition"
            >
              Back to Learning
            </button>
          )}
        </motion.div>
      )}

      {/* Empty State - Module selected but not completed by user */}
      {filteredGroups.length > 0 && filteredGroups[0].comparisons.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 border border-white/5 rounded-xl p-8"
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
              <Play size={28} className="text-white/40" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Module Not Completed</h3>
              <p className="text-sm text-white/50 max-w-sm">
                Complete this module to see how your responses compare with your colleagues.
              </p>
            </div>
            {!embedded && (
              <button
                onClick={() => navigate('/employee/learn')}
                className="mt-2 px-6 py-2.5 bg-[#00A3FF] text-white text-sm font-medium rounded-xl hover:bg-[#00A3FF]/90 transition"
              >
                Go to Learning
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Question Cards with Module Titles */}
      <AnimatePresence>
        {filteredGroups
          .filter(group => group.comparisons.length > 0)
          .map((group, groupIdx) => (
            <div key={group.videoId} className="space-y-4">
              {/* Module Title - simple heading, no container */}
              <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lg font-semibold text-white pt-2"
              >
                {group.videoTitle}
              </motion.h3>

              {/* Questions for this module */}
              {group.comparisons.map((comparison, idx) => (
                <motion.div
                  key={comparison.questionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * idx }}
                  className="bg-white/5 border border-white/5 rounded-xl overflow-hidden"
                >
                  {/* Question Header */}
                  <div className="px-5 py-4 border-b border-white/5">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-medium text-white/60">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-white/80 leading-relaxed">{comparison.question}</p>
                    </div>
                  </div>

                  {/* Visualization */}
                  <div className="p-5">
                    {renderQuestionVisualization(comparison)}
                  </div>
                </motion.div>
              ))}
            </div>
          ))}
      </AnimatePresence>

      {/* AI Copilot Prompt */}
      {filteredGroups.length > 0 && filteredGroups[0].comparisons.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center gap-4"
        >
          <MessageSquare size={16} className="text-white/30 flex-shrink-0" />
          <p className="text-sm text-white/50 flex-1">Need help understanding your responses?</p>
          <div className="flex gap-2">
            {['Explore themes', 'Understand perspectives'].map((q, i) => (
              <button
                key={i}
                onClick={() => setIsCopilotOpen(true)}
                className="px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Footer Action */}
      {!embedded && filteredGroups.length > 0 && filteredGroups[0].comparisons.length > 0 && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => navigate('/employee/home')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-[#00A3FF] text-white font-medium hover:bg-[#00A3FF]/90 rounded-xl transition"
          >
            <Play size={16} />
            Continue Learning
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden">
        <MobilePeerComparison campaignIdOverride={campaignIdOverride} embedded={embedded} />
      </div>

      {/* Desktop View */}
      {embedded ? (
        <div className="hidden lg:flex flex-1 bg-[#050608]">
          {/* Sidebar - Module Selection (Embedded) */}
          <aside className="w-80 flex-shrink-0 border-r border-white/5 p-6 overflow-y-auto">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/40 px-3 mb-4">Modules</p>

              {comparisonGroups.map((group) => {
                const hasData = group.comparisons.length > 0;
                const isSelected = selectedVideoId === group.videoId;

                return (
                  <button
                    key={group.videoId}
                    onClick={() => setSelectedVideoId(group.videoId)}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-all ${
                      isSelected
                        ? 'bg-white/10 text-white'
                        : hasData
                          ? 'text-white/60 hover:text-white hover:bg-white/5'
                          : 'text-white/30 hover:bg-white/5 cursor-pointer'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-[#00A3FF]/20' : hasData ? 'bg-white/10' : 'bg-white/5'
                    }`}>
                      <VideoIcon size={20} className={isSelected ? 'text-[#00A3FF]' : hasData ? 'text-white/40' : 'text-white/20'} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className={`block truncate text-sm ${!hasData && 'text-white/40'}`}>{group.videoTitle}</span>
                      <p className="text-xs text-white/40">
                        {hasData ? `${group.comparisons.length} questions` : 'Not yet completed'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
              {renderComparisonContent()}
            </div>
          </main>

          {isCopilotOpen && (
            <AICopilot
              isOpen={isCopilotOpen}
              onClose={() => setIsCopilotOpen(false)}
              context={{ userRole: 'employee' }}
            />
          )}
        </div>
      ) : (
        /* Non-embedded desktop view */
        <div className="hidden lg:flex flex-1 bg-[#050608]">
          <aside className="w-80 flex-shrink-0 border-r border-white/5 p-6 overflow-y-auto">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-5"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">Back</span>
            </button>

            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/40 px-3 mb-4">Modules</p>

              {comparisonGroups.map((group) => {
                const hasData = group.comparisons.length > 0;
                const isSelected = selectedVideoId === group.videoId;

                return (
                  <button
                    key={group.videoId}
                    onClick={() => setSelectedVideoId(group.videoId)}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-all ${
                      isSelected
                        ? 'bg-white/10 text-white'
                        : hasData
                          ? 'text-white/60 hover:text-white hover:bg-white/5'
                          : 'text-white/30 hover:bg-white/5 cursor-pointer'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-[#00A3FF]/20' : hasData ? 'bg-white/10' : 'bg-white/5'
                    }`}>
                      <VideoIcon size={20} className={isSelected ? 'text-[#00A3FF]' : hasData ? 'text-white/40' : 'text-white/20'} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <span className={`block truncate text-sm ${!hasData && 'text-white/40'}`}>{group.videoTitle}</span>
                      <p className="text-xs text-white/40">
                        {hasData ? `${group.comparisons.length} questions` : 'Not yet completed'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
              {renderComparisonContent()}
            </div>
          </main>

          {isCopilotOpen && (
            <AICopilot
              isOpen={isCopilotOpen}
              onClose={() => setIsCopilotOpen(false)}
              context={{ userRole: 'employee' }}
            />
          )}
        </div>
      )}
    </>
  );
};

export default PeerComparison;
