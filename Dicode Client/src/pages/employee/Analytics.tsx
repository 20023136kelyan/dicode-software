import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Flame, 
  Trophy, 
  BookOpen, 
  TrendingUp, 
  Target,
  Star,
  Calendar,
  Clock,
  Award,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { getUserSkillProfile } from '@/lib/firestore';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useUserStatsWithFallback } from '@/hooks/useUserStats';
import { Skeleton } from '@/components/shared/Skeleton';

// Level titles based on XP thresholds
const getLevelTitle = (level: number): string => {
  if (level <= 5) return 'Beginner';
  if (level <= 15) return 'Learner';
  if (level <= 30) return 'Practitioner';
  if (level <= 50) return 'Expert';
  return 'Master';
};

const EmployeeAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [skillProfile, setSkillProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { enrollments } = useUserEnrollmentsRealtime(user?.id || '');
  const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        const profile = await getUserSkillProfile(user.id, user.organization || '');
        setSkillProfile(profile);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user?.id, user?.organization]);

  // Calculate stats - use server-computed stats for level/XP/streak
  const stats = useMemo(() => {
    const completedModules = enrollments.reduce((acc, e) => acc + (e.completedModules || 0), 0);
    const campaignsCompleted = enrollments.filter(e => e.status === 'completed').length;
    
    return {
      // Use server-computed stats (from userStats collection)
      level: streakStats.level,
      currentXP: streakStats.xpInCurrentLevel,
      xpToNextLevel: streakStats.xpToNextLevel,
      totalXP: streakStats.totalXp,
      currentStreak: streakStats.currentStreak,
      longestStreak: streakStats.longestStreak,
      modulesCompleted: completedModules,
      campaignsCompleted,
      // Use skillProfile for other stats if available, otherwise defaults
      averageScore: skillProfile?.stats?.averageScore || 0,
      badges: skillProfile?.badges || [],
      badgeDetails: skillProfile?.badgeDetails || [],
      questionsAnswered: skillProfile?.stats?.questionsAnswered || 0,
      totalWatchTime: skillProfile?.stats?.totalWatchTime || 0,
    };
  }, [skillProfile, enrollments, streakStats]);

  // Prepare competency data for radar chart
  const competencyData = useMemo(() => {
    if (!skillProfile?.competencies) {
      // Default competencies with 0 progress
      return [
        { competency: 'Leadership', level: 0, fullMark: 5 },
        { competency: 'Communication', level: 0, fullMark: 5 },
        { competency: 'Collaboration', level: 0, fullMark: 5 },
        { competency: 'Growth Mindset', level: 0, fullMark: 5 },
        { competency: 'Empathy', level: 0, fullMark: 5 },
        { competency: 'Trust Building', level: 0, fullMark: 5 },
      ];
    }

    return Object.entries(skillProfile.competencies).map(([id, data]: [string, any]) => ({
      competency: data.competencyName || id,
      level: data.level || 0,
      fullMark: 5,
    }));
  }, [skillProfile]);

  // Mock progress over time data (would come from activity history)
  const progressData = useMemo(() => {
    const days = 14;
    const data = [];
    const baseXP = Math.max(0, stats.totalXP - (days * 30));
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const xpGain = i === 0 ? stats.totalXP : baseXP + ((days - i) * 30);
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        xp: Math.min(xpGain, stats.totalXP),
        modules: Math.floor(xpGain / 25),
      });
    }
    
    return data;
  }, [stats.totalXP]);

  const progressPercent = stats.xpToNextLevel > 0 
    ? Math.round((stats.currentXP / stats.xpToNextLevel) * 100) 
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050608] p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-10 w-32 bg-white/10" />
          <Skeleton className="h-48 w-full bg-white/10 rounded-3xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-full bg-white/10 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full bg-white/10 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050608]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#050608]/95 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <h1 className="text-white text-lg font-semibold">Your Progress</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Level Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-purple-600 p-6"
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
          
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="text-white text-4xl font-bold">{stats.level}</span>
            </div>
            <div className="flex-1">
              <p className="text-white/70 text-sm mb-1">Level {stats.level}</p>
              <h2 className="text-white text-2xl font-bold mb-2">{getLevelTitle(stats.level)}</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">XP Progress</span>
                  <span className="text-white font-medium">{stats.currentXP} / {stats.xpToNextLevel}</span>
                </div>
                <div className="h-3 rounded-full bg-white/20 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-white"
                  />
                </div>
                <p className="text-white/50 text-xs">{stats.xpToNextLevel - stats.currentXP} XP to next level • {stats.totalXP} total XP</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-4 border border-orange-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Flame size={18} className="text-orange-400" />
              <span className="text-white/60 text-sm">Streak</span>
            </div>
            <p className="text-white text-3xl font-bold">{stats.currentStreak}</p>
            <p className="text-white/40 text-xs">Best: {stats.longestStreak} days</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/5 rounded-2xl p-4 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={18} className="text-blue-400" />
              <span className="text-white/60 text-sm">Modules</span>
            </div>
            <p className="text-white text-3xl font-bold">{stats.modulesCompleted}</p>
            <p className="text-white/40 text-xs">{stats.campaignsCompleted} campaigns</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 rounded-2xl p-4 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-emerald-400" />
              <span className="text-white/60 text-sm">Avg Score</span>
            </div>
            <p className="text-white text-3xl font-bold">{stats.averageScore}%</p>
            <p className="text-white/40 text-xs">{stats.questionsAnswered} questions</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 rounded-2xl p-4 border border-amber-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Trophy size={18} className="text-amber-400" />
              <span className="text-white/60 text-sm">Badges</span>
            </div>
            <p className="text-white text-3xl font-bold">{stats.badges.length}</p>
            <p className="text-white/40 text-xs">Earned</p>
          </motion.div>
        </div>

        {/* Competency Radar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#090909] rounded-3xl p-6 border border-white/5"
        >
          <h3 className="text-white font-semibold mb-4">Competency Breakdown</h3>
          {competencyData.length > 0 && competencyData.some(c => c.level > 0) ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={competencyData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis 
                    dataKey="competency" 
                    tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={30} 
                    domain={[0, 5]} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                  />
                  <Radar
                    name="Level"
                    dataKey="level"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Target size={24} className="text-white/30" />
              </div>
              <p className="text-white/50 mb-2">No competency data yet</p>
              <p className="text-white/30 text-sm max-w-xs">
                Complete modules to see your competency breakdown
              </p>
            </div>
          )}
        </motion.div>

        {/* Progress Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[#090909] rounded-3xl p-6 border border-white/5"
        >
          <h3 className="text-white font-semibold mb-4">XP Progress (Last 2 Weeks)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progressData}>
                <defs>
                  <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis 
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'white' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="xp" 
                  stroke="#3b82f6" 
                  fill="url(#xpGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Badges Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#090909] rounded-3xl p-6 border border-white/5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Badges Earned</h3>
            <span className="text-white/40 text-sm">{stats.badges.length} / 11</span>
          </div>
          
          {stats.badgeDetails.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {stats.badgeDetails.map((badge: any) => (
                <motion.div
                  key={badge.id}
                  whileHover={{ scale: 1.05 }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-2xl mb-2">
                    {badge.icon}
                  </div>
                  <p className="text-white text-xs font-medium">{badge.name}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Award size={24} className="text-white/30" />
              </div>
              <p className="text-white/50 mb-2">No badges yet</p>
              <p className="text-white/30 text-sm max-w-xs">
                Complete modules and maintain streaks to earn badges
              </p>
            </div>
          )}
        </motion.div>

        {/* Activity Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-[#090909] rounded-3xl p-6 border border-white/5"
        >
          <h3 className="text-white font-semibold mb-4">Activity Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Sparkles size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Total XP Earned</p>
                  <p className="text-white/40 text-sm">Lifetime progress</p>
                </div>
              </div>
              <span className="text-white font-bold">{stats.totalXP.toLocaleString()}</span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <BookOpen size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Questions Answered</p>
                  <p className="text-white/40 text-sm">Across all modules</p>
                </div>
              </div>
              <span className="text-white font-bold">{stats.questionsAnswered}</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Clock size={18} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Learning Time</p>
                  <p className="text-white/40 text-sm">Estimated total</p>
                </div>
              </div>
              <span className="text-white font-bold">
                {Math.round(stats.modulesCompleted * 5)} min
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default EmployeeAnalytics;

