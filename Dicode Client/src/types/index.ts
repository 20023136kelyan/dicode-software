export type UserRole = 'admin' | 'employee' | 'applicant';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  organization?: string;
  avatar?: string;
  cohortIds?: string[];
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  dateOfBirth?: Date | string | number;
  requirePasswordChange?: boolean; // True if user needs to change password (from temp password)
  onboardingCompletedAt?: Date | string | number; // Timestamp when onboarding was completed
  invitationId?: string; // Link to the invitation document that created this account
}

export interface AuthState {
  user: User | null;
  organization?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  loginWithGoogle?: (role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateAvatar: (file: File, onProgress?: (progress: number) => void) => Promise<string>;
}

// Analytics Types
export interface CompetencyScore {
  date: string;
  overallScore: number;
  psychologicalSafety: number;
  prosocialNorms: number;
  collaboration: number;
  growth: number;
}

export interface LeadershipMetrics {
  currentScore: number;
  trend: number; // percentage change
  performanceStatus: 'outperforming' | 'underperforming' | 'on-track';
  timeSeriesData: CompetencyScore[];
}

export interface SubCompetency {
  id: string;
  name: string;
  score: number;
  trend: number;
}

export interface CompetencyDetail {
  id: string;
  name: string;
  overallScore: number;
  trend: number;
  subCompetencies: SubCompetency[];
  timeSeriesData: Array<{
    date: string;
    overall: number;
    [key: string]: number | string;
  }>;
}

// Employee Types
export interface AssessmentQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'scale' | 'video-response';
  options?: string[];
  scaleRange?: { min: number; max: number; minLabel: string; maxLabel: string };
}

export interface VideoModule {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  duration: number; // in seconds
  questions: InteractiveQuestion[];
  competencies: string[];
}

export interface InteractiveQuestion {
  id: string;
  timestamp: number; // when to show the question in the video
  question: string;
  type: 'multiple-choice' | 'scale';
  options?: string[];
  correctAnswer?: string | number;
  scaleRange?: { min: number; max: number; minLabel: string; maxLabel: string };
}

export interface EmployeeResponse {
  userId: string;
  questionId: string;
  answer: string | number;
  timestamp: Date;
}

export interface PeerComparison {
  question: string;
  userAnswer: string | number;
  agreePercentage: number;
  disagreePercentage: number;
  isUserInMajority: boolean;
}

export interface LearningProgram {
  id: string;
  userId: string;
  modules: VideoModule[];
  currentModuleIndex: number;
  completedModules: string[];
  startDate: Date;
  lastActivityDate: Date;
}

// AI Copilot Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestedQuestions?: string[];
  metadata?: {
    dataPoints?: string[];
    charts?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  organizationId?: string;
  title: string;
  messages: ChatMessage[];
  context: CopilotContext;
  createdAt: Date;
  updatedAt: Date;
}

export interface CopilotContext {
  userRole: UserRole;
  currentPage?: string;
  relevantData?: {
    scores?: number[];
    trends?: string[];
    insights?: string[];
  };
  // Enhanced context for employee learning
  learningContext?: {
    currentCampaign?: string;
    currentCampaignTitle?: string;
    currentModule?: string;
    currentModuleTitle?: string;
    recentScores?: number[];
    weakCompetencies?: string[];
    strongCompetencies?: string[];
    streakStatus?: {
      current: number;
      atRisk: boolean; // true if might lose streak tomorrow
    };
    justCompleted?: {
      type: 'module' | 'campaign';
      title: string;
      score?: number;
      xpEarned?: number;
    };
    suggestedPrompts?: string[];
  };
}

// Admin Analytics Types
export interface EmployeeProgress {
  employeeId: string;
  employeeName: string;
  department: string;
  completedModules: number;
  totalModules: number;
  averageScore: number;
  lastActivity: Date;
  engagementLevel: 'high' | 'medium' | 'low';
}

export interface DepartmentAnalytics {
  department: string;
  employeeCount: number;
  averageCompletionRate: number;
  averageScore: number;
  topCompetencies: string[];
  improvementAreas: string[];
}

export interface EngagementMetrics {
  totalUsers: number;
  activeUsers: number;
  averageSessionDuration: number;
  completionRate: number;
  npsScore: number;
}

export interface BusinessOutcome {
  metric: string;
  baseline: number;
  current: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: Date;
}

// Employee Management Types
export interface Employee {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  organization?: string;
  avatar?: string;
  cohortIds?: string[];
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  dateOfBirth?: Date | string | number;
  createdAt: Date;
  lastLogin?: Date;
  status: 'active' | 'inactive';
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  region?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  departments: string[];
  settings: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
  };
  adminIds: string[];
  subscription?: {
    plan: 'free' | 'professional' | 'enterprise';
    status: 'active' | 'trial' | 'expired';
    expiresAt?: Date | string | number;
  };
  metadata: {
    createdAt: Date | string | number;
    updatedAt: Date | string | number;
    createdBy: string;
  };
}

export interface Cohort {
  id: string;
  name: string;
  description?: string | null;
  employeeIds: string[];
  organization?: string | null; // Organization ID
  createdAt: Date;
  updatedAt?: Date;
}

// Invitation Types
export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Invitation {
  id: string;
  organizationId: string;
  organizationName: string; // For display on invite page
  email: string;
  role: UserRole;
  department?: string;
  cohortIds?: string[];
  token: string; // Unique invite token (UUID)
  status: InvitationStatus;
  invitedBy: string; // User ID of admin who sent invite
  expiresAt: Date | string | number;
  createdAt: Date | string | number;
  acceptedAt?: Date | string | number;
  userId?: string; // Firebase Auth User ID (created when invitation is created)
  passwordResetLink?: string; // Password reset link for first-time login
  passwordChanged?: boolean; // True if user has changed their password
  metadata?: {
    inviteeName?: string; // Optional pre-filled name
  };
}

// Shared Firebase Content Types
export type VideoSource = 'generated' | 'uploaded';

// Question Types (from workspace)
export type QuestionType = 'behavioral-perception' | 'behavioral-intent' | 'qualitative' | 'commitment';
export type QuestionRole = 'perception' | 'intent' | 'qualitative';
export type ScaleType = '4-point' | '5-point' | '7-point';

// SJT (Situational Judgment Test) option for Q2 behavioral-intent questions
export interface IntentOption {
  id: string;
  text: string;
  intentScore: number; // 1-7, hidden from learners, used for analytics
}

export interface Question {
  id: string;
  type: QuestionType;
  role?: QuestionRole;
  statement: string;
  // Q1 (behavioral-perception): Likert scale settings
  scaleType?: ScaleType; // Only for Q1
  scaleLabels?: {
    low: string;
    high: string;
  };
  benchmarkScore?: number; // Q1 only: Expert/control answer (1-7) for comparison
  // Q2 (behavioral-intent): SJT multiple choice options
  options?: IntentOption[]; // Q2 only: Multiple choice options with hidden scores
  // Competency/skill tagging (required for Q1 and Q2)
  competency?: string; // For behavioral questions
  competencyId?: string;
  skillId?: string;
  isRequired: boolean;
  validationErrors?: string[]; // For client-side validation feedback
}

export interface ShotData {
  character?: string;
  environment?: string;
  lighting?: string;
  camera?: string;
  dialog: string;
  image?: File | null;
}

export interface RemixShotData {
  dialog: string;
  description?: string;
}

export interface VideoGenerationData {
  shots?: ShotData[];
  remixShots?: RemixShotData[];
  quality?: string;
  model?: string;
  sequenceId?: string;
  usedAssets?: string[]; // Asset IDs used to generate this video
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  storageUrl: string;
  thumbnailUrl?: string;
  source: VideoSource;
  duration?: number;
  allowedOrganizations?: string[]; // Empty or undefined = accessible to all (Global)
  questions?: Question[]; // 1-3 questions per video (DI Code framework: 2 quantitative + 1 qualitative)
  generationData?: VideoGenerationData;
  metadata: {
    createdAt: Date | string | number;
    updatedAt: Date | string | number;
    createdBy: string;
    tags?: string[];
    usageCount?: number;
  };
}

export interface CampaignItem {
  id: string;
  campaignId: string;
  videoId: string;
  order: number;
  questions?: InteractiveQuestion[]; // DEPRECATED: Questions now stored on Video. Optional for backward compatibility during migration.
  metadata: {
    createdAt: Date | string | number;
    updatedAt: Date | string | number;
  };
}

export interface ModuleProgress {
  videoFinished: boolean;
  questionsAnswered: number;
  questionTarget: number;
  completed: boolean;
  completedAt?: Date | string | number;
  answeredQuestionIds?: string[];
}

export type CampaignFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  skillFocus: string;
  items: CampaignItem[];
  source?: 'dicode' | 'organization'; // 'dicode' = created by DiCode team in Workspace, 'organization' = created by client organization
  pinned?: boolean; // Whether campaign is pinned for quick access
  campaignType?: string; // Template ID used to create this campaign (e.g., 'onboarding', 'leadership')
  anonymousResponses?: boolean; // Whether participant identities should be hidden in response data
  allowedOrganizations?: string[]; // Empty or undefined = accessible to all organizations
  allowedDepartments?: string[];   // Target specific departments within organization
  allowedEmployeeIds?: string[];   // Target individual employees
  allowedCohortIds?: string[];     // Target cohorts/groups
  allowedRoles?: UserRole[];       // Target specific roles (e.g. 'applicant', 'employee')

  // Scheduling & Automation
  schedule?: {
    startDate?: Date | string | number;
    endDate?: Date | string | number;
    frequency: CampaignFrequency;
  };

  accessControl?: {
    oneTimeAccess: boolean;  // If true, employees can only access once
    maxAccessCount?: number; // Maximum number of times employee can access (if oneTimeAccess is false)
  };

  automation?: {
    autoSendInvites: boolean;     // Auto-send invitation emails when campaign published
    sendReminders: boolean;        // Send reminder emails to non-respondents
    reminderFrequency?: number;    // Days between reminders (e.g., 3 = every 3 days)
    maxReminders?: number;         // Maximum number of reminders to send
    sendConfirmations: boolean;    // Send completion confirmation emails
  };

  stats?: {
    totalEnrollments: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
  };

  // Recurring campaign configuration
  recurringConfig?: {
    parentCampaignId?: string;  // Reference to parent campaign if this is a recurring instance
    instanceNumber?: number;     // Which instance this is (1st, 2nd, 3rd, etc.)
    createdFromRecurrence: boolean;
  };

  metadata: {
    createdAt: Date | string | number;
    updatedAt: Date | string | number;
    createdBy: string;
    version: number;
    isPublished: boolean;
    tags?: string[];
    computed?: {
      totalItems: number;
      totalQuestions: number;
      durationSeconds: number;
      estimatedMinutes: number;
      totalXP: number;
    };
  };
}

export interface CampaignDoc extends Omit<Campaign, 'items'> {
  itemIds: string[];
}

// Campaign Enrollment - tracks which users are enrolled in which campaigns
export type EnrollmentStatus = 'not-started' | 'in-progress' | 'completed';

export interface CampaignEnrollment {
  id: string;
  campaignId: string;
  userId: string;
  organizationId: string;
  status: EnrollmentStatus;
  enrolledAt: Date | string | number;
  startedAt?: Date | string | number;
  completedAt?: Date | string | number;
  accessCount: number; // How many times user has accessed the campaign
  lastAccessedAt?: Date | string | number;
  totalModules?: number;
  completedModules?: number;
  moduleProgress?: Record<string, ModuleProgress>;
  metadata: {
    enrolledBy?: string; // Admin who enrolled the user (if manual enrollment)
    autoEnrolled: boolean; // Whether user was auto-enrolled when campaign published
  };
}

// Campaign Progress - tracks progress on individual videos within a campaign
export interface CampaignProgress {
  id: string;
  campaignId: string;
  userId: string;
  videoId: string;
  organizationId: string;

  // Video progress
  watchedDuration: number; // Seconds watched
  totalDuration: number;   // Total video duration
  completed: boolean;      // Whether video was fully watched
  lastWatchedAt: Date | string | number;

  // Question progress
  questionsAnswered: string[]; // Array of question IDs answered
  totalQuestions: number;
  allQuestionsAnswered: boolean;

  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}

// Campaign Response - stores user answers to questions
export interface CampaignResponse {
  id: string;
  campaignId: string;
  videoId: string;
  questionId: string;
  userId: string;
  organizationId: string;
  // Answer field - supports different question types
  answer: string | number | boolean;
  // Q2 (behavioral-intent) SJT specific fields
  selectedOptionId?: string; // Which option the user selected
  intentScore?: number; // The hidden score of the selected option (1-7)
  answeredAt: Date | string | number;
  metadata?: {
    questionType?: QuestionType;
    questionText?: string;
    competencyId?: string;
    skillId?: string;
    // SJT (behavioral-intent) specific fields stored in metadata
    selectedOptionId?: string;
    intentScore?: number;
  };
}

// Campaign Notification - queue for email notifications
export type NotificationType = 'invitation' | 'reminder' | 'completion';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface CampaignNotification {
  id: string;
  campaignId: string;
  userId: string;
  organizationId: string;
  type: NotificationType;
  status: NotificationStatus;
  recipientEmail: string;
  scheduledFor: Date | string | number;
  sentAt?: Date | string | number;
  failureReason?: string;
  retryCount: number;
  metadata?: {
    campaignTitle?: string;
    userName?: string;
  };
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}

// Campaign Instance - for recurring campaigns
export interface CampaignInstance {
  id: string;
  parentCampaignId: string;  // Original campaign that spawned this instance
  organizationId: string;
  instanceNumber: number;     // 1st, 2nd, 3rd occurrence
  startDate: Date | string | number;
  endDate: Date | string | number;
  createdAt: Date | string | number;
  stats: {
    totalEnrollments: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
  };
}

export type AssetType = 'character' | 'environment' | 'lighting' | 'camera';

export interface CharacterAssetPromptDetails {
  archetype?: string;
  physicalTraits?: string;
  wardrobe?: string;
  expression?: string;
  pose?: string;
  motion?: string;
  cameraNotes?: string;
  lighting?: string;
  colorPalette?: string;
  signatureProps?: string;
  emotion?: string;
  reference?: string;
  additionalNotes?: string;
}

export interface EnvironmentAssetPromptDetails {
  setting?: string;
  scale?: string;
  architecture?: string;
  foliage?: string;
  weather?: string;
  timeOfDay?: string;
  mood?: string;
  activity?: string;
  keyProps?: string;
  depth?: string;
  colorPalette?: string;
  cameraNotes?: string;
  reference?: string;
  additionalNotes?: string;
}

export interface LightingAssetPromptDetails {
  style?: string;
  quality?: string;
  direction?: string;
  colorTemperature?: string;
  intensity?: string;
  modifiers?: string;
  contrast?: string;
  atmosphere?: string;
  reference?: string;
  additionalNotes?: string;
}

export interface CameraAssetPromptDetails {
  lens?: string;
  framing?: string;
  movement?: string;
  height?: string;
  speed?: string;
  focus?: string;
  composition?: string;
  reference?: string;
  additionalNotes?: string;
}

export type AssetPromptMetadata =
  | {
    type: 'character';
    schemaVersion: number;
    details: CharacterAssetPromptDetails;
  }
  | {
    type: 'environment';
    schemaVersion: number;
    details: EnvironmentAssetPromptDetails;
  }
  | {
    type: 'lighting';
    schemaVersion: number;
    details: LightingAssetPromptDetails;
  }
  | {
    type: 'camera';
    schemaVersion: number;
    details: CameraAssetPromptDetails;
  };

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  description: string;
  promptMetadata?: AssetPromptMetadata;
  metadata: {
    createdAt: Date | string | number;
    updatedAt: Date | string | number;
    createdBy: string;
    tags?: string[];
    usageCount?: number;
  };
}

// ============================================
// GAMIFICATION & SKILL PROGRESSION TYPES
// ============================================

// Skill progress within a competency
export interface SkillProgress {
  skillId: string;
  skillName: string;
  level: number; // 1-5 stars
  xp: number;
  responsesCount: number;
  averageScore: number; // 0-100
  lastUpdated: Date | string | number;
}

// ============================================
// SKILL ASSESSMENT TRACKING TYPES
// ============================================

// Historical skill assessment record
export interface SkillAssessment {
  id: string;
  userId: string;
  organizationId: string;

  // What was assessed
  competencyId: string;
  skillId: string;

  // Source
  campaignId: string;
  videoId: string;
  questionId: string;
  questionType: 'behavioral-perception' | 'behavioral-intent';

  // Scoring
  rawAnswer: number;           // User's raw answer
  benchmarkScore?: number;     // Q1 only: expert answer
  calculatedScore: number;     // 0-100 normalized score

  assessedAt: Date | string | number;
}

// Score history entry for sparkline display
export interface SkillScoreHistory {
  score: number;
  date: string; // YYYY-MM-DD
}

// Enhanced skill tracking with level progression
export interface SkillScore {
  skillId: string;
  skillName: string;
  competencyId: string;
  currentScore: number;        // Latest calculated score (0-100)
  averageScore: number;        // Rolling average
  assessmentCount: number;     // Total assessments
  level: number;               // 1-5
  consecutiveAboveThreshold: number;  // For level-up tracking
  lastAssessedAt?: Date | string | number;
  history: SkillScoreHistory[];  // Last 10 scores for sparkline
}

// Competency-level aggregate score (for skill tracking)
export interface CompetencyScoreAggregate {
  competencyId: string;
  competencyName: string;
  currentScore: number;        // Average of child skill scores
  level: number;               // 1-5
  skillCount: number;          // Total skills in competency
  assessedSkillCount: number;  // Skills that have been assessed
  lastAssessedAt?: Date | string | number;
}

// Competency progress containing multiple skills
export interface CompetencyProgress {
  competencyId: string;
  competencyName: string;
  level: number; // 1-5 stars (average of skills)
  xp: number;
  skills: Record<string, SkillProgress>;
  lastUpdated: Date | string | number;
}

// Badge definition
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or icon name
  earnedAt?: Date | string | number;
  criteria: {
    type: 'streak' | 'modules' | 'xp' | 'level' | 'perfect_score' | 'first_completion';
    threshold: number;
  };
}

// Streak data
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string; // YYYY-MM-DD format
  streakFreezeAvailable: boolean;
  weeklyGoal: number; // modules per week
  weeklyProgress: number;
}

// Main User Skill Profile - stored in Firestore
export interface UserSkillProfile {
  userId: string;
  organizationId: string;

  // Overall progression
  overallLevel: number; // 1-100
  totalXP: number;

  // Competency breakdown (legacy)
  competencies: Record<string, CompetencyProgress>;

  // NEW: Skill-level tracking with scores
  skills?: Record<string, SkillScore>;

  // NEW: Competency-level aggregates
  competencyScores?: Record<string, CompetencyScoreAggregate>;

  // Streak tracking
  streak: StreakData;

  // Badges earned (badge IDs)
  badges: string[];
  badgeDetails: Badge[];

  // Statistics
  stats: {
    modulesCompleted: number;
    campaignsCompleted: number;
    questionsAnswered: number;
    totalWatchTime: number; // in seconds
    averageScore: number; // 0-100
  };

  // Timestamps
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}

// XP Award result from completing actions
export interface XPAwardResult {
  xpEarned: number;
  totalXP: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  newBadges: Badge[];
  streakUpdated: boolean;
  newStreak: number;
}

// Level threshold configuration
export interface LevelThreshold {
  level: number;
  minXP: number;
  maxXP: number;
  title: string;
  tier: 'beginner' | 'learner' | 'practitioner' | 'expert' | 'master';
}

// XP sources and their values
export type XPActionType =
  | 'watch_video'
  | 'answer_question'
  | 'complete_module'
  | 'complete_campaign'
  | 'daily_streak'
  | 'perfect_score'
  | 'first_completion';

export interface XPAction {
  type: XPActionType;
  baseXP: number;
  description: string;
}

// Campaign completion summary for the completed campaign experience
export interface CampaignCompletionSummary {
  campaignId: string;
  campaignTitle: string;
  completedAt: Date | string | number;
  timeSpent: number; // in seconds
  modulesCompleted: number;
  totalModules: number;
  questionsAnswered: number;
  averageScore: number;
  xpEarned: number;
  badgesEarned: Badge[];
  competenciesImproved: Array<{
    competencyId: string;
    competencyName: string;
    previousLevel: number;
    newLevel: number;
    xpGained: number;
  }>;
  peerComparison?: {
    percentile: number; // e.g., "top 25%"
    averageOrgScore: number;
  };
}

// ============================================================================
// STREAK SYSTEM
// ============================================================================

export type StreakStatus = 'active' | 'ended' | 'broken';

/**
 * Represents a single streak period for a user.
 * A new streak starts when a user completes a campaign after a gap in activity.
 * A streak ends when the user misses a day.
 */
export interface UserStreak {
  id: string;
  userId: string;
  organizationId: string;

  // Streak timing
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string | null; // null if streak is still active
  length: number; // Number of consecutive days

  // Status
  status: StreakStatus;

  // Activity tracking
  activeDates: string[]; // Array of ISO date strings when campaigns were completed
  completedCampaignIds: string[]; // Campaign IDs completed during this streak

  // Metadata
  longestInHistory: boolean; // True if this was user's longest streak when it ended

  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}

/**
 * Summary of a user's overall streak history and current status
 */
export interface UserStreakSummary {
  userId: string;

  // Current state
  currentStreakId: string | null; // ID of active streak, null if none
  currentStreak: number; // Current streak length (0 if no active streak)
  streakAtRisk: boolean; // True if user hasn't completed today but has active streak
  completedToday: boolean;
  lastActivityDate: string | null; // Last date a campaign was completed

  // Historical stats
  longestStreak: number;
  longestStreakStartDate: string | null;
  longestStreakEndDate: string | null;
  totalStreaks: number; // Number of streaks (including current)
  totalActiveDays: number; // Total days with campaign completions
  averageStreakLength: number;

  // Achievements
  streakMilestones: number[]; // Milestones achieved (e.g., [7, 14, 30, 60, 100])
}

/**
 * Event logged when streak status changes
 */
export interface StreakEvent {
  id: string;
  userId: string;
  streakId: string;
  eventType: 'streak_started' | 'streak_continued' | 'streak_ended' | 'streak_broken' | 'milestone_reached';
  eventDate: string; // ISO date string

  // Context
  streakLength: number; // Streak length at time of event
  campaignId?: string; // Campaign that triggered this event (if applicable)
  milestone?: number; // Milestone number if eventType is 'milestone_reached'

  createdAt: Date | string | number;
}

// ============================================================================
// EMPLOYEE NOTIFICATION SYSTEM
// ============================================================================

export type EmployeeNotificationType =
  | 'badge_earned'      // Earned a new badge
  | 'campaign_completed' // Completed a campaign
  | 'streak_milestone'   // Hit a streak milestone (7, 14, 30, etc.)
  | 'streak_at_risk'     // Streak might break tomorrow
  | 'streak_broken'      // Streak was broken
  | 'new_campaign'       // New campaign available
  | 'campaign_reminder'  // Reminder about incomplete campaign
  | 'level_up'           // Leveled up
  | 'skill_mastered'     // Reached max level on a skill
  | 'welcome'            // Welcome notification for new users
  | 'system';            // System notification

export type EmployeeNotificationPriority = 'low' | 'normal' | 'high';

/**
 * Employee notification stored in Firestore
 * Collection: employeeNotifications
 */
export interface EmployeeNotification {
  id: string;
  userId: string;
  organizationId: string;

  // Content
  type: EmployeeNotificationType;
  title: string;
  message: string;
  priority: EmployeeNotificationPriority;

  // Status
  read: boolean;
  readAt?: Date | string | number;

  // Optional action
  actionUrl?: string;           // Deep link to navigate to
  actionLabel?: string;         // Button label

  // Related resources
  resourceType?: 'campaign' | 'badge' | 'streak' | 'skill';
  resourceId?: string;
  resourceName?: string;

  // Metadata
  metadata?: {
    badgeId?: string;
    badgeName?: string;
    badgeIcon?: string;
    campaignId?: string;
    campaignTitle?: string;
    streakLength?: number;
    skillId?: string;
    skillName?: string;
    skillLevel?: number;
    xpEarned?: number;
    newLevel?: number;
  };

  // Timestamps
  createdAt: Date | string | number;
  expiresAt?: Date | string | number;  // Optional TTL for auto-cleanup
}

// Admin/Organization Notifications
export type AdminNotificationType =
  | 'system_alert'
  | 'user_joined'
  | 'campaign_status'
  | 'license_limit'
  | 'organization_update';

export interface AdminNotification {
  id: string;
  organizationId: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: any; // Firestore Timestamp
  link?: string; // Optional action link
  metadata?: Record<string, any>;
}
