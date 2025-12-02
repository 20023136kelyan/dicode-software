export type UserRole = 'admin' | 'employee';

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
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role?: UserRole) => Promise<void>;
  loginWithGoogle?: (role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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

export interface CopilotContext {
  userRole: UserRole;
  currentPage?: string;
  relevantData?: {
    scores?: number[];
    trends?: string[];
    insights?: string[];
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
  role: 'admin' | 'employee';
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
  description?: string;
  employeeIds: string[];
  organization?: string; // Organization ID
  createdAt: Date;
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
export type QuestionType = 'behavioral-perception' | 'behavioral-intent' | 'qualitative';
export type QuestionRole = 'perception' | 'intent' | 'qualitative';
export type ScaleType = '4-point' | '5-point' | '7-point';

export interface Question {
  id: string;
  type: QuestionType;
  role?: QuestionRole;
  statement: string;
  scaleType?: ScaleType; // Only for quantitative questions
  scaleLabels?: {
    low: string;
    high: string;
  };
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
  answer: string | number | boolean;
  answeredAt: Date | string | number;
  metadata?: {
    questionType?: string;
    questionText?: string;
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
