import { z } from 'zod';

export const PERIODS: ['daily', 'weekly', 'monthly', 'all-time'] = [
  'daily',
  'weekly',
  'monthly',
  'all-time',
];
export const ACHIEVEMENT_TYPES: ['community', 'user', 'post', 'manual'] = [
  'community',
  'user',
  'post',
  'manual',
];
export const VISIBILITIES: ['public', 'mod'] = ['public', 'mod'];
export const REWARDS: ['none', 'badge', 'flair', 'recap_mention'] = [
  'none',
  'badge',
  'flair',
  'recap_mention',
];
export const PLANS: ['free', 'premium'] = ['free', 'premium'];
export const THEMES: ['default', 'classic', 'neon', 'minimal'] = [
  'default',
  'classic',
  'neon',
  'minimal',
];
export const RECAP_DAYS: [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export const periodSchema = z.enum(PERIODS);
export const achievementTypeSchema = z.enum(ACHIEVEMENT_TYPES);
export const visibilitySchema = z.enum(VISIBILITIES);
export const rewardSchema = z.enum(REWARDS);
export const planSchema = z.enum(PLANS);
export const themeSchema = z.enum(THEMES);
export const recapDaySchema = z.enum(RECAP_DAYS);

export const achievementDefinitionSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2).max(60),
  description: z.string().min(4).max(240),
  type: achievementTypeSchema,
  icon: z.string().min(1).max(8),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  threshold: z.number().int().min(1),
  period: periodSchema,
  visibility: visibilitySchema,
  reward: rewardSchema,
  autoPublish: z.boolean(),
  requiresApproval: z.boolean(),
  cooldownHours: z.number().int().min(0).max(8760),
  maxUnlocksPerPeriod: z.number().int().min(1).max(1000),
  antiSpamRules: z.string().max(240),
  enabled: z.boolean(),
  builtIn: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const appConfigSchema = z.object({
  schemaVersion: z.literal(1),
  subredditId: z.string().default(''),
  active: z.boolean(),
  enabled: z.boolean().default(true),
  subredditName: z.string(),
  autoTrackingEnabled: z.boolean().default(true),
  weeklyRecapEnabled: z.boolean(),
  weeklyRecapDay: recapDaySchema.default('SUNDAY'),
  weeklyRecapHour: z.number().int().min(0).max(23).default(18),
  timezone: z.string().default('UTC'),
  weeklyRecapTitle: z.string(),
  leaderboardEnabled: z.boolean(),
  autoPublishEnabled: z.boolean(),
  requireApprovalForAutoPosts: z.boolean(),
  requireApproval: z.boolean().default(true),
  publicGalleryEnabled: z.boolean().default(true),
  allowUserBadgeVisibilityControls: z.boolean().default(true),
  flairRewardsEnabled: z.boolean().default(false),
  publicLeaderboardLimit: z.number().int().min(3).max(25),
  excludedUsers: z.array(z.string()),
  excludedFlairs: z.array(z.string()).default([]),
  excludedPostTypes: z.array(z.string()).default([]),
  minimumAccountAgeDays: z.number().int().min(0).max(3650).default(0),
  antiSpamSensitivity: z.enum(['low', 'medium', 'high']).default('medium'),
  supportEnabled: z.boolean(),
  plan: planSchema.default('free'),
  theme: themeSchema.default('default'),
  premiumTheme: z.enum(['classic', 'neon', 'minimal']),
  celebrationPostStyle: z.enum(['compact', 'detailed']),
  nextRecapAt: z.number().nullable(),
  flairTextTemplate: z.string(),
  manualAwardsEnabled: z.boolean().default(true),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const eventSchema = z.object({
  id: z.string(),
  type: z.enum([
    'install',
    'post_submit',
    'comment_submit',
    'post_update',
    'post_report',
    'manual_award',
    'manual_revoke',
    'achievement_unlock',
    'recap_created',
    'recap_draft',
    'settings_update',
    'payment_fulfilled',
    'payment_refunded',
    'entitlement_update',
    'error',
  ]),
  actor: z.string().optional(),
  targetId: z.string().optional(),
  targetType: z.enum(['subreddit', 'post', 'comment', 'user']).optional(),
  message: z.string(),
  createdAt: z.number(),
});

export const unlockSchema = z.object({
  id: z.string(),
  achievementId: z.string(),
  achievementName: z.string(),
  achievementIcon: z.string(),
  subjectType: z.enum(['community', 'user', 'post']),
  subjectId: z.string(),
  subjectName: z.string(),
  targetId: z.string().optional(),
  targetPermalink: z.string().optional(),
  reason: z.string(),
  periodKey: z.string(),
  status: z.enum(['approved', 'pending', 'hidden', 'revoked']),
  createdAt: z.number(),
  createdBy: z.string(),
});

export const badgeSchema = z.object({
  id: z.string(),
  username: z.string(),
  subredditName: z.string().default(''),
  achievementId: z.string(),
  achievementName: z.string(),
  achievementIcon: z.string(),
  reason: z.string(),
  source: z.enum(['automatic', 'manual', 'supporter']).default('manual'),
  visibility: z.enum(['public', 'private']).default('public'),
  visible: z.boolean(),
  revoked: z.boolean(),
  flairApplied: z.boolean().default(false),
  targetId: z.string().optional(),
  createdAt: z.number(),
  createdBy: z.string(),
});

export const statsSchema = z.object({
  dayKey: z.string(),
  weekKey: z.string(),
  postsToday: z.number().int().min(0),
  commentsToday: z.number().int().min(0),
  activityThisWeek: z.number().int().min(0),
  postsThisWeek: z.number().int().min(0),
  commentsThisWeek: z.number().int().min(0),
  reportsThisWeek: z.number().int().min(0),
  removalsThisWeek: z.number().int().min(0),
  uniqueParticipantsThisWeek: z.array(z.string()),
  mostActiveHourUtc: z.number().int().min(0).max(23),
  hourlyActivityUtc: z.array(z.number().int().min(0)),
  updatedAt: z.number(),
});

export const leaderboardEntrySchema = z.object({
  username: z.string(),
  score: z.number(),
});

export const supporterEntitlementSchema = z.object({
  username: z.string(),
  supporterBadge: z.boolean(),
  communityThemePack: z.boolean(),
  seasonPack: z.boolean(),
  advancedRecaps: z.boolean(),
  cosmeticFrame: z.enum(['none', 'supporter']),
  orderIds: z.array(z.string()),
  updatedAt: z.number(),
});

export const weeklySnapshotSchema = z.object({
  weekKey: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.enum(['draft', 'published', 'skipped']),
  postId: z.string().optional(),
  createdAt: z.number(),
  publishedAt: z.number().optional(),
});

export const planLimitsSchema = z.object({
  activeAchievementLimit: z.number(),
  manualRecapsPerWeek: z.number(),
  automaticRecaps: z.boolean(),
  advancedExports: z.boolean(),
});

export const dashboardSchema = z.object({
  config: appConfigSchema,
  achievements: z.array(achievementDefinitionSchema),
  unlocks: z.array(unlockSchema),
  badges: z.array(badgeSchema),
  myBadges: z.array(badgeSchema),
  events: z.array(eventSchema),
  errors: z.array(eventSchema),
  stats: statsSchema,
  leaderboard: z.array(leaderboardEntrySchema),
  supporterStatus: supporterEntitlementSchema.optional(),
  weeklySnapshots: z.array(weeklySnapshotSchema),
  planLimits: planLimitsSchema,
  username: z.string().optional(),
  isModerator: z.boolean(),
  subredditName: z.string(),
});

export type Plan = z.infer<typeof planSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Period = z.infer<typeof periodSchema>;
export type AchievementType = z.infer<typeof achievementTypeSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type Reward = z.infer<typeof rewardSchema>;
export type AchievementDefinition = z.infer<typeof achievementDefinitionSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
export type TrackedEvent = z.infer<typeof eventSchema>;
export type AchievementUnlock = z.infer<typeof unlockSchema>;
export type UserBadge = z.infer<typeof badgeSchema>;
export type CommunityStats = z.infer<typeof statsSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type SupporterEntitlement = z.infer<typeof supporterEntitlementSchema>;
export type WeeklySnapshot = z.infer<typeof weeklySnapshotSchema>;
export type PlanLimits = z.infer<typeof planLimitsSchema>;
export type DashboardData = z.infer<typeof dashboardSchema>;

export const makeId = (prefix: string, now: number = Date.now()) => {
  return `${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

export const dayKeyFromDate = (date: Date) => {
  return date.toISOString().slice(0, 10);
};

export const weekKeyFromDate = (date: Date) => {
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${utc.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
};

export const createDefaultConfig = (
  subredditName: string,
  subredditId: string = '',
  now: number = Date.now()
): AppConfig => {
  return {
    schemaVersion: 1,
    subredditId,
    active: true,
    enabled: true,
    subredditName,
    autoTrackingEnabled: true,
    weeklyRecapEnabled: false,
    weeklyRecapDay: 'SUNDAY',
    weeklyRecapHour: 18,
    timezone: 'UTC',
    weeklyRecapTitle: 'Weekly Community Achievements',
    leaderboardEnabled: true,
    autoPublishEnabled: false,
    requireApprovalForAutoPosts: true,
    requireApproval: true,
    publicGalleryEnabled: true,
    allowUserBadgeVisibilityControls: true,
    flairRewardsEnabled: false,
    publicLeaderboardLimit: 10,
    excludedUsers: ['AutoModerator'],
    excludedFlairs: [],
    excludedPostTypes: [],
    minimumAccountAgeDays: 0,
    antiSpamSensitivity: 'medium',
    supportEnabled: true,
    plan: 'free',
    theme: 'default',
    premiumTheme: 'classic',
    celebrationPostStyle: 'compact',
    nextRecapAt: null,
    flairTextTemplate: 'Community Achiever',
    manualAwardsEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
};

export const createEmptyStats = (now: number = Date.now()): CommunityStats => {
  const date = new Date(now);
  return {
    dayKey: dayKeyFromDate(date),
    weekKey: weekKeyFromDate(date),
    postsToday: 0,
    commentsToday: 0,
    activityThisWeek: 0,
    postsThisWeek: 0,
    commentsThisWeek: 0,
    reportsThisWeek: 0,
    removalsThisWeek: 0,
    uniqueParticipantsThisWeek: [],
    mostActiveHourUtc: date.getUTCHours(),
    hourlyActivityUtc: Array.from({ length: 24 }, () => 0),
    updatedAt: now,
  };
};

export const createEmptySupporterEntitlement = (
  username: string,
  now: number = Date.now()
): SupporterEntitlement => {
  return {
    username,
    supporterBadge: false,
    communityThemePack: false,
    seasonPack: false,
    advancedRecaps: false,
    cosmeticFrame: 'none',
    orderIds: [],
    updatedAt: now,
  };
};

export const getPlanLimits = (plan: Plan): PlanLimits => {
  if (plan === 'premium') {
    return {
      activeAchievementLimit: 50,
      manualRecapsPerWeek: 10,
      automaticRecaps: true,
      advancedExports: true,
    };
  }

  return {
    activeAchievementLimit: 5,
    manualRecapsPerWeek: 1,
    automaticRecaps: false,
    advancedExports: false,
  };
};

export const createDefaultAchievements = (
  now: number = Date.now()
): AchievementDefinition[] => {
  return [
    {
      id: 'daily_post_goal',
      name: 'First Spark',
      description: 'The community reaches the daily post goal.',
      type: 'community',
      icon: '⚡',
      color: '#d93900',
      threshold: 10,
      period: 'daily',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: true,
      cooldownHours: 24,
      maxUnlocksPerPeriod: 1,
      antiSpamRules: 'Counts organic post submissions only.',
      enabled: true,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'thread_comment_milestone',
      name: 'Comment Storm',
      description: 'A thread reaches the configured comment milestone.',
      type: 'post',
      icon: '💬',
      color: '#2563eb',
      threshold: 100,
      period: 'all-time',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: true,
      cooldownHours: 12,
      maxUnlocksPerPeriod: 10,
      antiSpamRules: 'Does not ask users to comment; records natural activity.',
      enabled: true,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'helpful_contributor',
      name: 'Helpful Hero',
      description: 'A moderator recognizes a useful contribution.',
      type: 'manual',
      icon: '🤝',
      color: '#16a34a',
      threshold: 1,
      period: 'all-time',
      visibility: 'public',
      reward: 'badge',
      autoPublish: false,
      requiresApproval: false,
      cooldownHours: 0,
      maxUnlocksPerPeriod: 100,
      antiSpamRules: 'Manual moderator award with audit trail.',
      enabled: true,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'meme_of_the_week',
      name: 'Meme of the Week',
      description: 'A moderator selects a standout post for the weekly recap.',
      type: 'manual',
      icon: '🎭',
      color: '#db2777',
      threshold: 1,
      period: 'weekly',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: false,
      cooldownHours: 0,
      maxUnlocksPerPeriod: 5,
      antiSpamRules: 'Manual selection; never based on requested votes.',
      enabled: true,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'weekly_activity_goal',
      name: 'Community Milestone',
      description: 'The subreddit reaches a weekly activity target.',
      type: 'community',
      icon: '🏆',
      color: '#ca8a04',
      threshold: 500,
      period: 'weekly',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: true,
      cooldownHours: 168,
      maxUnlocksPerPeriod: 1,
      antiSpamRules: 'Uses aggregate activity only.',
      enabled: true,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'daily_comment_goal',
      name: 'Daily Conversation',
      description: 'The community reaches the daily comment goal.',
      type: 'community',
      icon: '🗣️',
      color: '#0891b2',
      threshold: 100,
      period: 'daily',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: true,
      cooldownHours: 24,
      maxUnlocksPerPeriod: 1,
      antiSpamRules: 'Counts organic comments only.',
      enabled: false,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'thread_report_safe',
      name: 'Clean Crowd',
      description: 'A busy thread stays low-report.',
      type: 'post',
      icon: '🛡️',
      color: '#0f766e',
      threshold: 50,
      period: 'all-time',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: true,
      cooldownHours: 12,
      maxUnlocksPerPeriod: 10,
      antiSpamRules: 'Requires strong activity and no more than one report.',
      enabled: false,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'newcomer_wave',
      name: 'Newcomer Wave',
      description: 'Many distinct participants join the week’s activity.',
      type: 'community',
      icon: '👋',
      color: '#7c3aed',
      threshold: 25,
      period: 'weekly',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: true,
      cooldownHours: 168,
      maxUnlocksPerPeriod: 1,
      antiSpamRules: 'Tracks only usernames seen by the app this week.',
      enabled: false,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'high_quality_week',
      name: 'High Quality Week',
      description: 'A high-participation week stays low on reports.',
      type: 'community',
      icon: '✨',
      color: '#059669',
      threshold: 300,
      period: 'weekly',
      visibility: 'public',
      reward: 'recap_mention',
      autoPublish: false,
      requiresApproval: true,
      cooldownHours: 168,
      maxUnlocksPerPeriod: 1,
      antiSpamRules: 'Uses aggregate activity and safety counters only.',
      enabled: false,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'community_legend',
      name: 'Community Legend',
      description: 'A rare manual badge for sustained positive contribution.',
      type: 'manual',
      icon: '🌟',
      color: '#ea580c',
      threshold: 1,
      period: 'all-time',
      visibility: 'public',
      reward: 'badge',
      autoPublish: false,
      requiresApproval: false,
      cooldownHours: 0,
      maxUnlocksPerPeriod: 20,
      antiSpamRules: 'Manual moderator award with audit trail.',
      enabled: false,
      builtIn: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
};
