// Layout
export { default as BottomNav } from './layout/BottomNav';
export { default as MobileHeader } from './layout/MobileHeader';
export { default as BottomSheet } from './BottomSheet';
export { default as FilterSheet } from './FilterSheet';
export type { FilterOptions } from './FilterSheet';
export { defaultFilters } from './FilterSheet';
export { default as NotificationsSheet } from './NotificationsSheet';
export type { Notification } from './NotificationsSheet';

// Gamification
export { default as StreakBadge } from './gamification/StreakBadge';
export { default as StreakCard } from './gamification/StreakCard';
export { default as StreakInline } from './gamification/StreakInline';
export { default as XPBar } from './gamification/XPBar';
export { default as LevelBadge } from './gamification/LevelBadge';
export { default as DailyGoalCard } from './gamification/DailyGoalCard';
export { default as StreakCalendar } from './gamification/StreakCalendar';
export { default as WeeklyRankCard } from './gamification/WeeklyRankCard';
export { default as PracticeAICard } from './gamification/PracticeAICard';
export { default as WeeklyMissionCard } from './gamification/WeeklyMissionCard';
export { default as BadgeProgressCard } from './gamification/BadgeProgressCard';
export { default as LeaderboardPodium } from './gamification/LeaderboardPodium';
export { default as LeaderboardRow } from './gamification/LeaderboardRow';
export { default as BadgeGrid } from './gamification/BadgeGrid';
export { default as WeeklyChallenge } from './gamification/WeeklyChallenge';
export { default as ProgressRing } from './gamification/ProgressRing';
export { default as CelebrationModal } from './gamification/CelebrationModal';
export type { Badge } from './gamification/BadgeGrid';
export type { Challenge } from './gamification/WeeklyChallenge';

// Learning
export { default as ContinueCard } from './learning/ContinueCard';
export { default as QuickActionGrid } from './learning/QuickActionGrid';
export { default as LearningPath } from './learning/LearningPath';
export { default as PathNode } from './learning/PathNode';
export { default as PathSection } from './learning/PathSection';
export { default as ModuleListItem } from './learning/ModuleListItem';
export { default as CampaignProgressCard } from './learning/CampaignProgressCard';
export { default as CourseCard } from './learning/CourseCard';
export { default as OngoingCourseCard } from './learning/OngoingCourseCard';
export { default as ChallengeCard } from './learning/ChallengeCard';
export { default as HeroCard } from './learning/HeroCard';
export { default as ContinueLearningCard } from './learning/ContinueLearningCard';
export type { PathNodeData } from './learning/LearningPath';
export type { PathNodeStatus } from './learning/PathNode';
export type { ModuleStatus } from './learning/ModuleListItem';

// Video
export { default as ProgressDots } from './video/ProgressDots';
export { default as LikertScale } from './video/LikertScale';
export { default as SwipeHint } from './video/SwipeHint';
export { default as TextQuestion } from './video/TextQuestion';

// Profile
export { default as ProfileHeader } from './profile/ProfileHeader';
export { default as StatsRow } from './profile/StatsRow';
export { default as SkillBreakdown } from './profile/SkillBreakdown';
export { default as ActivitySummary } from './profile/ActivitySummary';
export { default as MenuList } from './profile/MenuList';
export type { MenuItem, MenuGroup } from './profile/MenuList';

// Comparison
export { default as ComparisonSummary } from './comparison/ComparisonSummary';
export { default as ComparisonSlider } from './comparison/ComparisonSlider';
export { default as AIInsightCard } from './comparison/AIInsightCard';

// Shared
export { default as Card } from './shared/Card';
export { default as Button } from './shared/Button';
export { default as SectionHeader } from './shared/SectionHeader';
export { default as SearchBar } from './shared/SearchBar';
export { default as Skeleton, CardSkeleton, ListItemSkeleton, StatsSkeleton } from './shared/SkeletonLoader';
export { default as EmptyState } from './shared/EmptyState';
export { default as PullToRefresh } from './shared/PullToRefresh';

// Also export Avatar from shared (located in root shared folder)
export { default as Avatar } from '../shared/Avatar';
