import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Users, CheckCircle, Video as VideoIcon, Trophy, TrendingUp, Target, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  type?: 'scale' | 'multiple-choice' | 'text';
  averageScore?: number;
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

  // Calculate overall stats
  const overallStats = React.useMemo(() => {
    let totalUserScore = 0;
    let totalTeamScore = 0;
    let count = 0;

    comparisonGroups.forEach(group => {
      group.comparisons.forEach(comp => {
        if (comp.averageScore !== undefined && typeof comp.userAnswer === 'number') {
          totalUserScore += comp.userAnswer;
          totalTeamScore += comp.averageScore;
          count++;
        }
      });
    });

    if (count === 0) return null;

    const yourAvg = totalUserScore / count;
    const teamAvg = totalTeamScore / count;

    // Calculate percentile (simplified - assumes normal distribution)
    const difference = yourAvg - teamAvg;
    let percentile = 50;
    if (difference > 0.5) percentile = 15;
    else if (difference > 0.3) percentile = 25;
    else if (difference > 0.1) percentile = 35;
    else if (difference < -0.5) percentile = 85;
    else if (difference < -0.3) percentile = 75;
    else if (difference < -0.1) percentile = 60;

    return {
      yourScore: yourAvg,
      teamAverage: teamAvg,
      percentile,
      totalResponses: comparisonGroups.reduce((sum, g) =>
        sum + Math.max(...g.comparisons.map(c => c.totalResponses)), 0
      ),
    };
  }, [comparisonGroups]);

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

        campaign.items.forEach(item => {
          item.questions?.forEach(q => {
            if (!questionMap.has(q.id)) {
              questionMap.set(q.id, { text: q.question, videoId: item.videoId });
            }
          });
        });

        const allResponses = await getCampaignResponses(moduleId, user.organization);
        const userResponsesRaw = await getUserCampaignResponses(moduleId, user.id);

        const userResponsesMap = new Map<string, any>();
        userResponsesRaw.forEach(response => {
          const existing = userResponsesMap.get(response.questionId);
          if (!existing || response.answeredAt > existing.answeredAt) {
            userResponsesMap.set(response.questionId, response);
          }
        });
        const userResponses = Array.from(userResponsesMap.values());

        const responsesByQuestion = new Map<string, any[]>();
        allResponses.forEach(response => {
          const existing = responsesByQuestion.get(response.questionId) || [];
          existing.push(response);
          responsesByQuestion.set(response.questionId, existing);
        });

        const comparisonData: ComparisonData[] = [];

        userResponses.forEach(userResponse => {
          const questionId = userResponse.questionId;
          const allQuestionResponses = responsesByQuestion.get(questionId) || [];
          const questionInfo = questionMap.get(questionId);

          if (allQuestionResponses.length < 3) return;

          const distribution: Record<string | number, number> = {};
          let totalScore = 0;
          let countNumeric = 0;

          allQuestionResponses.forEach(r => {
            const answer = String(r.answer);
            distribution[answer] = (distribution[answer] || 0) + 1;

            const numVal = parseFloat(String(r.answer));
            if (!isNaN(numVal)) {
              totalScore += numVal;
              countNumeric++;
            }
          });

          const sortedAnswers = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
          const mostCommonAnswer = sortedAnswers[0]?.[0];
          const userAnswerStr = String(userResponse.answer);
          const isUserInMajority = userAnswerStr === mostCommonAnswer;

          comparisonData.push({
            questionId,
            question: questionInfo?.text || userResponse.metadata?.questionText || 'Question',
            userAnswer: userResponse.answer,
            answerDistribution: distribution,
            totalResponses: allQuestionResponses.length,
            isUserInMajority,
            videoId: userResponse.videoId || questionInfo?.videoId,
            type: (questionInfo?.type as any) || (typeof userResponse.answer === 'number' ? 'scale' : 'multiple-choice'),
            averageScore: countNumeric > 0 ? totalScore / countNumeric : undefined
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

  // Render bar chart for non-scale questions
  const renderBarChart = (comparison: ComparisonData) => {
    const sortedAnswers = Object.entries(comparison.answerDistribution)
      .sort((a, b) => b[1] - a[1]);

    return (
      <div className="space-y-3 mt-3">
        {sortedAnswers.map(([answer, count], idx) => {
          const percentage = Math.round((count / comparison.totalResponses) * 100);
          const isUserAnswer = String(answer) === String(comparison.userAnswer);

          return (
            <div key={idx}>
              <div className="flex justify-between items-end mb-1 text-sm">
                <span className={`font-medium ${isUserAnswer ? 'text-[#00A3FF]' : 'text-white/70'}`}>
                  {answer}
                </span>
                <span className="text-white/40">{percentage}%</span>
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

  // Render scale slider
  const renderScaleSlider = (comparison: ComparisonData) => {
    const userScore = Number(comparison.userAnswer);
    const teamAvg = comparison.averageScore || 0;
    const maxScore = 5;

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
        {/* Overall Summary Card - Duolingo Style */}
        {overallStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1a1a1a] rounded-3xl p-6 text-center"
          >
            {/* Trophy Icon with Glow */}
            <div className="flex justify-center mb-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-20 h-20 rounded-full bg-gradient-to-b from-[#00A3FF]/30 to-transparent flex items-center justify-center"
              >
                <Trophy size={48} className="text-[#00A3FF] drop-shadow-[0_0_20px_rgba(0,163,255,0.5)]" />
              </motion.div>
            </div>

            {/* Percentile */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-4xl font-bold text-white mb-1">Top {100 - overallStats.percentile}%</h2>
              <p className="text-white/50">in your organization</p>
            </motion.div>

            {/* Stats Row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-white/10"
            >
              <div className="text-center">
                <p className="text-xl font-bold text-[#00A3FF]">{overallStats.yourScore.toFixed(1)}</p>
                <p className="text-xs text-white/40">Your Score</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-xl font-bold text-white">{overallStats.teamAverage.toFixed(1)}</p>
                <p className="text-xs text-white/40">Team Avg</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{overallStats.totalResponses}</p>
                <p className="text-xs text-white/40">Responses</p>
              </div>
            </motion.div>
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
                  <p className="text-sm font-medium text-white leading-snug">
                    "{comparison.question}"
                  </p>

                  {/* Scale Slider or Bar Chart */}
                  {(comparison.type === 'scale' ||
                    (typeof comparison.userAnswer === 'number' && comparison.averageScore)) ? (
                    renderScaleSlider(comparison)
                  ) : (
                    renderBarChart(comparison)
                  )}

                  {/* Footer Stats */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <Users size={12} />
                      <span>{comparison.totalResponses} responses</span>
                    </div>
                    {comparison.isUserInMajority ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle size={12} />
                        In Majority
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[#00A3FF]">
                        <Sparkles size={12} />
                        Unique View
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* AI Insights */}
        {comparisonGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3 pt-4"
          >
            <div className="flex items-center gap-2 px-1">
              <Sparkles size={16} className="text-[#00A3FF]" />
              <h2 className="font-semibold text-white text-sm">AI Insights</h2>
            </div>

            {/* Strength Insight */}
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl p-4 border border-green-500/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={20} className="text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white leading-relaxed">
                    Your empathy scores are strong. Consider focusing on giving constructive feedback next.
                  </p>
                  <button
                    onClick={() => setIsCopilotOpen(true)}
                    className="text-xs text-green-400 font-medium mt-2"
                  >
                    Learn more →
                  </button>
                </div>
              </div>
            </div>

            {/* Improvement Insight */}
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl p-4 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Target size={20} className="text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-white leading-relaxed">
                    You tend to score lower on communication questions. Try practicing active listening.
                  </p>
                  <button
                    onClick={() => setIsCopilotOpen(true)}
                    className="text-xs text-amber-400 font-medium mt-2"
                  >
                    Get tips →
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Questions */}
        {comparisonGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#1a1a1a] rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle size={16} className="text-white/40" />
              <p className="text-sm text-white/50">
                Need help understanding your results?
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Analyze my gaps', 'How can I improve?', 'Key themes'].map((q, i) => (
                <button
                  key={i}
                  onClick={() => setIsCopilotOpen(true)}
                  className="px-4 py-2 text-xs font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00A3FF]/30 rounded-full transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Continue Button */}
        {!embedded && comparisonGroups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="pt-4"
          >
            <button
              onClick={() => navigate('/employee/learn')}
              className="w-full py-4 bg-gradient-to-r from-[#00A3FF] to-[#0066CC] text-white font-semibold rounded-2xl"
            >
              Continue Learning
            </button>
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
