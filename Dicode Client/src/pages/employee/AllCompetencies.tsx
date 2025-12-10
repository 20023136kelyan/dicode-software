import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Heart, X, Inbox } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getPublishedCampaigns } from '@/lib/firestore';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import type { Campaign } from '@/types';
import { DesktopLayout } from '@/components/desktop';
import AICopilot from '@/components/shared/AICopilot';

// Gradient colors for competency cards (same as Learn.tsx)
const cardGradients = [
  'from-orange-400 to-orange-500',
  'from-blue-400 to-blue-500',
  'from-sky-400 to-sky-500',
  'from-purple-400 to-purple-500',
  'from-pink-400 to-pink-500',
  'from-green-400 to-green-500',
  'from-amber-400 to-amber-500',
  'from-rose-400 to-rose-500',
  'from-teal-400 to-teal-500',
  'from-indigo-400 to-indigo-500',
];

// Professional emojis for competencies (same as Learn.tsx)
const competencyEmojis = [
  '📊', '💡', '🎯', '🧠', '📈', '🤝', '💬', '🏆',
  '⚡', '🔑', '📚', '🎓', '💪', '🌟', '🧭', '🔍',
  '📝', '🎨', '🛠️', '🌱', '🎪', '🧩', '📣', '🔬',
];

const getCompetencyEmoji = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % competencyEmojis.length;
  return competencyEmojis[index];
};

interface CompetencyItem {
  name: string;
  count: number;
  notStartedCount: number;
}

const AllCompetencies: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get enrollments for sorting by relevance
  const { enrollments } = useUserEnrollmentsRealtime(user?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Load campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const data = await getPublishedCampaigns(
          user.organization,
          user.department,
          user.id,
          user.cohortIds
        );
        setCampaigns(data);
      } catch (error) {
        console.error('Failed to load campaigns:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCampaigns();
  }, [user]);

  // Extract competencies with campaign counts and relevance scoring
  const competencies = useMemo((): CompetencyItem[] => {
    // Build a set of started/completed campaign IDs
    const startedCampaignIds = new Set(enrollments.map(e => e.campaignId));

    const skillMap = new Map<string, { campaignIds: Set<string>; notStartedCount: number }>();

    campaigns.forEach(campaign => {
      const campaignCompetencies = campaign.metadata?.tags?.length
        ? campaign.metadata.tags
        : campaign.skillFocus
          ? [campaign.skillFocus]
          : [];

      const isNotStarted = !startedCampaignIds.has(campaign.id);

      campaignCompetencies.forEach(competency => {
        if (competency) {
          if (!skillMap.has(competency)) {
            skillMap.set(competency, { campaignIds: new Set(), notStartedCount: 0 });
          }
          const data = skillMap.get(competency)!;
          data.campaignIds.add(campaign.id);
          if (isNotStarted) {
            data.notStartedCount++;
          }
        }
      });
    });

    return Array.from(skillMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.campaignIds.size,
        notStartedCount: data.notStartedCount,
      }))
      // Sort: prioritize competencies with not-started campaigns, then by total count
      .sort((a, b) => {
        if (a.notStartedCount !== b.notStartedCount) {
          return b.notStartedCount - a.notStartedCount;
        }
        return b.count - a.count;
      });
  }, [campaigns, enrollments]);

  // Filter competencies by search query
  const filteredCompetencies = useMemo(() => {
    if (!searchQuery.trim()) return competencies;
    const query = searchQuery.toLowerCase();
    return competencies.filter(c => c.name.toLowerCase().includes(query));
  }, [competencies, searchQuery]);

  const handleCompetencyClick = (name: string) => {
    navigate(`/employee/learn/competency/${encodeURIComponent(name)}`);
  };

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block">
        <DesktopLayout
          activePage="learn"
          title="All Competencies"
          breadcrumbs={[{ label: 'Learn', path: '/employee/learn' }, { label: 'Competencies' }]}
          onAICopilotClick={() => setIsCopilotOpen(true)}
        >
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-7xl mx-auto">
              {/* Search */}
              <div className="mb-8 relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search competencies..."
                  className="w-full bg-[#090909] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {/* Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredCompetencies.map((competency, index) => (
                  <motion.button
                    key={competency.name}
                    onClick={() => handleCompetencyClick(competency.name)}
                    className={`aspect-square rounded-2xl bg-gradient-to-br ${cardGradients[index % cardGradients.length]} p-6 flex flex-col justify-between text-left relative overflow-hidden group hover:scale-[1.02] transition-transform`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <span className="absolute -bottom-6 -right-6 text-9xl opacity-20 select-none pointer-events-none group-hover:opacity-30 transition-opacity">
                      {getCompetencyEmoji(competency.name)}
                    </span>

                    <div className="flex justify-end relative z-10">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <Heart size={20} className="text-white" />
                      </div>
                    </div>

                    <div className="relative z-10">
                      <h3 className="text-white font-bold text-xl leading-tight mb-2 line-clamp-2">
                        {competency.name}
                      </h3>
                      <p className="text-white/90 text-sm font-medium">
                        {competency.count} {competency.count === 1 ? 'campaign' : 'campaigns'}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
          {isCopilotOpen && (
            <AICopilot
              isOpen={isCopilotOpen}
              onClose={() => setIsCopilotOpen(false)}
              context={{ userRole: 'employee' }}
            />
          )}
        </DesktopLayout>
      </div>

      <div className="min-h-screen lg:hidden pb-24">
        {/* Header */}
        <header className="sticky top-0 z-40">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14]/95 to-transparent backdrop-blur-md" />
          <div className="relative flex items-center gap-4 px-4 py-4">
            <motion.button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft size={20} className="text-white" />
            </motion.button>

            <h1 className="text-white text-lg font-bold">All Competencies</h1>
          </div>
        </header>

        {/* Content Sheet */}
        <div className="bg-black rounded-t-[40px] mt-2 min-h-screen">
          <main className="px-4 pt-4 pb-24">
            {/* Search Bar */}
            <motion.div
              className="bg-[#1a1a1a] rounded-2xl p-3 flex items-center gap-3 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Search size={20} className="text-white/50 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search competencies"
                className="flex-1 bg-transparent text-white placeholder:text-white/50 text-base outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={16} className="text-white/50" />
                </button>
              )}
            </motion.div>

            {/* Stats */}
            {!isLoading && (
              <motion.p
                className="text-white/50 text-sm mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {filteredCompetencies.length} {filteredCompetencies.length === 1 ? 'competency' : 'competencies'} found
              </motion.p>
            )}

            {/* Loading State */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-2xl bg-white/10 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredCompetencies.length === 0 ? (
              <motion.div
                className="text-center py-16"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <Inbox size={28} className="text-white/40" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {searchQuery ? 'No matches found' : 'No competencies yet'}
                </h3>
                <p className="text-sm text-white/50 max-w-[240px] mx-auto">
                  {searchQuery
                    ? `No competencies match "${searchQuery}"`
                    : 'Competencies will appear as campaigns are assigned to you.'}
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredCompetencies.map((competency, index) => (
                  <motion.button
                    key={competency.name}
                    onClick={() => handleCompetencyClick(competency.name)}
                    className={`aspect-square rounded-2xl bg-gradient-to-br ${cardGradients[index % cardGradients.length]} p-4 flex flex-col justify-between text-left relative overflow-hidden`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* Background Emoji */}
                    <span className="absolute -bottom-4 -right-4 text-7xl opacity-20 select-none pointer-events-none">
                      {getCompetencyEmoji(competency.name)}
                    </span>

                    {/* Favorite button */}
                    <div className="flex justify-end relative z-10">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Heart size={16} className="text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10">
                      <h3 className="text-white font-semibold text-base leading-tight mb-1 line-clamp-2">
                        {competency.name}
                      </h3>
                      <p className="text-white/80 text-sm">
                        {competency.count} {competency.count === 1 ? 'campaign' : 'campaigns'}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
};

export default AllCompetencies;
