import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, Zap, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useUserStatsRealtime } from '@/hooks/useUserStats';
import { Avatar } from '@/components/mobile';
import { DesktopLayout } from '@/components/desktop';
import AICopilot from '@/components/shared/AICopilot';
import { Skeleton } from '@/components/shared/Skeleton';

const ITEMS_PER_PAGE = 10;

const Rank: React.FC = () => {
  const { user } = useAuth();
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { leaderboard, userRank, isLoading: isLoadingLeaderboard } = useLeaderboard(
    user?.organization || '',
    user?.id || ''
  );

  const { stats: userStats, isLoading: isLoadingStats } = useUserStatsRealtime(user?.id || '');

  const isLoading = isLoadingLeaderboard || isLoadingStats;

  // Pagination
  const totalPages = Math.ceil(leaderboard.length / ITEMS_PER_PAGE);
  const paginatedUsers = leaderboard.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Mobile list
  const listUsers = showAllUsers ? leaderboard : leaderboard.slice(0, 10);

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  // Skeleton for table loading
  const renderTableSkeleton = () => (
    <div className="space-y-0">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-4 border-b border-white/5">
          <Skeleton className="w-8 h-4" />
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );

  // Desktop view renderer
  const renderDesktopView = () => {
    return (
      <DesktopLayout
        activePage="rank"
        title="Leaderboard"
        breadcrumbs={[
          { label: 'Leaderboard', icon: Trophy }
        ]}
        showXp
        onAICopilotClick={() => setIsCopilotOpen(true)}
      >
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Your Rank Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div>
                <div className="flex items-center gap-6">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00A3FF]/20 to-[#00A3FF]/5 border border-[#00A3FF]/20 flex flex-col items-center justify-center">
                    <span className="text-[#00A3FF]/60 text-xs font-medium">RANK</span>
                    <span className="text-3xl font-bold text-white">#{userRank?.rank || '-'}</span>
                  </div>

                  {/* User Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar src={user?.avatar} name={user?.name || 'You'} className="!w-14 !h-14 ring-2 ring-white/10" />
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-white truncate">{user?.name}</p>
                      <p className="text-white/50 text-sm">{user?.role || '-'} · {user?.department || '-'}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="flex items-center gap-1.5 text-[#00A3FF]">
                        <Zap size={18} />
                        <span className="text-2xl font-bold">{userStats.totalXp.toLocaleString()}</span>
                      </div>
                      <p className="text-white/40 text-xs mt-0.5">Total XP</p>
                    </div>
                    <div className="text-center border-l border-white/10 pl-8">
                      <span className="text-2xl font-bold text-white">{userStats.level}</span>
                      <p className="text-white/40 text-xs mt-0.5">Level</p>
                    </div>
                    <div className="text-center border-l border-white/10 pl-8">
                      <span className="text-lg font-medium text-white/80">{userStats.levelTitle}</span>
                      <p className="text-white/40 text-xs mt-0.5">Title</p>
                    </div>
                  </div>
                </div>

                {/* XP Progress */}
                <div className="mt-5 pt-5 border-t border-white/5">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-white/50">Progress to Level {userStats.level + 1}</span>
                    <span className="text-white/70">{userStats.xpInCurrentLevel} / {userStats.xpToNextLevel} XP</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#00A3FF] to-[#00C2FF] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (userStats.xpInCurrentLevel / userStats.xpToNextLevel) * 100)}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Rankings Table Card */}
            <motion.div
              className="bg-white/5 border border-white/5 rounded-xl overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Table Header */}
              <div className="px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-white">All Rankings</h2>
                  <span className="px-2.5 py-1 bg-white/10 rounded-full text-xs font-medium text-white/70">
                    {leaderboard.length} members
                  </span>
                </div>
              </div>

              {/* Table */}
              {isLoading ? (
                renderTableSkeleton()
              ) : (
                <>
                  {/* Table Header Row */}
                  <div className="grid grid-cols-[60px_1fr_200px_120px_60px] gap-4 px-6 py-3 bg-white/[0.02] border-b border-white/5 text-xs font-medium text-white/40 uppercase tracking-wide">
                    <span>No.</span>
                    <span>Member</span>
                    <span>Department</span>
                    <span className="text-right">XP</span>
                    <span className="text-right">+/-</span>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-white/5">
                    {paginatedUsers.length > 0 ? (
                      paginatedUsers.map((person, index) => {
                        const isCurrentUser = person.userId === user?.id;
                        const medal = getMedalEmoji(person.rank);
                        const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;

                        return (
                          <motion.div
                            key={person.userId}
                            className={`grid grid-cols-[60px_1fr_200px_120px_60px] gap-4 px-6 py-4 items-center transition-colors ${
                              isCurrentUser ? 'bg-[#00A3FF]/5' : 'hover:bg-white/[0.02]'
                            }`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.02 }}
                          >
                            {/* Rank */}
                            <div className="flex items-center">
                              {medal ? (
                                <span className="text-xl">{medal}</span>
                              ) : (
                                <span className={`font-semibold ${isCurrentUser ? 'text-[#00A3FF]' : 'text-white/50'}`}>
                                  {person.rank}
                                </span>
                              )}
                            </div>

                            {/* Member */}
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar src={person.avatar} name={person.name} size="sm" />
                              <div className="min-w-0">
                                <p className={`font-medium truncate ${isCurrentUser ? 'text-[#00A3FF]' : 'text-white'}`}>
                                  {person.name}
                                  {isCurrentUser && <span className="ml-2 text-[#00A3FF]/60 text-xs">(You)</span>}
                                </p>
                                <p className="text-xs text-white/40 truncate">{person.role || '-'}</p>
                              </div>
                            </div>

                            {/* Department */}
                            <div className="text-white/60 text-sm truncate">
                              {person.department || '-'}
                            </div>

                            {/* XP */}
                            <div className="flex items-center justify-end gap-1.5 text-white/70">
                              <Zap size={14} className="text-[#00A3FF]/60" />
                              <span className="font-medium">{person.totalXp.toLocaleString()}</span>
                            </div>

                            {/* Change */}
                            <div className="text-right">
                              <span className="text-white/30">-</span>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : null}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                          let pageNum: number;
                          if (totalPages <= 7) {
                            pageNum = i + 1;
                          } else if (currentPage <= 4) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 3) {
                            pageNum = totalPages - 6 + i;
                          } else {
                            pageNum = currentPage - 3 + i;
                          }

                          if (pageNum < 1 || pageNum > totalPages) return null;

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                                currentPage === pageNum
                                  ? 'bg-[#00A3FF] text-white'
                                  : 'text-white/50 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        {totalPages > 7 && currentPage < totalPages - 3 && (
                          <>
                            <span className="text-white/30 px-1">...</span>
                            <button
                              onClick={() => setCurrentPage(totalPages)}
                              className="w-8 h-8 rounded-lg text-sm font-medium text-white/50 hover:bg-white/5 hover:text-white transition"
                            >
                              {totalPages}
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/50 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Empty State */}
              {!isLoading && leaderboard.length === 0 && (
                <div className="text-center py-20">
                  <Trophy size={48} className="text-white/20 mx-auto mb-4" />
                  <p className="text-white/30">No rankings yet</p>
                  <p className="text-white/20 text-sm mt-1">Complete campaigns to appear here</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* AI Copilot */}
        {isCopilotOpen && (
          <AICopilot
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            context={{
              userRole: 'employee',
              learningContext: {
                currentCampaign: undefined,
                currentModule: undefined,
                streakStatus: {
                  current: userStats.currentStreak,
                  atRisk: false,
                },
              }
            }}
          />
        )}
      </DesktopLayout>
    );
  };

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block">
        {renderDesktopView()}
      </div>

      {/* Mobile View */}
      <div className="min-h-screen lg:hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f14]/95 to-transparent backdrop-blur-md" />
          <div className="relative px-5 pt-14 pb-4">
            <h1 className="text-2xl font-bold text-white mb-0.5">Leaderboard</h1>
            <p className="text-white/40 text-sm">See how you rank against your team</p>
          </div>
        </header>

        {/* Content */}
        <div className="px-5 py-4 pb-24 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Your Position Card */}
              <motion.div
                className="rounded-3xl bg-white/5 backdrop-blur-md p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-4">
                  <Avatar
                    src={user?.avatar}
                    name={user?.name || 'You'}
                    className="!w-14 !h-14"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{user?.name}</p>
                    <p className="text-white/50 text-sm">{user?.role || '-'} · {user?.department || '-'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">#{userRank?.rank || '-'}</div>
                    <div className="flex items-center gap-1 justify-end text-[#7BC4FF] text-sm">
                      <Zap size={14} />
                      <span>{userStats.totalXp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* XP Progress */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-white/40 mb-1.5">
                    <span>Progress to Level {userStats.level + 1}</span>
                    <span>{Math.min(100, Math.round((userStats.xpInCurrentLevel / userStats.xpToNextLevel) * 100))}%</span>
                  </div>
                  <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#0077B3] to-[#00C2FF] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (userStats.xpInCurrentLevel / userStats.xpToNextLevel) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Rankings List */}
              <motion.div
                className="bg-[#1a1a1a] rounded-2xl overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <AnimatePresence>
                  {listUsers.map((person, index) => {
                    const isCurrentUser = person.userId === user?.id;
                    const medal = getMedalEmoji(person.rank);

                    return (
                      <motion.div
                        key={person.userId}
                        className="flex items-center gap-4 px-4 py-3.5 border-b border-white/5 last:border-b-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        {/* Rank */}
                        <div className="w-8 text-center">
                          {medal ? (
                            <span className="text-lg">{medal}</span>
                          ) : (
                            <span className={`text-sm font-semibold ${isCurrentUser ? 'text-sky-400' : 'text-white/40'}`}>
                              {person.rank}
                            </span>
                          )}
                        </div>

                        {/* Avatar */}
                        <Avatar
                          src={person.avatar}
                          name={person.name}
                          size="sm"
                        />

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white truncate block">
                            {person.name}
                            {isCurrentUser && <span className="ml-2 text-white/40 text-xs font-normal">You</span>}
                          </span>
                        </div>

                        {/* XP */}
                        <div className="flex items-center gap-1 text-white/50">
                          <Zap size={14} />
                          <span className="text-sm">
                            {person.totalXp.toLocaleString()}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Show More */}
                {leaderboard.length > 10 && !showAllUsers && (
                  <button
                    onClick={() => setShowAllUsers(true)}
                    className="w-full py-3.5 flex items-center justify-center gap-1.5 text-white/40 text-sm hover:bg-white/5 transition-colors border-t border-white/5"
                  >
                    <span>Show {leaderboard.length - 10} more</span>
                    <ChevronDown size={16} />
                  </button>
                )}
              </motion.div>

              {/* Empty State */}
              {leaderboard.length === 0 && (
                <motion.div
                  className="text-center py-20"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <p className="text-white/30">No rankings yet</p>
                  <p className="text-white/20 text-sm mt-1">Complete campaigns to appear here</p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Rank;
