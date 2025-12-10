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

export interface GenerationResult {
  task_id: string;
  sequence_id?: string;
  video_ids?: string[];
  status?: string;
  error?: string;
}

export interface ProgressEvent {
  type: 'shot_start' | 'progress' | 'shot_complete' | 'complete' | 'error';
  shot_number?: number;
  progress?: number;
  message?: string;
  error?: string;
  result?: GenerationResult;
}

export interface BackgroundJob {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: { [shotNumber: number]: number };
  shots: ShotData[];
  quality: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  result?: GenerationResult;
  error?: string;
}

// Campaign System Types

export interface CampaignEnrollment {
  id?: string;
  campaignId: string;
  userId: string;
  organizationId: string;
  status: 'not-started' | 'in-progress' | 'completed';
  enrolledAt: any; // Timestamp
  completedAt?: any; // Timestamp
  accessCount: number;
  metadata: {
    enrolledBy?: string;
    autoEnrolled?: boolean;
  };
}

export interface CampaignProgress {
  id?: string;
  campaignId: string;
  userId: string;
  videoId: string;
  watchedDuration: number; // in seconds
  totalDuration: number; // in seconds
  completed: boolean;
  lastWatchedAt: any; // Timestamp
  questionsAnswered?: string[]; // IDs of questions answered for this video
  allQuestionsAnswered: boolean;
}

export interface CampaignResponse {
  id?: string;
  campaignId: string;
  userId: string;
  videoId: string;
  questionId: string;
  answer: string | number; // Text or scale value
  answeredAt: any; // Timestamp
}

export interface CampaignNotification {
  id?: string;
  campaignId: string;
  userId: string;
  organizationId: string;
  type: 'invitation' | 'reminder' | 'completion';
  status: 'pending' | 'sent' | 'failed';
  recipientEmail: string;
  scheduledFor: any; // Timestamp
  sentAt?: any; // Timestamp
  retryCount: number;
  failureReason?: string;
  metadata?: {
    campaignTitle?: string;
    userName?: string;
  };
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
}

export interface CampaignInstance {
  id?: string;
  parentCampaignId: string;
  instanceNumber: number;
  startDate: any; // Timestamp
  endDate: any; // Timestamp
  status: 'active' | 'completed' | 'archived';
  stats: {
    totalEnrollments: number;
    completedCount: number;
    averageCompletionTime?: number;
  };
  metadata: {
    createdAt: any; // Timestamp
    createdBy: string; // System or Admin ID
  };
}

export type QuestionType = 'behavioral-perception' | 'behavioral-intent' | 'qualitative';
export type QuestionRole = 'perception' | 'intent' | 'qualitative';
export type ScaleType = '4-point' | '5-point' | '7-point';
export type VideoSource = 'generated' | 'uploaded';

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

export interface Video {
  id: string;
  title: string;
  description?: string;
  storageUrl: string; // Firebase Storage URL
  thumbnailUrl?: string;
  source: VideoSource;
  duration?: number; // in seconds
  questions?: Question[]; // 1-3 questions per video (DI Code framework: 2 quantitative + 1 qualitative)
  generationData?: {
    shots?: ShotData[];
    remixShots?: RemixShotData[];
    quality?: string;
    model?: string;
    sequenceId?: string;
    usedAssets?: string[]; // Asset IDs used to generate this video
  };
  allowedOrganizations?: string[]; // Empty or undefined = accessible to all (Global)
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string; // User ID
    tags?: string[];
  };
}

export interface CampaignItem {
  id: string;
  campaignId: string;
  videoId: string;
  order: number; // Position in campaign sequence
  questions?: Question[]; // DEPRECATED: Questions now stored on Video. Optional for backward compatibility during migration.
  metadata: {
    createdAt: Date;
    updatedAt: Date;
  };
}

export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organization?: string;
  department?: string;
  avatar?: string;
  createdAt?: any;
  lastLogin?: any;
}

// User Profile for DiCode staff (stored in Firestore)
export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  campaign_updates: boolean;
  video_generation: boolean;
  team_activity: boolean;
  system_alerts: boolean;
  browser_notifications: boolean;
}

// Support Tickets
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketCategory = 'bug' | 'feature' | 'question' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  category: TicketCategory;
  status: TicketStatus;
  assignedTo?: string;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  skillFocus: string; // Main skill being taught
  items: CampaignItem[]; // Ordered list of videos with questions
  source?: 'dicode' | 'organization'; // 'dicode' = created by DiCode team in Workspace, 'organization' = created by client

  // Access & Targeting
  allowedOrganizations?: string[]; // Organizations that can participate in this campaign
  allowedDepartments?: string[];
  allowedEmployeeIds?: string[];
  allowedCohortIds?: string[];

  selectedSkills?: Record<string, string[]>; // Competency ID -> Skill IDs

  // Configuration
  anonymousResponses?: boolean;
  campaignType?: string;
  pinned?: boolean;

  schedule?: {
    startDate: string;
    endDate: string;
    frequency: 'once' | 'weekly' | 'monthly' | 'quarterly';
  };

  automation?: {
    autoSendInvites: boolean;
    sendReminders: boolean;
    maxReminders?: number;
    reminderFrequency?: number;
    sendConfirmations: boolean;
  };

  accessControl?: {
    oneTimeAccess: boolean;
    maxAccessCount?: number;
  };

  recurringConfig?: {
    parentCampaignId?: string;
    instanceNumber?: number;
    createdFromRecurrence: boolean;
  };

  stats?: {
    totalEnrollments: number;
    completedCount: number;
    inProgressCount: number;
    notStartedCount: number;
  };

  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string; // User ID
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

// Firestore document types (for database operations)
export interface CampaignDoc extends Omit<Campaign, 'items'> {
  itemIds: string[]; // Reference to CampaignItem IDs in order
}

export interface VideoUploadData {
  file: File;
  title: string;
  description?: string;
  tags?: string[];
}

// UI State Types
export interface CampaignFormData {
  title: string;
  description: string;
  skillFocus: string;
  tags?: string[];
}

export interface QuestionFormData {
  role: QuestionRole;
  type: QuestionType;
  statement: string;
  // Q1 (behavioral-perception): Likert scale settings
  scaleType?: ScaleType;
  scaleLabels?: {
    low: string;
    high: string;
  };
  benchmarkScore?: number; // Q1 only: Expert/control answer (1-7)
  // Q2 (behavioral-intent): SJT multiple choice options
  options?: IntentOption[]; // Q2 only: Multiple choice options with hidden scores
  // Competency/skill tagging
  competency?: string;
  competencyId?: string;
  skillId?: string;
  isRequired: boolean;
}

// Asset Store Types
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

export interface AssetMetadata {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  tags?: string[];
  usageCount?: number;
  promptSchemaVersion?: number;
  lastUsedAt?: Date;
  pinned?: boolean;
}

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  description: string;
  promptMetadata?: AssetPromptMetadata;
  metadata: AssetMetadata;
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

// Activity Tracking Types

export type ActivityAction =
  | 'campaign_created'
  | 'campaign_updated'
  | 'campaign_published'
  | 'campaign_deleted'
  | 'video_generated'
  | 'video_uploaded'
  | 'video_updated'
  | 'video_deleted'
  | 'access_updated'
  | 'bulk_access_updated'
  | 'asset_created'
  | 'asset_updated'
  | 'asset_deleted'
  | 'access_updated';

export type ActivityResourceType = 'campaign' | 'video' | 'asset' | 'access';

export interface Activity {
  id?: string;
  action: ActivityAction;
  userId: string;
  userEmail: string;
  userName?: string;
  resourceId: string;
  resourceName: string;
  resourceType: ActivityResourceType;
  metadata?: Record<string, any>;
  userAvatar?: string;
  createdAt: any; // Timestamp
}

// Notification System Types

export type NotificationType =
  | 'video_generation_complete'
  | 'video_generation_failed'
  | 'video_generation_progress'
  | 'campaign_published'
  | 'campaign_starting'
  | 'campaign_ending'
  | 'team_activity'
  | 'system_alert';

export type NotificationPriority = 'low' | 'normal' | 'high';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  readBy: string[]; // Array of user IDs who have read this notification
  staffOnly?: boolean; // If true, only DiCode staff can see this notification
  actorId?: string; // Who triggered this (for team activity)
  actorName?: string;
  actorEmail?: string;
  resourceId?: string;
  resourceType?: ActivityResourceType | 'job';
  resourceName?: string;
  actionUrl?: string; // Link to navigate when clicked
  progress?: number; // For progress notifications (0-100)
  createdAt: any; // Timestamp
  expiresAt?: any; // Optional expiration
}
