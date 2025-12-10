import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Camera,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  Hexagon,
  List,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  Star,
  Target,
  Trophy,
  User,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useUserStatsWithFallback, useSkillScoresRealtime, useBadgesRealtime, getRecentBadges, getSortedCompetencies } from '@/hooks/useUserStats';
import { useUserEnrollmentsRealtime } from '@/hooks/useEnrollmentRealtime';
import { useSkillProgress, useChartData } from '@/hooks/useSkillHistory';
import { upsertUserProfile } from '@/lib/firestore';
import { COMPETENCIES } from '@/lib/competencies';
import MobileProfile from './MobileProfile';
import Avatar from '@/components/shared/Avatar';
import DesktopLayout from '@/components/desktop/DesktopLayout';

// Distinct colors for competency chart lines
const CHART_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c'];

type NotificationKey = 'emailNotifications' | 'moduleReminders' | 'progressUpdates';

// Tab navigation items (similar to admin Account)
const TABS = [
  { id: 'edit', label: 'Profile', icon: User },
  { id: 'skills', label: 'Skills', icon: Target },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

type TabId = typeof TABS[number]['id'];

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser, updateAvatar } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('edit');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
    gender: user?.gender || '',
    dateOfBirth: user?.dateOfBirth
      ? new Date(user.dateOfBirth as string).toISOString().split('T')[0]
      : '',
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    moduleReminders: true,
    progressUpdates: true,
  });

  // Skills tab state
  const [proficiencyView, setProficiencyView] = useState<'bars' | 'radar'>('bars');
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);
  const [chartTimePeriod, setChartTimePeriod] = useState<number>(90);
  const [chartCompetencyFilter, setChartCompetencyFilter] = useState<string>('all');

  // Real-time data hooks
  const { enrollments } = useUserEnrollmentsRealtime(user?.id || '');
  const { stats: streakStats } = useUserStatsWithFallback(user?.id || '', enrollments);
  const { badges: userBadges } = useBadgesRealtime(user?.id || '');
  const { skillScores } = useSkillScoresRealtime(user?.id || '');

  // Skill progress for chart
  const skillProgressOptions = useMemo(() => ({ days: chartTimePeriod }), [chartTimePeriod]);
  const { progress: skillProgress, isLoading: skillProgressLoading } = useSkillProgress(
    user?.id || '',
    user?.organization || '',
    skillProgressOptions
  );
  const { data: competencyChartData, labels: competencyLabels } = useChartData(skillProgress, 'competencies');

  // Competencies data - map COMPETENCIES definitions to assessed data
  const topCompetencies = useMemo(() => {
    const assessedCompetencies = getSortedCompetencies(skillScores.competencyScores);
    return COMPETENCIES.map(compDef => {
      const assessed = assessedCompetencies.find(c => c.competencyId === compDef.id);
      if (assessed) return assessed;
      return {
        competencyId: compDef.id,
        competencyName: compDef.name,
        currentScore: 0,
        level: 1,
        skillCount: compDef.skills.length,
        assessedSkillCount: 0,
      };
    });
  }, [skillScores.competencyScores]);

  // Get skills for a competency
  const getSkillsForCompetency = (competencyId: string) => {
    const competencyDef = COMPETENCIES.find(c => c.id === competencyId);
    if (!competencyDef) return [];
    return competencyDef.skills.map(skillDef => {
      const assessedSkill = Object.values(skillScores.skills).find(
        s => s.skillId === skillDef.id && s.competencyId === competencyId
      );
      if (assessedSkill) return assessedSkill;
      return {
        skillId: skillDef.id,
        skillName: skillDef.name,
        competencyId: competencyId,
        currentScore: 0,
        level: 1,
        history: [],
      };
    });
  };

  // Filter chart data based on competency filter
  const filteredChartData = useMemo(() => {
    if (chartCompetencyFilter === 'all') return competencyChartData;
    return competencyChartData.map(point => {
      const filtered: { date: string; [key: string]: string | number | null } = { date: point.date };
      for (const key of Object.keys(point)) {
        if (key === 'date') continue;
        if (key.toLowerCase().replace(/\s+/g, '-') === chartCompetencyFilter || key === chartCompetencyFilter) {
          filtered[key] = point[key];
        }
      }
      return filtered;
    });
  }, [competencyChartData, chartCompetencyFilter]);

  const filteredLabels = useMemo(() => {
    if (chartCompetencyFilter === 'all') return competencyLabels;
    return competencyLabels.filter(label =>
      label.toLowerCase().replace(/\s+/g, '-') === chartCompetencyFilter || label === chartCompetencyFilter
    );
  }, [competencyLabels, chartCompetencyFilter]);

  // Radar chart data
  const radarData = useMemo(() =>
    topCompetencies.map(comp => ({
      competency: comp.competencyName,
      score: Math.round(comp.currentScore),
      fullMark: 100,
    })),
    [topCompetencies]
  );

  // Derive stats
  const completedEnrollments = enrollments.filter((e) => e.status === 'completed');
  const completedModules = completedEnrollments.length;

  // Recent badges
  const recentBadges = getRecentBadges(userBadges, 8);

  useEffect(() => {
    if (location.state && (location.state as any).activeSection) {
      const section = (location.state as any).activeSection;
      if (section === 'security') setActiveTab('security');
      else if (section === 'notifications') setActiveTab('notifications');
      else if (section === 'edit-profile') setActiveTab('edit');
    }
  }, [location]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!updateAvatar) {
      alert('Avatar upload not supported');
      return;
    }

    setUploadingAvatar(true);

    try {
      await updateAvatar(file);
    } catch (error) {
      console.error('Error updating avatar:', error);
      alert('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      await upsertUserProfile(user.id, {
        name: profileData.name.trim(),
        department: profileData.department.trim() || null,
        gender: profileData.gender as any || undefined,
        dateOfBirth: profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : undefined,
      });

      await refreshUser();
      setIsEditing(false);
    } catch (error) {
      console.error('[Profile] Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setProfileData({
      name: user?.name || '',
      email: user?.email || '',
      department: user?.department || '',
      gender: user?.gender || '',
      dateOfBirth: user?.dateOfBirth
        ? new Date(user.dateOfBirth as string).toISOString().split('T')[0]
        : '',
    });
    setIsEditing(false);
  };

  const notificationToggles: Array<{ key: NotificationKey; title: string; description: string }> = [
    { key: 'emailNotifications', title: 'Email notifications', description: 'Receive updates via email' },
    { key: 'moduleReminders', title: 'Module reminders', description: 'Stay on track with modules' },
    { key: 'progressUpdates', title: 'Progress updates', description: 'Weekly summaries in your inbox' },
  ];

  // XP progress calculation
  const xpProgress = streakStats.xpToNextLevel > 0
    ? (streakStats.xpInCurrentLevel / (streakStats.xpInCurrentLevel + streakStats.xpToNextLevel)) * 100
    : 100;

  // ===== TAB CONTENT RENDERERS =====

  const renderSkillsTab = () => (
    <div className="space-y-8">
      {/* Competencies Header with View Toggle */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Competencies</p>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
            <button
              onClick={() => setProficiencyView('bars')}
              className={`p-1.5 rounded-md transition ${
                proficiencyView === 'bars' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
              }`}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setProficiencyView('radar')}
              className={`p-1.5 rounded-md transition ${
                proficiencyView === 'radar' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'
              }`}
              title="Radar view"
            >
              <Hexagon size={16} />
            </button>
          </div>
        </div>

        {proficiencyView === 'radar' ? (
          <div className="rounded-xl bg-white/5 border border-white/5 p-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis
                    dataKey="competency"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                    tickLine={false}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    tickCount={5}
                    axisLine={false}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="rgba(255,255,255,0.8)"
                    fill="rgba(255,255,255,0.15)"
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value}%`, 'Score']}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {topCompetencies.map((comp) => (
                <div key={comp.competencyId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-medium">
                      L{comp.level}
                    </span>
                    <span className="text-white/70">{comp.competencyName}</span>
                  </div>
                  <span className="text-white/50">{Math.round(comp.currentScore)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {topCompetencies.map((competency) => {
              const skills = getSkillsForCompetency(competency.competencyId);
              const isExpanded = expandedCompetency === competency.competencyId;

              return (
                <div key={competency.competencyId} className="rounded-xl bg-white/5 border border-white/5 overflow-hidden">
                  <button
                    onClick={() => setExpandedCompetency(isExpanded ? null : competency.competencyId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded bg-white/10 text-white/70 text-xs font-medium">
                        L{competency.level}
                      </span>
                      <span className="text-sm text-white font-medium">{competency.competencyName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-white/40">
                        {competency.assessedSkillCount}/{competency.skillCount} skills
                      </span>
                      <span className="text-xs text-white/50">{Math.round(competency.currentScore)}%</span>
                      {isExpanded ? (
                        <ChevronUp className="text-white/40" size={16} />
                      ) : (
                        <ChevronDown className="text-white/40" size={16} />
                      )}
                    </div>
                  </button>

                  <div className="px-4 pb-1">
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${competency.currentScore}%` }}
                      />
                    </div>
                  </div>

                  {isExpanded && skills.length > 0 && (
                    <div className="px-4 pb-4 pt-3 space-y-3 border-t border-white/5 mt-3">
                      {skills.map((skill) => {
                        const isAssessed = skill.currentScore > 0 || (skill.history && skill.history.length > 0);
                        return (
                          <div key={skill.skillId} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${isAssessed ? 'bg-white/10 text-white/60' : 'bg-white/5 text-white/30'}`}>
                                  L{skill.level}
                                </span>
                                <span className={isAssessed ? 'text-white/70' : 'text-white/40'}>
                                  {skill.skillName}
                                </span>
                                {!isAssessed && <span className="text-white/30 text-[10px]">(not assessed)</span>}
                              </div>
                              <span className={isAssessed ? 'text-white/50' : 'text-white/20'}>
                                {Math.round(skill.currentScore)}%
                              </span>
                            </div>
                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isAssessed ? 'bg-white' : 'bg-white/5'}`}
                                style={{ width: isAssessed ? `${skill.currentScore}%` : '0%' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress Chart */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Score History</p>
          <div className="flex gap-3">
            <select
              value={chartCompetencyFilter}
              onChange={(e) => setChartCompetencyFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
            >
              <option value="all">All Competencies</option>
              {COMPETENCIES.map((comp) => (
                <option key={comp.id} value={comp.name}>{comp.name}</option>
              ))}
            </select>
            <select
              value={chartTimePeriod}
              onChange={(e) => setChartTimePeriod(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-white/20"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>6 months</option>
              <option value={365}>1 year</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          {skillProgressLoading ? (
            <div className="h-64 flex items-center justify-center text-white/40">Loading...</div>
          ) : filteredChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    interval="preserveStartEnd"
                    minTickGap={30}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="rgba(255,255,255,0.2)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    formatter={(value) => (value !== null && value !== undefined ? [`${value}%`, ''] : ['No data', ''])}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span className="text-white/50 text-xs">{value}</span>}
                  />
                  {filteredLabels.map((label, index) => (
                    <Line
                      key={label}
                      type="monotone"
                      dataKey={label}
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-white/40">
              <BarChart3 className="mb-3 opacity-30" size={32} />
              <p className="text-sm">No assessment history yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderEditProfileTab = () => (
    <div className="space-y-8">
      {/* Hidden input for avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Profile Header */}
      <div className="flex flex-wrap items-start gap-6">
        <div className="relative group">
          <Avatar
            src={user?.avatar}
            name={user?.name}
            email={user?.email}
            size="xxl"
            className="h-28 w-28 rounded-2xl border-4 border-[#050608] shadow-lg text-3xl"
          />
          {uploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl border-4 border-transparent">
              <Loader2 size={24} className="text-white animate-spin" />
            </div>
          )}
          {!uploadingAvatar && (
            <button
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-[-10px] p-2 bg-blue-600 rounded-full border-4 border-[#050608] hover:bg-blue-500 transition-colors shadow-sm"
            >
              <Camera size={16} className="text-white" />
            </button>
          )}
        </div>

        <div className="min-w-[240px] flex-1 space-y-2 pt-10 sm:pt-0">
          <h2 className="text-2xl font-semibold text-white">{profileData.name || 'Your name'}</h2>
          <p className="text-sm text-white/70">{profileData.email}</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
              <User size={14} />
              {user?.role || 'Employee'}
            </span>
            {profileData.department && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white">
                <Building2 size={14} />
                {profileData.department}
              </span>
            )}
          </div>
        </div>

        <div className="w-full sm:w-auto flex items-center gap-3 mt-4 sm:mt-0">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/10"
            >
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-white/90 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-white block">Full Name</label>
          <input
            type="text"
            value={profileData.name}
            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
            disabled={!isEditing}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:text-white/50"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white block">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              type="email"
              value={profileData.email}
              disabled
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white/50 cursor-not-allowed"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <CheckCircle size={10} /> Verified
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white block">Department</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              type="text"
              value={profileData.department}
              onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
              disabled={!isEditing}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white placeholder:text-white/50 focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:text-white/50"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white block">Role</label>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 capitalize cursor-not-allowed">
            {user?.role || 'Employee'}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white block">Gender</label>
          <select
            value={profileData.gender}
            onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
            disabled={!isEditing}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:text-white/50"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white block">Date of Birth</label>
          <input
            type="date"
            value={profileData.dateOfBirth}
            onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
            disabled={!isEditing}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white [color-scheme:dark] focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:text-white/50"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4">Performance Stats</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <Star className="text-white/40" size={18} />
              <span className="text-xs text-white/50 uppercase tracking-wider">Level</span>
            </div>
            <div className="text-2xl font-bold text-white">{streakStats.level}</div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 relative">
            <div className="flex items-center gap-3 mb-2">
              <Flame className="text-white/40" size={18} />
              <span className="text-xs text-white/50 uppercase tracking-wider">Streak</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {streakStats.currentStreak} <span className="text-sm font-normal text-white/40">days</span>
            </div>
            {streakStats.streakAtRisk && (
              <AlertCircle className="absolute top-3 right-3 text-amber-500/60" size={14} />
            )}
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="text-white/40" size={18} />
              <span className="text-xs text-white/50 uppercase tracking-wider">Total XP</span>
            </div>
            <div className="text-2xl font-bold text-white">{streakStats.totalXp.toLocaleString()}</div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="text-white/40" size={18} />
              <span className="text-xs text-white/50 uppercase tracking-wider">Completed</span>
            </div>
            <div className="text-2xl font-bold text-white">{completedModules}</div>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Level Progress</p>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>Level {streakStats.level}</span>
            <span>{streakStats.xpToNextLevel} XP to Level {streakStats.level + 1}</span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Week Activity */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">This Week's Activity</p>
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
              <div key={day} className="flex flex-col items-center gap-1.5">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center border ${
                    streakStats.streakDays?.[i]
                      ? 'bg-white/10 border-white/20'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  {streakStats.streakDays?.[i] ? (
                    <CheckCircle2 className="text-white/60" size={14} />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  )}
                </div>
                <span className="text-[10px] text-white/40">{day}</span>
              </div>
            ))}
            <div className="ml-auto text-xs text-white/50">
              Best: <span className="text-white font-medium">{streakStats.longestStreak} days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Badges Earned ({userBadges.length})</p>
        {recentBadges.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {recentBadges.map((badge) => (
              <div
                key={badge.id}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition cursor-default"
                title={`${badge.name}: ${badge.description}`}
              >
                <span className="text-xl">{badge.icon}</span>
                <span className="text-[9px] text-white/40 text-center truncate w-full">{badge.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-white/5 border border-white/5 text-center text-white/40">
            <Trophy className="mx-auto mb-2 opacity-30" size={24} />
            <p className="text-sm">No badges earned yet</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Lock size={20} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Security</h3>
          <p className="text-xs text-white/60">Manage your password</p>
        </div>
      </div>

      <div className="space-y-0 rounded-xl border border-white/10 overflow-hidden">
        {/* Password */}
        <div className="flex items-center justify-between px-4 py-4 bg-white/5 border-b border-white/5 hover:bg-white/[0.07] transition-colors">
          <div>
            <p className="text-sm font-semibold text-white">Password</p>
            <p className="text-xs text-white/60">Update your password</p>
          </div>
          <button
            onClick={() => navigate('/change-password')}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Change
          </button>
        </div>

        {/* Two-Factor */}
        <div className="flex items-center justify-between px-4 py-4 bg-white/5 border-b border-white/5 hover:bg-white/[0.07] transition-colors">
          <div>
            <p className="text-sm font-semibold text-white">Two-Factor Authentication</p>
            <p className="text-xs text-white/60">Add extra security</p>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs font-medium">
            Coming Soon
          </span>
        </div>

        {/* Sessions */}
        <div className="flex items-center justify-between px-4 py-4 bg-white/5 hover:bg-white/[0.07] transition-colors">
          <div>
            <p className="text-sm font-semibold text-white">Active Sessions</p>
            <p className="text-xs text-white/60">Sign out from all devices</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors">
            Sign Out All
          </button>
        </div>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Bell size={20} className="text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Notifications</h3>
          <p className="text-xs text-white/60">Manage your alerts</p>
        </div>
      </div>

      <div className="space-y-0 rounded-xl border border-white/10 overflow-hidden">
        {notificationToggles.map((toggle, index) => (
          <div
            key={toggle.key}
            className={`flex items-center justify-between px-4 py-4 bg-white/5 hover:bg-white/[0.07] transition-colors ${
              index < notificationToggles.length - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-white">{toggle.title}</p>
              <p className="text-xs text-white/60">{toggle.description}</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={notifications[toggle.key]}
                onChange={(e) =>
                  setNotifications({ ...notifications, [toggle.key]: e.target.checked })
                }
              />
              <div className="h-6 w-11 rounded-full bg-white/20 transition peer-checked:bg-blue-600 peer-focus:outline-none" />
              <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'edit':
        return renderEditProfileTab();
      case 'skills':
        return renderSkillsTab();
      case 'security':
        return renderSecurityTab();
      case 'notifications':
        return renderNotificationsTab();
      default:
        return null;
    }
  };

  return (
    <>
      {/* Mobile View */}
      <div className="lg:hidden">
        <MobileProfile />
      </div>

      {/* Desktop View */}
      <DesktopLayout activePage="profile" title="Profile">
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
            {/* Vertical Sidebar Navigation */}
            <aside className="w-full lg:w-64 flex-shrink-0 space-y-8 lg:sticky lg:top-0 h-fit">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50 px-3 mb-3">Settings</p>
                <div className="space-y-1">
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${isActive
                            ? 'bg-white/15 text-white'
                            : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                      >
                        <Icon size={18} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Divider */}
            <div className="hidden lg:block w-px bg-white/5 rounded-full self-stretch" />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 max-w-3xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderTabContent()}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </DesktopLayout>
    </>
  );
};

export default Profile;
