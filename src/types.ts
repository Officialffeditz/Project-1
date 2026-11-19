export type ContentCategory =
  | 'educational'
  | 'productive_work'
  | 'distracting_short_form'
  | 'social_feed'
  | 'gaming';

export type RuleCategory = 'short_form' | 'social_feed' | 'gaming' | 'custom';
export type RuleMode = 'strict_lock' | 'timeout_10m' | 'work_hours_lock';
export type OSPlatform = 'macOS' | 'Windows' | 'Linux' | 'iOS' | 'Android';
export type DeviceFormFactor = 'desktop' | 'mobile' | 'tablet';
export type ScheduleType = 'work_study' | 'downtime';

export type ActionTaken =
  | 'allowed_unlimited'
  | 'gentle_nudge'
  | 'timeout_blocked'
  | 'work_hours_locked'
  | 'focus_completed';

export interface UserProfileState {
  uid: string;
  displayName: string;
  email: string;
  rewardBankMinutes: number;
  shortFormMinutesToday: number;
  timeoutActiveUntil: number;
  leisurePassUntil: number;
  strictModeEnabled: boolean;
  focusEndsAt: number;
  focusDurationMinutes: number;
}

export interface SyncedDevice {
  id: string;
  ownerId: string;
  name: string;
  os: OSPlatform;
  formFactor: DeviceFormFactor;
  enforcementActive: boolean;
  lastSeenAtMs: number;
}

export interface BlockRule {
  id: string;
  ownerId: string;
  target: string;
  pattern: string;
  category: RuleCategory;
  mode: RuleMode;
  enabled: boolean;
  platforms: OSPlatform[];
}

export interface DowntimeSchedule {
  id: string;
  ownerId: string;
  name: string;
  scheduleType: ScheduleType;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  days: string[];    // ['Mon', 'Tue', ...]
  lockGames: boolean;
  lockSocialAndShorts: boolean;
  enabled: boolean;
}

export interface ActivityLog {
  id: string;
  ownerId: string;
  title: string;
  appOrDomain: string;
  category: ContentCategory;
  durationMinutes: number;
  actionTaken: ActionTaken;
  aiReasoning: string;
  deviceOs: string;
  createdAtMs: number;
}

export interface DailyStat {
  dateKey: string; // YYYY-MM-DD
  ownerId: string;
  educationalMinutes: number;
  productiveMinutes: number;
  socialShortsMinutes: number;
  gamingMinutes: number;
  timeoutsTriggered: number;
  focusSessionsCompleted: number;
}

export interface AIAnalysisResult {
  category: ContentCategory;
  isEducational: boolean;
  isShortFormOrReel: boolean;
  isGame: boolean;
  confidence: number;
  reasoning: string;
  gentlePrompt: string;
  educationalAlternative: string;
  recommendedAction:
    | 'allow_unlimited'
    | 'track_budget'
    | 'gentle_nudge'
    | 'trigger_timeout'
    | 'lock_work_hours';
}

export interface AppUsageSummary {
  appName: string;
  domainOrPackage: string;
  category: ContentCategory;
  minutesThisWeek: number;
  platforms: OSPlatform[];
  policyStatus: 'Unlimited' | '10m Cap / Timed Out' | 'Work-Hours Locked' | 'Tracked';
}
