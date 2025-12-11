import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Users, Video as VideoIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignResponses, getUserCampaignResponses, getCampaign, getVideo } from '@/lib/firestore';
import AICopilot from '@/components/shared/AICopilot';

interface ComparisonData {
  questionId: string;
  question: string;
  userAnswer: string | number | boolean;
  answerDistribution: Record<string | number, number>;
  totalResponses: number;
  isUserInMajority: boolean;
  videoId?: string;
  type?: 'scale' | 'multiple-choice' | 'text' | 'behavioral-intent' | 'behavioral-perception' | 'qualitative';
  averageScore?: number;
  // Q2 (behavioral-intent) specific: map option ID to letter label + text for legend
  optionLabels?: Record<string, { letter: string; text: string }>;
}

interface VideoGroup {
  videoId: string;
  videoTitle: string;
  comparisons: ComparisonData[];
  userAverage?: number;
  communityAverage?: number;
}

interface MobilePeerComparisonProps {
  campaignIdOverride?: string;
  embedded?: boolean;
}

const MobilePeerComparison: React.FC<MobilePeerComparisonProps> = ({
  campaignIdOverride,
  embedded = false
}) => {
  const { moduleId: moduleIdFromRoute } = useParams();
  const moduleId = campaignIdOverride || moduleIdFromRoute;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const [comparisonGroups, setComparisonGroups] = useState<VideoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>('Campaign');


  useEffect(() => {
    const loadComparisonData = async () => {
      if (!moduleId || !user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const campaign = await getCampaign(moduleId);
        if (!campaign) throw new Error('Campaign not found');
        setCampaignTitle(campaign.title);

        const videoIds = new Set<string>();
        campaign.items.forEach(item => videoIds.add(item.videoId));

        // Use composite key (videoId_questionId) to handle same questionIds across different videos
        const questionMap = new Map<string, {
          text: string;
          videoId: string;
          questionId: string;
          type?: string;
          options?: Array<{ id: string; text: string; intentScore: number }>;
        }>();
        const videoTitleMap = new Map<string, string>();

        await Promise.all(
          Array.from(videoIds).map(async (vid) => {
            try {
              const video = await getVideo(vid);
              if (video) {
                videoTitleMap.set(vid, video.title);
                video.questions?.forEach(q => {
                  const compositeKey = `${vid}_${q.id}`;
                  questionMap.set(compositeKey, {
                    text: q.statement || 'Question',
                    videoId: vid,
                    questionId: q.id,
                    type: q.type,
                    // Store options for Q2 behavioral-intent questions
                    options: q.type === 'behavioral-intent' ? q.options : undefined
                  });
                });
              }
            } catch (e) {
              console.warn(`Failed to load video ${vid}`, e);
            }
          })
        );

        campaign.items.forEach(item => {
          item.questions?.forEach(q => {
            const compositeKey = `${item.videoId}_${q.id}`;
            if (!questionMap.has(compositeKey)) {
              questionMap.set(compositeKey, { text: q.question, videoId: item.videoId, questionId: q.id });
            }
          });
        });

        const allResponses = await getCampaignResponses(moduleId, user.organization);
        const userResponsesRaw = await getUserCampaignResponses(moduleId, user.id);

        // Deduplicate user responses using composite key (videoId_questionId)
        const userResponsesMap = new Map<string, any>();
        userResponsesRaw.forEach(response => {
          const compositeKey = `${response.videoId}_${response.questionId}`;
          const existing = userResponsesMap.get(compositeKey);
          if (!existing || response.answeredAt > existing.answeredAt) {
            userResponsesMap.set(compositeKey, response);
          }
        });
        const userResponses = Array.from(userResponsesMap.values());

        // Group responses using composite key (videoId_questionId)
        const responsesByQuestion = new Map<string, any[]>();
        allResponses.forEach(response => {
          const compositeKey = `${response.videoId}_${response.questionId}`;
          const existing = responsesByQuestion.get(compositeKey) || [];
          existing.push(response);
          responsesByQuestion.set(compositeKey, existing);
        });

        const comparisonData: ComparisonData[] = [];

        userResponses.forEach(userResponse => {
          const questionId = userResponse.questionId;
          const videoId = userResponse.videoId;
          const compositeKey = `${videoId}_${questionId}`;

          // Use composite key for lookups
          const allQuestionResponses = responsesByQuestion.get(compositeKey) || [];
          const questionInfo = questionMap.get(compositeKey);

          // Show comparison if there's at least 1 other response (2 total = user + 1 peer)
          if (allQuestionResponses.length < 2) return;

          const distribution: Record<string | number, number> = {};
          let totalScore = 0;
          let countNumeric = 0;
          let optionLabels: Record<string, { letter: string; text: string }> | undefined;

          // For Q2 (behavioral-intent), use selectedOptionId to build distribution with letter labels
          const isQ2 = questionInfo?.type === 'behavioral-intent';

          if (isQ2 && questionInfo?.options) {
            // Build option ID -> letter label mapping (A, B, C, etc.)
            optionLabels = {};
            questionInfo.options.forEach((opt, idx) => {
              const letter = String.fromCharCode(65 + idx); // A, B, C, ...
              optionLabels![opt.id] = { letter, text: opt.text };
            });

            // Build distribution using letter labels
            allQuestionResponses.forEach(r => {
              const optionId = r.selectedOptionId;
              if (optionId && optionLabels![optionId]) {
                const letter = optionLabels![optionId].letter;
                distribution[letter] = (distribution[letter] || 0) + 1;
              }
            });
          } else {
            // For Q1 and Q3, use answer directly
            allQuestionResponses.forEach(r => {
              const answer = String(r.answer);
              distribution[answer] = (distribution[answer] || 0) + 1;

              const numVal = parseFloat(String(r.answer));
              if (!isNaN(numVal)) {
                totalScore += numVal;
                countNumeric++;
              }
            });
          }

          const sortedAnswers = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
          const mostCommonAnswer = sortedAnswers[0]?.[0];
          
          // For Q2, convert user's selectedOptionId to letter label
          let userAnswer: string | number | boolean = userResponse.answer;
          if (isQ2 && userResponse.selectedOptionId && optionLabels) {
            const userOptLabel = optionLabels[userResponse.selectedOptionId];
            if (userOptLabel) {
              userAnswer = userOptLabel.letter;
            }
          }
          
          const userAnswerStr = String(userAnswer);
          const isUserInMajority = userAnswerStr === mostCommonAnswer;

          comparisonData.push({
            questionId,
            question: questionInfo?.text || userResponse.metadata?.questionText || 'Question',
            userAnswer,
            answerDistribution: distribution,
            totalResponses: allQuestionResponses.length,
            isUserInMajority,
            videoId: videoId, // Use videoId from user response directly
            type: (questionInfo?.type as any) || (typeof userResponse.answer === 'number' ? 'scale' : 'multiple-choice'),
            averageScore: countNumeric > 0 ? totalScore / countNumeric : undefined,
            optionLabels: isQ2 ? optionLabels : undefined
          });
        });

        const groups: VideoGroup[] = [];
        const comparisonsByVideo = new Map<string, ComparisonData[]>();

        comparisonData.forEach(comp => {
          const vid = comp.videoId || 'unknown';
          const existing = comparisonsByVideo.get(vid) || [];
          existing.push(comp);
          comparisonsByVideo.set(vid, existing);
        });

        Array.from(videoIds).forEach(vid => {
          const comps = comparisonsByVideo.get(vid);
          if (comps && comps.length > 0) {
            let userSum = 0;
            let commSum = 0;
            let count = 0;

            comps.forEach(c => {
              if (c.averageScore !== undefined && typeof c.userAnswer === 'number') {
                userSum += c.userAnswer;
                commSum += c.averageScore;
                count++;
              }
            });

            groups.push({
              videoId: vid,
              videoTitle: videoTitleMap.get(vid) || 'Untitled Video',
              comparisons: comps,
              userAverage: count > 0 ? userSum / count : undefined,
              communityAverage: count > 0 ? commSum / count : undefined
            });
          }
        });

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

  // Render Q2 pie chart for behavioral-intent questions
  const renderQ2PieChart = (comparison: ComparisonData) => {
    if (!comparison.optionLabels) return null;

    const distribution = comparison.answerDistribution;
    const userAnswer = String(comparison.userAnswer);
    const totalResponses = comparison.totalResponses;

    // Build pie chart data
    const pieData = Object.entries(distribution).map(([letter, count]) => {
      const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
      const isUser = letter === userAnswer;
      const optionInfo = Object.values(comparison.optionLabels!).find(opt => opt.letter === letter);
      
      return {
        name: letter,
        value: count,
        percentage,
        isUser,
        text: optionInfo?.text || '',
        fill: isUser ? '#00A3FF' : `rgba(255,255,255,${0.2 + (count / totalResponses) * 0.3})`
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const colors = ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0.35)'];
    pieData.forEach((d, idx) => {
      if (!d.isUser) {
        d.fill = colors[idx % colors.length];
      }
    });

    const userSlice = pieData.find(d => d.isUser);

    return (
      <div className="space-y-4 mt-3">
        {/* Pie Chart */}
        <div className="h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={70}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} stroke={entry.isUser ? '#00A3FF' : 'transparent'} strokeWidth={entry.isUser ? 2 : 0} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 shadow-lg">
                        <p className="text-white text-sm font-medium">{data.name}: {data.value}</p>
                        <p className="text-white/50 text-xs">{data.percentage}%</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* "--you" label pointing to user's slice */}
          {userSlice && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="text-xs text-[#00A3FF] font-medium">--you</div>
            </div>
          )}
        </div>

        {/* Options List */}
        <div className="space-y-2">
          {pieData.map((data) => {
            const optionInfo = Object.values(comparison.optionLabels!).find(opt => opt.letter === data.name);
            return (
              <div key={data.name} className="flex items-start gap-2 text-sm">
                <span className={`font-semibold flex-shrink-0 ${data.isUser ? 'text-[#00A3FF]' : 'text-white/70'}`}>
                  {data.name}.
                </span>
                <span className={`line-clamp-2 flex-1 ${data.isUser ? 'text-white' : 'text-white/50'}`}>
                  {optionInfo?.text || ''}
                </span>
                <span className={`text-xs flex-shrink-0 ${data.isUser ? 'text-[#00A3FF]' : 'text-white/40'}`}>
                  {data.percentage}%
                </span>
              </div>
            );
        })}
      </div>
    </div>
    );
  };

  // Render bar chart for non-scale questions (non-Q2)
  const renderBarChart = (comparison: ComparisonData) => {
    const sortedAnswers = Object.entries(comparison.answerDistribution)
      .sort((a, b) => b[1] - a[1]);

    // Check if this is Q2 with letter labels
    const isQ2WithLabels = comparison.type === 'behavioral-intent' && comparison.optionLabels;

    return (
      <div className="space-y-3 mt-3">
        {sortedAnswers.map(([answer, count], idx) => {
          const percentage = Math.round((count / comparison.totalResponses) * 100);
          const isUserAnswer = String(answer) === String(comparison.userAnswer);

          // For Q2, find the option text for this letter
          let displayLabel = answer;
          if (isQ2WithLabels && comparison.optionLabels) {
            const optEntry = Object.values(comparison.optionLabels).find(
              opt => opt.letter === String(answer)
            );
            if (optEntry) {
              displayLabel = `${optEntry.letter}. ${optEntry.text}`;
            }
          }

          return (
            <div key={idx}>
              <div className="flex justify-between items-end mb-1 text-sm gap-2">
                <span className={`font-medium line-clamp-3 ${isUserAnswer ? 'text-[#00A3FF]' : 'text-white/70'}`}>
                  {displayLabel}
                </span>
                <span className="text-white/40 flex-shrink-0">{percentage}%</span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isUserAnswer ? 'bg-[#00A3FF]' : 'bg-white/20'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              {isUserAnswer && (
                <div className="text-[10px] text-[#00A3FF] font-bold mt-0.5">YOU</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render scale slider (Likert 1-7)
  const renderScaleSlider = (comparison: ComparisonData) => {
    const userScore = Number(comparison.userAnswer);
    const teamAvg = comparison.averageScore || 0;
    const maxScore = 7;

    return (
      <div className="mt-4 space-y-4">
        {/* Visual Scale */}
        <div className="relative h-3 bg-white/10 rounded-full overflow-visible">
          {/* Team average marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white/50 border-2 border-white/30"
            style={{ left: `calc(${(teamAvg / maxScore) * 100}% - 6px)` }}
          />
          {/* User score marker */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#00A3FF] border-2 border-white shadow-lg shadow-[#00A3FF]/30"
            initial={{ left: 0 }}
            animate={{ left: `calc(${(userScore / maxScore) * 100}% - 10px)` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between text-xs">
          <span className="text-white/40">1</span>
          <span className="text-white/40">2</span>
          <span className="text-white/40">3</span>
          <span className="text-white/40">4</span>
          <span className="text-white/40">5</span>
          <span className="text-white/40">6</span>
          <span className="text-white/40">7</span>
        </div>

        {/* Score comparison */}
        <div className="flex justify-between items-center pt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00A3FF]" />
            <span className="text-sm text-white">You: <span className="font-bold">{userScore.toFixed(1)}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white/50" />
            <span className="text-sm text-white/60">Team: <span className="font-medium">{teamAvg.toFixed(1)}</span></span>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        {!embedded && (
          <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-2 -ml-2">
                <ArrowLeft size={20} className="text-white" />
              </button>
              <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        )}
        <div className="p-4 space-y-4">
          <div className="h-40 bg-[#1a1a1a] rounded-2xl animate-pulse" />
          <div className="h-32 bg-[#1a1a1a] rounded-2xl animate-pulse" />
          <div className="h-32 bg-[#1a1a1a] rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-4 text-white">Unable to Load Data</h1>
          <p className="text-white/50 mb-6">{loadError}</p>
          {!embedded && (
            <button
              onClick={() => navigate('/employee/learn')}
              className="px-6 py-3 bg-white text-black font-semibold rounded-2xl"
            >
              Back to Learning
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24 lg:hidden">
      {/* Header */}
      {!embedded && (
        <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div>
              <h1 className="font-semibold text-white">Peer Comparison</h1>
              <p className="text-xs text-white/50">{campaignTitle}</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Summary Card - Mobile: Just Metrics */}
        {comparisonGroups.length > 0 && comparisonGroups[0].comparisons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/5 rounded-xl p-4"
          >
            <div className="flex items-center justify-center gap-6">
              <div className="text-center flex-1">
                <p className="text-2xl font-bold text-white">
                  {comparisonGroups.reduce((sum, g) => sum + g.comparisons.length, 0)}
                </p>
                <p className="text-xs text-white/40">Questions</p>
              </div>
              <div className="h-12 w-px bg-white/10" />
              <div className="text-center flex-1">
                <p className="text-2xl font-bold text-white">
                  {Math.max(...comparisonGroups.flatMap(g => g.comparisons.map(c => c.totalResponses)))}
                </p>
                <p className="text-xs text-white/40">Peer Responses</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {comparisonGroups.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] rounded-3xl p-8 text-center"
          >
            <motion.div
              className="relative inline-block mb-4"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
            >
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                <Users size={32} className="text-white/40" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-full border border-[#00A3FF]/30"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Gathering Insights
            </h3>
            <p className="text-sm text-white/50 max-w-xs mx-auto mb-6">
              Waiting for more teammates to complete this survey.
            </p>
            {!embedded && (
              <button
                onClick={() => navigate('/employee/learn')}
                className="px-6 py-3 bg-white/10 text-white font-medium rounded-2xl"
              >
                Back to Learning
              </button>
            )}
          </motion.div>
        )}

        {/* Comparison Groups */}
        <AnimatePresence>
          {comparisonGroups.map((group, groupIdx) => (
            <motion.div
              key={group.videoId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIdx * 0.1 }}
              className="space-y-3"
            >
              {/* Video Header */}
              <div className="flex items-center gap-2 px-1 pt-2">
                <VideoIcon size={16} className="text-[#00A3FF]" />
                <h2 className="font-semibold text-white text-sm">{group.videoTitle}</h2>
              </div>

              {/* Questions */}
              {group.comparisons.map((comparison, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className="bg-[#1a1a1a] rounded-2xl p-4"
                >
                  {/* Question Text */}
                  <p className="text-sm font-medium text-white leading-snug line-clamp-3">
                    "{comparison.question}"
                  </p>

                  {/* Visualization */}
                  {comparison.type === 'behavioral-intent' ? (
                    renderQ2PieChart(comparison)
                  ) : (comparison.type === 'scale' ||
                    (typeof comparison.userAnswer === 'number' && comparison.averageScore)) ? (
                    renderScaleSlider(comparison)
                  ) : (
                    renderBarChart(comparison)
                  )}

                  {/* Footer Stats */}
                  <div className="flex items-center justify-center pt-4 mt-4 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <Users size={12} />
                      <span>{comparison.totalResponses} total</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* AI Copilot Prompt */}
        {comparisonGroups.length > 0 && comparisonGroups[0].comparisons.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center gap-4"
          >
            <MessageCircle size={16} className="text-white/30 flex-shrink-0" />
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

      </div>

      {/* AI Copilot */}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          context={{ userRole: 'employee' }}
        />
      )}
    </div>
  );
};

export default MobilePeerComparison;
