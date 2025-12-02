import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, MessageSquare, Loader, Video as VideoIcon, Users, CheckCircle, Info } from 'lucide-react';
import AICopilot from '@/components/shared/AICopilot';
import { useAuth } from '@/contexts/AuthContext';
import { getCampaignResponses, getUserCampaignResponses, getCampaign, getVideo } from '@/lib/firestore';

// Visualizations
import RadarOverview from '@/components/employee/visualizations/RadarOverview';
import ComparisonSlider from '@/components/employee/visualizations/ComparisonSlider';
import ThemeBubbleCluster from '@/components/employee/visualizations/ThemeBubbleCluster';

interface ComparisonData {
  questionId: string;
  question: string;
  userAnswer: string | number | boolean;
  answerDistribution: Record<string | number, number>; // answer => count
  totalResponses: number;
  isUserInMajority: boolean;
  videoId?: string;
  type?: 'scale' | 'multiple-choice' | 'text';
  averageScore?: number; // For scale questions
}

interface VideoGroup {
  videoId: string;
  videoTitle: string;
  comparisons: ComparisonData[];
  userAverage?: number;
  communityAverage?: number;
}

interface PeerComparisonProps {
  campaignIdOverride?: string;
  embedded?: boolean;
}

const PeerComparison: React.FC<PeerComparisonProps> = ({ campaignIdOverride, embedded = false }) => {
  const { moduleId: moduleIdFromRoute } = useParams(); // campaignId
  const moduleId = campaignIdOverride || moduleIdFromRoute;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const [comparisonGroups, setComparisonGroups] = useState<VideoGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string>('Campaign');
  const isDark = !embedded;

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

        console.log(`[DEBUG] Deduplicated user responses: ${userResponsesRaw.length} -> ${userResponses.length}`);

        // 5. Group responses
        const responsesByQuestion = new Map<string, any[]>();
        allResponses.forEach(response => {
          const existing = responsesByQuestion.get(response.questionId) || [];
          existing.push(response);
          responsesByQuestion.set(response.questionId, existing);
        });

        // 6. Build Comparison Data
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

            // Calculate average for scale questions
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

        // 7. Group by Video and Calculate Group Averages
        const groups: VideoGroup[] = [];
        const comparisonsByVideo = new Map<string, ComparisonData[]>();

        console.log('[DEBUG] Video IDs from campaign:', Array.from(videoIds));
        console.log('[DEBUG] Total comparison data items:', comparisonData.length);

        // Show each comparison's videoId
        comparisonData.forEach((c, idx) => {
          console.log(`[DEBUG] Comparison ${idx}:`, {
            questionId: c.questionId,
            videoId: c.videoId,
            question: c.question.substring(0, 50)
          });
        });

        comparisonData.forEach(comp => {
          const vid = comp.videoId || 'unknown';
          const existing = comparisonsByVideo.get(vid) || [];
          existing.push(comp);
          comparisonsByVideo.set(vid, existing);
        });

        console.log('[DEBUG] Grouped comparisons by video:');
        Array.from(comparisonsByVideo.entries()).forEach(([vid, comps]) => {
          console.log(`  Video ${vid}:`, {
            videoId: vid,
            count: comps.length,
            title: videoTitleMap.get(vid) || 'Unknown',
            questions: comps.map(c => c.question.substring(0, 30))
          });
        });

        Array.from(videoIds).forEach(vid => {
          const comps = comparisonsByVideo.get(vid);
          if (comps && comps.length > 0) {
            // Calculate averages for the video group (Radar Chart Data)
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

  // --- Render Helpers ---

  const renderBarChart = (comparison: ComparisonData) => {
    const labelColor = isDark ? 'text-white/80' : 'text-gray-600';
    const percentColor = isDark ? 'text-white/60' : 'text-gray-400';
    const barBg = isDark ? 'bg-white/10' : 'bg-gray-100';
    const barFillUser = isDark ? 'bg-blue-400' : 'bg-blue-500';
    const barFillOther = isDark ? 'bg-white/30' : 'bg-gray-300';
    const userTag = isDark ? 'text-blue-300' : 'text-blue-500';

    const sortedAnswers = Object.entries(comparison.answerDistribution)
      .sort((a, b) => b[1] - a[1]);

    return (
      <div className="space-y-4 mt-4">
        {sortedAnswers.map(([answer, count], idx) => {
          const percentage = Math.round((count / comparison.totalResponses) * 100);
          const isUserAnswer = String(answer) === String(comparison.userAnswer);

          return (
            <div key={idx} className="relative">
              <div className="flex justify-between items-end mb-1 text-sm">
                <span className={`font-medium ${isUserAnswer ? 'text-blue-400' : labelColor}`}>
                  {answer}
                </span>
                <span className={percentColor}>{percentage}%</span>
              </div>
              <div className={`h-2 w-full ${barBg} rounded-full overflow-hidden`}>
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${isUserAnswer ? barFillUser : barFillOther}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {isUserAnswer && (
                <div className={`text-[10px] ${userTag} font-bold mt-0.5`}>YOU</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const containerClasses = 'min-h-screen bg-[#050608] pb-20 text-white';

  if (isLoading) {
    return (
      <div className={`${containerClasses} flex items-center justify-center px-6 min-h-[200px]`}>
        <div className="text-center">
          <Loader className={`w-12 h-12 animate-spin ${isDark ? 'text-white' : 'text-blue-500'} mx-auto mb-4`} />
          <p className={isDark ? 'text-white/70' : 'text-gray-500'}>Loading insights...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${containerClasses} flex items-center justify-center px-6 min-h-[200px]`}>
        <div className="text-center">
          <h1 className={`text-2xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Unable to Load Data</h1>
          <p className={`${isDark ? 'text-white/70' : 'text-gray-500'} mb-6`}>{loadError}</p>
          {!embedded && (
            <button onClick={() => navigate('/employee/home')} className={`${isDark ? 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500 text-white hover:bg-blue-600' : 'btn-primary bg-blue-600 text-white hover:bg-blue-700'}`}>
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  // Prepare Radar Data
  const radarData = comparisonGroups
    .filter(g => g.userAverage !== undefined && g.communityAverage !== undefined)
    .map(g => ({
      subject: g.videoTitle.length > 15 ? g.videoTitle.substring(0, 15) + '...' : g.videoTitle,
      A: g.userAverage || 0,
      B: g.communityAverage || 0,
      fullMark: 5,
    }));

  return (
    <div className={containerClasses}>
      {/* Minimalist Header */}
      <div className={`px-6 pt-8 pb-6 ${embedded ? 'bg-white border-gray-100 text-gray-900' : 'bg-[#050608] border-white/10 text-white'}`}>
        <div className="max-w-3xl mx-auto">
          {!embedded && (
            <button
              onClick={() => navigate('/employee/home')}
              className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft size={20} />
              Back
            </button>
          )}
          <h1 className={`text-2xl font-bold mb-1 ${embedded ? 'text-gray-900' : 'text-white'}`}>
            Survey Results
          </h1>
          <p className={embedded ? 'text-gray-500' : 'text-white/70'}>{campaignTitle}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-12">

        {/* Hero Radar Chart */}
        {radarData.length >= 3 && (
          <div className={`${isDark ? 'bg-[#0f1118] border border-white/10 text-white' : 'bg-white border border-gray-100 text-gray-900'} rounded-2xl p-6 shadow-sm`}>
            <h2 className="text-center font-semibold mb-6">Performance Overview</h2>
            <RadarOverview data={radarData} />

            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full" />
                <span className={`${isDark ? 'text-white/70' : 'text-gray-600'} font-medium`}>You</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 ${isDark ? 'bg-white/40' : 'bg-gray-400'} rounded-full opacity-70`} />
                <span className={`${isDark ? 'text-white/70' : 'text-gray-600'} font-medium`}>Community Avg</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {comparisonGroups.length === 0 && (
          <div className={`text-center py-12 rounded-2xl p-6 shadow-sm ${isDark ? 'bg-[#0f1118] border border-white/10 text-white' : 'bg-white border border-gray-100 text-gray-900'}`}>
            <div className={`w-16 h-16 ${isDark ? 'bg-white/10' : 'bg-blue-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Users size={32} className={`${isDark ? 'text-white' : 'text-blue-600'}`} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Waiting for Colleagues</h3>
            <p className={`${isDark ? 'text-white/70' : 'text-gray-500'} mb-6 max-w-md mx-auto`}>
              Your responses are safe! We're just waiting for a few more teammates to finish so we can show you the comparison.
            </p>
            {!embedded && (
              <button onClick={() => navigate('/employee/home')} className="btn-primary bg-blue-600 text-white hover:bg-blue-700">
                Continue Learning
              </button>
            )}
          </div>
        )}

        {/* Comparison Groups */}
        {comparisonGroups.map((group) => (
          <div key={group.videoId} className="space-y-6">
            <div className={`flex items-center gap-3 pb-2 ${isDark ? 'border-b border-white/10' : 'border-b border-gray-100'}`}>
              <VideoIcon size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{group.videoTitle}</h2>
            </div>

            <div className="space-y-8">
              {group.comparisons.map((comparison, idx) => (
                <div
                  key={idx}
                  className={`${isDark ? 'bg-[#0f1118] border border-white/10 text-white' : 'bg-white border border-gray-100 text-gray-900'} p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow`}
                >
                  <h3 className="text-lg font-medium mb-2">
                    {comparison.question}
                  </h3>

                  {comparison.type === 'scale' || (typeof comparison.userAnswer === 'number' && comparison.averageScore)
                    ? (
                      <ComparisonSlider
                        userValue={Number(comparison.userAnswer)}
                        avgValue={comparison.averageScore || 0}
                      />
                    )
                    : renderBarChart(comparison)
                  }

                  {/* Example usage of ThemeBubbleCluster for text questions (mocked for now as we don't have text analysis yet) */}
                  {comparison.type === 'text' && (
                    <div className="mt-4">
                      <p className={`text-sm mb-3 ${isDark ? 'text-white/70' : 'text-gray-500'}`}>Common Themes:</p>
                      <ThemeBubbleCluster themes={[
                        { name: 'Communication', type: 'user', percentage: 85 },
                        { name: 'Teamwork', type: 'community' },
                        { name: 'Leadership', type: 'community' },
                        { name: 'Strategy', type: 'user', percentage: 40 }
                      ]} />
                    </div>
                  )}

                  <div className={`mt-6 flex items-center gap-2 text-sm ${isDark ? 'text-white/60' : 'text-gray-400'}`}>
                    <Users size={14} className={isDark ? 'text-white/60' : ''} />
                    <span>{comparison.totalResponses} responses</span>
                    {comparison.isUserInMajority ? (
                      <span className="flex items-center gap-1 text-green-500 ml-auto">
                        <CheckCircle size={14} />
                        In Majority
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-400 ml-auto">
                        <Info size={14} />
                        Unique View
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* AI Copilot Prompt */}
        <div className={`${isDark ? 'bg-[#0f1118] border border-white/10 text-white' : 'bg-blue-50 border border-blue-100 text-gray-900'} rounded-2xl p-6`}>
          <div className="flex items-start gap-4">
            <div className={`${isDark ? 'p-3 bg-white/10 text-white' : 'p-3 bg-blue-100 text-blue-600'} rounded-xl`}>
              <MessageSquare size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">
                Analyze with AI
              </h3>
              <p className={`${isDark ? 'text-white/70' : 'text-gray-600'} mb-4`}>
                Want to understand why your score differs from the average? Ask our AI Copilot.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Analyze my gaps', 'How can I improve?', 'Summarize key themes'].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setIsCopilotOpen(true)}
                    className={`${isDark ? 'px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white' : 'px-4 py-2 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700'} rounded-lg text-sm transition-colors shadow-sm`}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Action */}
        {!embedded && comparisonGroups.length > 0 && (
          <div className="text-center pt-8 pb-12">
            <button
              onClick={() => navigate('/employee/home')}
              className={`${isDark ? 'inline-flex items-center gap-2 px-8 py-3 text-lg bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-900/40' : 'btn-primary inline-flex items-center gap-2 px-8 py-3 text-lg bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`}
            >
              <Play size={20} />
              Continue Learning
            </button>
          </div>
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

export default PeerComparison;
