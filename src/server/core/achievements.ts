import { context, reddit, redis } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { isT1, isT3 } from '@devvit/shared-types/tid.js';
import {
  achievementDefinitionSchema,
  appConfigSchema,
  badgeSchema,
  createDefaultAchievements,
  createDefaultConfig,
  createEmptyStats,
  createEmptySupporterEntitlement,
  dayKeyFromDate,
  eventSchema,
  getPlanLimits,
  makeId,
  statsSchema,
  supporterEntitlementSchema,
  unlockSchema,
  weekKeyFromDate,
  weeklySnapshotSchema,
  type AchievementDefinition,
  type AchievementUnlock,
  type AppConfig,
  type CommunityStats,
  type DashboardData,
  type LeaderboardEntry,
  type SupporterEntitlement,
  type TrackedEvent,
  type UserBadge,
  type WeeklySnapshot,
} from '../../shared/achievements';

const MAX_EVENTS = 120;
const MAX_UNLOCKS = 300;
const MAX_BADGES = 500;
const MAX_SNAPSHOTS = 26;

type PaidOrderProduct = {
  sku: string;
  displayName?: string;
};

export type PaidOrder = {
  id: string;
  status: string;
  products: PaidOrderProduct[];
  metadata: Readonly<Record<string, string>>;
};

const scoped = (name: string) => `${name}:${context.subredditId}`;
const legacyKey = (name: string) => `ca:${context.subredditId}:${name}`;

const keys = {
  achievements: () => scoped('achievements'),
  audit: () => scoped('audit'),
  badges: () => scoped('badges'),
  config: () => scoped('config'),
  events: () => scoped('events'),
  leaderboard: () => scoped('leaderboard'),
  orders: () => scoped('payment-orders'),
  stats: () => scoped('stats'),
  supporters: () => scoped('supporters'),
  unlocks: () => scoped('unlocks'),
  weeklySnapshots: () => scoped('weekly-snapshots'),
  userBadges: (username: string) => `${scoped('badges')}:user:${username}`,
  counter: (name: string) => `counter:${context.subredditId}:${name}`,
};

const isEmptyRecord = (record: Record<string, string>) => {
  return Object.keys(record).length === 0;
};

const parseJson = <T>(
  raw: string | null | undefined,
  schema: { parse: (value: unknown) => T }
) => {
  if (!raw) {
    return undefined;
  }

  const parsed: unknown = JSON.parse(raw);
  return schema.parse(parsed);
};

const getLegacyJson = async <T>(
  name: string,
  schema: { parse: (value: unknown) => T }
) => {
  return parseJson(await redis.get(legacyKey(name)), schema);
};

const writeJsonHash = async <T extends { id: string }>(
  redisKey: string,
  items: T[]
) => {
  if (!items.length) {
    return;
  }

  const values: Record<string, string> = {};
  for (const item of items) {
    values[item.id] = JSON.stringify(item);
  }
  await redis.hSet(redisKey, values);
};

const readJsonHash = async <T>(
  redisKey: string,
  schema: { parse: (value: unknown) => T }
) => {
  const values = await redis.hGetAll(redisKey);
  return Object.values(values)
    .map((value) => parseJson(value, schema))
    .filter((value): value is T => value !== undefined);
};

const boolToString = (value: boolean) => (value ? 'true' : 'false');

const parseBooleanField = (
  record: Record<string, string>,
  field: string,
  fallback: boolean
) => {
  const value = record[field];
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return fallback;
};

const parseNumberField = (
  record: Record<string, string>,
  field: string,
  fallback: number
) => {
  const value = record[field];
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNullableNumberField = (
  record: Record<string, string>,
  field: string,
  fallback: number | null
) => {
  const value = record[field];
  if (value === undefined || value === 'null') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStringArrayField = (
  record: Record<string, string>,
  field: string,
  fallback: string[]
) => {
  const value = record[field];
  if (!value) {
    return fallback;
  }

  const parsed: unknown = JSON.parse(value);
  if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
    return parsed;
  }
  return fallback;
};

const configToHash = (config: AppConfig) => {
  return {
    schemaVersion: String(config.schemaVersion),
    subredditId: config.subredditId,
    subredditName: config.subredditName,
    active: boolToString(config.active),
    enabled: boolToString(config.enabled),
    autoTrackingEnabled: boolToString(config.autoTrackingEnabled),
    weeklyRecapEnabled: boolToString(config.weeklyRecapEnabled),
    weeklyRecapDay: config.weeklyRecapDay,
    weeklyRecapHour: String(config.weeklyRecapHour),
    timezone: config.timezone,
    weeklyRecapTitle: config.weeklyRecapTitle,
    leaderboardEnabled: boolToString(config.leaderboardEnabled),
    autoPublishEnabled: boolToString(config.autoPublishEnabled),
    requireApprovalForAutoPosts: boolToString(
      config.requireApprovalForAutoPosts
    ),
    requireApproval: boolToString(config.requireApproval),
    publicGalleryEnabled: boolToString(config.publicGalleryEnabled),
    allowUserBadgeVisibilityControls: boolToString(
      config.allowUserBadgeVisibilityControls
    ),
    flairRewardsEnabled: boolToString(config.flairRewardsEnabled),
    publicLeaderboardLimit: String(config.publicLeaderboardLimit),
    excludedUsers: JSON.stringify(config.excludedUsers),
    excludedFlairs: JSON.stringify(config.excludedFlairs),
    excludedPostTypes: JSON.stringify(config.excludedPostTypes),
    minimumAccountAgeDays: String(config.minimumAccountAgeDays),
    antiSpamSensitivity: config.antiSpamSensitivity,
    supportEnabled: boolToString(config.supportEnabled),
    plan: config.plan,
    theme: config.theme,
    premiumTheme: config.premiumTheme,
    celebrationPostStyle: config.celebrationPostStyle,
    nextRecapAt:
      config.nextRecapAt === null ? 'null' : String(config.nextRecapAt),
    flairTextTemplate: config.flairTextTemplate,
    manualAwardsEnabled: boolToString(config.manualAwardsEnabled),
    createdAt: String(config.createdAt),
    updatedAt: String(config.updatedAt),
  };
};

const configFromHash = (
  record: Record<string, string>,
  fallback: AppConfig
) => {
  const active = parseBooleanField(record, 'active', fallback.active);
  const enabled = parseBooleanField(record, 'enabled', active);
  return appConfigSchema.parse({
    schemaVersion: 1,
    subredditId: record.subredditId ?? fallback.subredditId,
    subredditName: record.subredditName ?? fallback.subredditName,
    active,
    enabled,
    autoTrackingEnabled: parseBooleanField(
      record,
      'autoTrackingEnabled',
      fallback.autoTrackingEnabled
    ),
    weeklyRecapEnabled: parseBooleanField(
      record,
      'weeklyRecapEnabled',
      fallback.weeklyRecapEnabled
    ),
    weeklyRecapDay: record.weeklyRecapDay ?? fallback.weeklyRecapDay,
    weeklyRecapHour: parseNumberField(
      record,
      'weeklyRecapHour',
      fallback.weeklyRecapHour
    ),
    timezone: record.timezone ?? fallback.timezone,
    weeklyRecapTitle: record.weeklyRecapTitle ?? fallback.weeklyRecapTitle,
    leaderboardEnabled: parseBooleanField(
      record,
      'leaderboardEnabled',
      fallback.leaderboardEnabled
    ),
    autoPublishEnabled: parseBooleanField(
      record,
      'autoPublishEnabled',
      fallback.autoPublishEnabled
    ),
    requireApprovalForAutoPosts: parseBooleanField(
      record,
      'requireApprovalForAutoPosts',
      fallback.requireApprovalForAutoPosts
    ),
    requireApproval: parseBooleanField(
      record,
      'requireApproval',
      fallback.requireApproval
    ),
    publicGalleryEnabled: parseBooleanField(
      record,
      'publicGalleryEnabled',
      fallback.publicGalleryEnabled
    ),
    allowUserBadgeVisibilityControls: parseBooleanField(
      record,
      'allowUserBadgeVisibilityControls',
      fallback.allowUserBadgeVisibilityControls
    ),
    flairRewardsEnabled: parseBooleanField(
      record,
      'flairRewardsEnabled',
      fallback.flairRewardsEnabled
    ),
    publicLeaderboardLimit: parseNumberField(
      record,
      'publicLeaderboardLimit',
      fallback.publicLeaderboardLimit
    ),
    excludedUsers: parseStringArrayField(
      record,
      'excludedUsers',
      fallback.excludedUsers
    ),
    excludedFlairs: parseStringArrayField(
      record,
      'excludedFlairs',
      fallback.excludedFlairs
    ),
    excludedPostTypes: parseStringArrayField(
      record,
      'excludedPostTypes',
      fallback.excludedPostTypes
    ),
    minimumAccountAgeDays: parseNumberField(
      record,
      'minimumAccountAgeDays',
      fallback.minimumAccountAgeDays
    ),
    antiSpamSensitivity:
      record.antiSpamSensitivity ?? fallback.antiSpamSensitivity,
    supportEnabled: parseBooleanField(
      record,
      'supportEnabled',
      fallback.supportEnabled
    ),
    plan: record.plan ?? fallback.plan,
    theme: record.theme ?? fallback.theme,
    premiumTheme: record.premiumTheme ?? fallback.premiumTheme,
    celebrationPostStyle:
      record.celebrationPostStyle ?? fallback.celebrationPostStyle,
    nextRecapAt: parseNullableNumberField(
      record,
      'nextRecapAt',
      fallback.nextRecapAt
    ),
    flairTextTemplate: record.flairTextTemplate ?? fallback.flairTextTemplate,
    manualAwardsEnabled: parseBooleanField(
      record,
      'manualAwardsEnabled',
      fallback.manualAwardsEnabled
    ),
    createdAt: parseNumberField(record, 'createdAt', fallback.createdAt),
    updatedAt: parseNumberField(record, 'updatedAt', fallback.updatedAt),
  });
};

const migrateLegacyBadge = (badge: UserBadge) => {
  return badgeSchema.parse({
    ...badge,
    subredditName: badge.subredditName || context.subredditName,
    source: badge.source ?? 'manual',
    visibility: badge.visibility ?? (badge.visible ? 'public' : 'private'),
    flairApplied: badge.flairApplied ?? false,
  });
};

export const getConfig = async () => {
  const fallback = createDefaultConfig(context.subredditName, context.subredditId);
  const hash = await redis.hGetAll(keys.config());
  if (!isEmptyRecord(hash)) {
    return configFromHash(hash, fallback);
  }

  const legacy = await getLegacyJson('config', appConfigSchema);
  const created = legacy ?? fallback;
  await redis.hSet(keys.config(), configToHash(created));
  return created;
};

export const saveConfig = async (config: AppConfig) => {
  const next = appConfigSchema.parse({
    ...config,
    active: config.enabled,
    requireApproval: config.requireApprovalForAutoPosts,
    updatedAt: Date.now(),
  });
  await redis.hSet(keys.config(), configToHash(next));
};

export const getAchievements = async () => {
  const achievements = await readJsonHash(
    keys.achievements(),
    achievementDefinitionSchema
  );
  if (achievements.length) {
    return achievements.sort((left, right) => left.createdAt - right.createdAt);
  }

  const legacy = await getLegacyJson(
    'achievements',
    achievementDefinitionSchema.array()
  );
  const created = legacy ?? createDefaultAchievements();
  await writeJsonHash(keys.achievements(), created);
  return created;
};

export const saveAchievements = async (
  achievements: AchievementDefinition[]
) => {
  await writeJsonHash(keys.achievements(), achievements);
};

const statsToHash = (stats: CommunityStats) => {
  return {
    dayKey: stats.dayKey,
    weekKey: stats.weekKey,
    postsToday: String(stats.postsToday),
    commentsToday: String(stats.commentsToday),
    activityThisWeek: String(stats.activityThisWeek),
    postsThisWeek: String(stats.postsThisWeek),
    commentsThisWeek: String(stats.commentsThisWeek),
    reportsThisWeek: String(stats.reportsThisWeek),
    removalsThisWeek: String(stats.removalsThisWeek),
    uniqueParticipantsThisWeek: JSON.stringify(stats.uniqueParticipantsThisWeek),
    mostActiveHourUtc: String(stats.mostActiveHourUtc),
    hourlyActivityUtc: JSON.stringify(stats.hourlyActivityUtc),
    updatedAt: String(stats.updatedAt),
  };
};

const statsFromHash = (
  record: Record<string, string>,
  fallback: CommunityStats
) => {
  return statsSchema.parse({
    dayKey: record.dayKey ?? fallback.dayKey,
    weekKey: record.weekKey ?? fallback.weekKey,
    postsToday: parseNumberField(record, 'postsToday', fallback.postsToday),
    commentsToday: parseNumberField(
      record,
      'commentsToday',
      fallback.commentsToday
    ),
    activityThisWeek: parseNumberField(
      record,
      'activityThisWeek',
      fallback.activityThisWeek
    ),
    postsThisWeek: parseNumberField(
      record,
      'postsThisWeek',
      fallback.postsThisWeek
    ),
    commentsThisWeek: parseNumberField(
      record,
      'commentsThisWeek',
      fallback.commentsThisWeek
    ),
    reportsThisWeek: parseNumberField(
      record,
      'reportsThisWeek',
      fallback.reportsThisWeek
    ),
    removalsThisWeek: parseNumberField(
      record,
      'removalsThisWeek',
      fallback.removalsThisWeek
    ),
    uniqueParticipantsThisWeek: parseStringArrayField(
      record,
      'uniqueParticipantsThisWeek',
      fallback.uniqueParticipantsThisWeek
    ),
    mostActiveHourUtc: parseNumberField(
      record,
      'mostActiveHourUtc',
      fallback.mostActiveHourUtc
    ),
    hourlyActivityUtc: parseNumberArrayField(
      record,
      'hourlyActivityUtc',
      fallback.hourlyActivityUtc
    ),
    updatedAt: parseNumberField(record, 'updatedAt', fallback.updatedAt),
  });
};

const parseNumberArrayField = (
  record: Record<string, string>,
  field: string,
  fallback: number[]
) => {
  const value = record[field];
  if (!value) {
    return fallback;
  }

  const parsed: unknown = JSON.parse(value);
  if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'number')) {
    return parsed;
  }
  return fallback;
};

export const getStats = async () => {
  const fallback = createEmptyStats();
  const hash = await redis.hGetAll(keys.stats());
  if (!isEmptyRecord(hash)) {
    return rolloverStats(statsFromHash(hash, fallback));
  }

  const legacy = await getLegacyJson('stats', statsSchema);
  const created = legacy ?? fallback;
  await redis.hSet(keys.stats(), statsToHash(created));
  return created;
};

const saveStats = async (stats: CommunityStats) => {
  await redis.hSet(keys.stats(), statsToHash(stats));
};

const pruneRecords = async <T extends { id: string }>(
  redisKey: string,
  records: T[],
  max: number
) => {
  const extra = records.slice(max);
  if (extra.length) {
    await redis.hDel(
      redisKey,
      extra.map((record) => record.id)
    );
  }
};

export const getEvents = async () => {
  const events = await readJsonHash(keys.events(), eventSchema);
  if (events.length) {
    return events.sort((left, right) => right.createdAt - left.createdAt);
  }

  const legacy = await getLegacyJson('events', eventSchema.array());
  if (!legacy) {
    return [];
  }
  await writeJsonHash(keys.events(), legacy);
  return legacy.sort((left, right) => right.createdAt - left.createdAt);
};

export const getAuditLog = async () => {
  const events = await readJsonHash(keys.audit(), eventSchema);
  return events.sort((left, right) => right.createdAt - left.createdAt);
};

export const getUnlocks = async () => {
  const unlocks = await readJsonHash(keys.unlocks(), unlockSchema);
  if (unlocks.length) {
    return unlocks.sort((left, right) => right.createdAt - left.createdAt);
  }

  const legacy = await getLegacyJson('unlocks', unlockSchema.array());
  if (!legacy) {
    return [];
  }
  await writeJsonHash(keys.unlocks(), legacy);
  return legacy.sort((left, right) => right.createdAt - left.createdAt);
};

export const getBadges = async () => {
  const badges = await readJsonHash(keys.badges(), badgeSchema);
  if (badges.length) {
    return badges.sort((left, right) => right.createdAt - left.createdAt);
  }

  const legacy = await getLegacyJson('badges', badgeSchema.array());
  if (!legacy) {
    return [];
  }
  const migrated = legacy.map(migrateLegacyBadge);
  await writeJsonHash(keys.badges(), migrated);
  for (const badge of migrated) {
    await redis.hSet(keys.userBadges(badge.username), {
      [badge.id]: JSON.stringify(badge),
    });
  }
  return migrated.sort((left, right) => right.createdAt - left.createdAt);
};

export const getUserBadges = async (username?: string) => {
  if (!username) {
    return [];
  }

  const userBadges = await readJsonHash(keys.userBadges(username), badgeSchema);
  if (userBadges.length) {
    return userBadges.sort((left, right) => right.createdAt - left.createdAt);
  }

  return (await getBadges()).filter((badge) => badge.username === username);
};

const saveBadge = async (badge: UserBadge) => {
  await redis.hSet(keys.badges(), { [badge.id]: JSON.stringify(badge) });
  await redis.hSet(keys.userBadges(badge.username), {
    [badge.id]: JSON.stringify(badge),
  });
  const badges = await getBadges();
  await pruneRecords(keys.badges(), badges, MAX_BADGES);
};

export const logEvent = async (
  event: Omit<TrackedEvent, 'id' | 'createdAt'>
) => {
  const created: TrackedEvent = {
    id: makeId('evt'),
    createdAt: Date.now(),
    ...event,
  };
  await redis.hSet(keys.events(), { [created.id]: JSON.stringify(created) });

  if (
    created.actor ||
    created.type === 'settings_update' ||
    created.type === 'payment_fulfilled' ||
    created.type === 'payment_refunded' ||
    created.type === 'manual_award' ||
    created.type === 'manual_revoke'
  ) {
    await redis.hSet(keys.audit(), { [created.id]: JSON.stringify(created) });
  }

  await pruneRecords(keys.events(), await getEvents(), MAX_EVENTS);
  await pruneRecords(keys.audit(), await getAuditLog(), MAX_EVENTS);
  return created;
};

export const logError = async (message: string, targetId?: string) => {
  return await logEvent({
    type: 'error',
    targetId,
    targetType: targetId ? 'post' : 'subreddit',
    message,
  });
};

export const ensureInitialized = async (installer?: string) => {
  await getConfig();
  await getAchievements();
  await getStats();

  const events = await getEvents();
  if (!events.some((event) => event.type === 'install')) {
    await logEvent({
      type: 'install',
      actor: installer,
      targetType: 'subreddit',
      message: 'Community Achievements initialized with default achievements.',
    });
  }
};

export const isCurrentUserModerator = async () => {
  const user = await reddit.getCurrentUser();
  if (!user) {
    return false;
  }

  const permissions = await user.getModPermissionsForSubreddit(
    context.subredditName
  );
  return permissions.length > 0;
};

const rolloverStats = (stats: CommunityStats, now: number = Date.now()) => {
  const date = new Date(now);
  const dayKey = dayKeyFromDate(date);
  const weekKey = weekKeyFromDate(date);
  return {
    ...stats,
    dayKey,
    weekKey,
    postsToday: stats.dayKey === dayKey ? stats.postsToday : 0,
    commentsToday: stats.dayKey === dayKey ? stats.commentsToday : 0,
    activityThisWeek: stats.weekKey === weekKey ? stats.activityThisWeek : 0,
    postsThisWeek: stats.weekKey === weekKey ? stats.postsThisWeek : 0,
    commentsThisWeek: stats.weekKey === weekKey ? stats.commentsThisWeek : 0,
    reportsThisWeek: stats.weekKey === weekKey ? stats.reportsThisWeek : 0,
    removalsThisWeek: stats.weekKey === weekKey ? stats.removalsThisWeek : 0,
    uniqueParticipantsThisWeek:
      stats.weekKey === weekKey ? stats.uniqueParticipantsThisWeek : [],
    hourlyActivityUtc:
      stats.weekKey === weekKey
        ? stats.hourlyActivityUtc
        : Array.from({ length: 24 }, () => 0),
    updatedAt: now,
  };
};

const addParticipant = (stats: CommunityStats, username?: string) => {
  if (!username || stats.uniqueParticipantsThisWeek.includes(username)) {
    return stats.uniqueParticipantsThisWeek;
  }

  return [...stats.uniqueParticipantsThisWeek, username].slice(0, 500);
};

const incrementHour = (stats: CommunityStats, now: number) => {
  const hour = new Date(now).getUTCHours();
  const hourly = stats.hourlyActivityUtc.map((value, index) =>
    index === hour ? value + 1 : value
  );
  const mostActive = hourly.reduce(
    (best, value, index) => (value > (hourly[best] ?? 0) ? index : best),
    0
  );

  return { hourly, mostActive };
};

const incrementProgressCounters = async (
  stats: CommunityStats,
  type: 'post' | 'comment'
) => {
  const dayPrefix = `day:${stats.dayKey}`;
  const weekPrefix = `week:${stats.weekKey}`;
  await redis.incrBy(keys.counter(`${dayPrefix}:${type}s`), 1);
  await redis.incrBy(keys.counter(`${weekPrefix}:${type}s`), 1);
  await redis.incrBy(keys.counter(`${weekPrefix}:activity`), 1);
};

const autoTrackingIsEnabled = async () => {
  const config = await getConfig();
  return config.enabled && config.active && config.autoTrackingEnabled;
};

export const recordPostSubmit = async (input: {
  postId?: string;
  authorName?: string;
  title?: string;
}) => {
  if (!(await autoTrackingIsEnabled())) {
    return;
  }

  const now = Date.now();
  const stats = rolloverStats(await getStats(), now);
  const { hourly, mostActive } = incrementHour(stats, now);
  const next: CommunityStats = {
    ...stats,
    postsToday: stats.postsToday + 1,
    postsThisWeek: stats.postsThisWeek + 1,
    activityThisWeek: stats.activityThisWeek + 1,
    uniqueParticipantsThisWeek: addParticipant(stats, input.authorName),
    hourlyActivityUtc: hourly,
    mostActiveHourUtc: mostActive,
    updatedAt: now,
  };

  await saveStats(next);
  await incrementProgressCounters(next, 'post');
  await logEvent({
    type: 'post_submit',
    actor: input.authorName,
    targetId: input.postId,
    targetType: 'post',
    message: input.title
      ? `Tracked post: ${input.title}`
      : 'Tracked a post submission.',
  });
  await evaluateCommunityAchievements(next);
};

export const recordCommentSubmit = async (input: {
  commentId?: string;
  postId?: string;
  authorName?: string;
  postCommentCount?: number;
  postTitle?: string;
}) => {
  if (!(await autoTrackingIsEnabled())) {
    return;
  }

  const now = Date.now();
  const stats = rolloverStats(await getStats(), now);
  const { hourly, mostActive } = incrementHour(stats, now);
  const next: CommunityStats = {
    ...stats,
    commentsToday: stats.commentsToday + 1,
    commentsThisWeek: stats.commentsThisWeek + 1,
    activityThisWeek: stats.activityThisWeek + 1,
    uniqueParticipantsThisWeek: addParticipant(stats, input.authorName),
    hourlyActivityUtc: hourly,
    mostActiveHourUtc: mostActive,
    updatedAt: now,
  };

  await saveStats(next);
  await incrementProgressCounters(next, 'comment');
  await logEvent({
    type: 'comment_submit',
    actor: input.authorName,
    targetId: input.commentId,
    targetType: 'comment',
    message: 'Tracked a comment submission.',
  });
  await evaluateCommunityAchievements(next);

  if (input.postId && input.postCommentCount) {
    await evaluatePostAchievements({
      postId: input.postId,
      postTitle: input.postTitle,
      commentCount: input.postCommentCount,
      reportCount: 0,
      permalink: undefined,
    });
  }
};

export const recordPostReport = async (postId?: string) => {
  if (!(await autoTrackingIsEnabled())) {
    return;
  }

  const stats = rolloverStats(await getStats());
  const next: CommunityStats = {
    ...stats,
    reportsThisWeek: stats.reportsThisWeek + 1,
    updatedAt: Date.now(),
  };
  await saveStats(next);
  await redis.incrBy(keys.counter(`week:${next.weekKey}:reports`), 1);
  await logEvent({
    type: 'post_report',
    targetId: postId,
    targetType: 'post',
    message: 'Tracked a post report for aggregate safety metrics.',
  });
};

export const evaluatePostAchievements = async (input: {
  postId: string;
  postTitle?: string;
  commentCount: number;
  reportCount: number;
  permalink?: string;
}) => {
  const achievements = await getAchievements();
  const commentStorm = achievements.find(
    (achievement) =>
      achievement.id === 'thread_comment_milestone' && achievement.enabled
  );
  const cleanCrowd = achievements.find(
    (achievement) =>
      achievement.id === 'thread_report_safe' && achievement.enabled
  );

  if (commentStorm && input.commentCount >= commentStorm.threshold) {
    await unlockAchievement({
      achievement: commentStorm,
      subjectType: 'post',
      subjectId: input.postId,
      subjectName: input.postTitle ?? 'Thread',
      targetId: input.postId,
      targetPermalink: input.permalink,
      reason: `Reached ${input.commentCount} comments.`,
      createdBy: 'system',
    });
  }

  if (
    cleanCrowd &&
    input.commentCount >= cleanCrowd.threshold &&
    input.reportCount <= 1
  ) {
    await unlockAchievement({
      achievement: cleanCrowd,
      subjectType: 'post',
      subjectId: input.postId,
      subjectName: input.postTitle ?? 'Thread',
      targetId: input.postId,
      targetPermalink: input.permalink,
      reason: `Reached ${input.commentCount} comments with ${input.reportCount} report(s).`,
      createdBy: 'system',
    });
  }
};

export const evaluateCommunityAchievements = async (stats: CommunityStats) => {
  const achievements = await getAchievements();
  const checks = [
    {
      id: 'daily_post_goal',
      value: stats.postsToday,
      reason: `Reached ${stats.postsToday} posts today.`,
    },
    {
      id: 'daily_comment_goal',
      value: stats.commentsToday,
      reason: `Reached ${stats.commentsToday} comments today.`,
    },
    {
      id: 'weekly_activity_goal',
      value: stats.activityThisWeek,
      reason: `Reached ${stats.activityThisWeek} weekly posts and comments.`,
    },
    {
      id: 'newcomer_wave',
      value: stats.uniqueParticipantsThisWeek.length,
      reason: `${stats.uniqueParticipantsThisWeek.length} distinct participants were seen this week.`,
    },
    {
      id: 'high_quality_week',
      value:
        stats.reportsThisWeek <= 3 && stats.removalsThisWeek <= 3
          ? stats.activityThisWeek
          : 0,
      reason: `High activity with ${stats.reportsThisWeek} report(s) and ${stats.removalsThisWeek} removal(s).`,
    },
  ];

  for (const check of checks) {
    const achievement = achievements.find(
      (item) => item.id === check.id && item.enabled
    );
    if (achievement && check.value >= achievement.threshold) {
      await unlockAchievement({
        achievement,
        subjectType: 'community',
        subjectId: context.subredditId,
        subjectName: `r/${context.subredditName}`,
        reason: check.reason,
        createdBy: 'system',
      });
    }
  }
};

const periodKeyFor = (achievement: AchievementDefinition) => {
  const now = new Date();
  if (achievement.period === 'daily') {
    return dayKeyFromDate(now);
  }
  if (achievement.period === 'weekly') {
    return weekKeyFromDate(now);
  }
  if (achievement.period === 'monthly') {
    return now.toISOString().slice(0, 7);
  }
  return 'all-time';
};

export const unlockAchievement = async (input: {
  achievement: AchievementDefinition;
  subjectType: AchievementUnlock['subjectType'];
  subjectId: string;
  subjectName: string;
  targetId?: string;
  targetPermalink?: string;
  reason: string;
  createdBy: string;
}) => {
  const config = await getConfig();
  const unlocks = await getUnlocks();
  const periodKey = periodKeyFor(input.achievement);
  const recentSame = unlocks.filter(
    (unlock) =>
      unlock.achievementId === input.achievement.id &&
      unlock.subjectId === input.subjectId &&
      unlock.periodKey === periodKey &&
      unlock.status !== 'revoked'
  );

  if (recentSame.length >= input.achievement.maxUnlocksPerPeriod) {
    return undefined;
  }

  const shouldRequireApproval =
    input.createdBy === 'system'
      ? input.achievement.requiresApproval || config.requireApprovalForAutoPosts
      : false;
  const status = shouldRequireApproval ? 'pending' : 'approved';
  const created: AchievementUnlock = {
    id: makeId('unlock'),
    achievementId: input.achievement.id,
    achievementName: input.achievement.name,
    achievementIcon: input.achievement.icon,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    targetId: input.targetId,
    targetPermalink: input.targetPermalink,
    reason: input.reason,
    periodKey,
    status,
    createdAt: Date.now(),
    createdBy: input.createdBy,
  };

  await redis.hSet(keys.unlocks(), { [created.id]: JSON.stringify(created) });
  await pruneRecords(keys.unlocks(), await getUnlocks(), MAX_UNLOCKS);
  await logEvent({
    type: 'achievement_unlock',
    actor: input.createdBy,
    targetId: input.targetId ?? input.subjectId,
    targetType:
      input.subjectType === 'community' ? 'subreddit' : input.subjectType,
    message: `${input.achievement.name}: ${input.reason}`,
  });

  return created;
};

export const awardUserBadge = async (input: {
  username: string;
  achievementId: string;
  reason: string;
  visibility?: 'public' | 'private';
  targetId?: string;
  createdBy: string;
  source?: 'automatic' | 'manual' | 'supporter';
  applyFlair?: boolean;
}) => {
  const [achievements, config] = await Promise.all([
    getAchievements(),
    getConfig(),
  ]);
  if (!config.manualAwardsEnabled && input.source !== 'supporter') {
    throw new Error('Manual awards are disabled.');
  }
  if (config.excludedUsers.includes(input.username)) {
    throw new Error(`${input.username} is excluded from awards.`);
  }

  const achievement = achievements.find(
    (item) => item.id === input.achievementId && item.enabled
  );
  if (!achievement) {
    throw new Error('Achievement is disabled or missing.');
  }

  const shouldApplyFlair =
    Boolean(input.applyFlair) && config.flairRewardsEnabled;
  const badge: UserBadge = {
    id: makeId('badge'),
    username: input.username,
    subredditName: context.subredditName,
    achievementId: achievement.id,
    achievementName: achievement.name,
    achievementIcon: achievement.icon,
    reason: input.reason,
    source: input.source ?? 'manual',
    visibility: input.visibility ?? 'public',
    visible: (input.visibility ?? 'public') === 'public',
    revoked: false,
    flairApplied: false,
    targetId: input.targetId,
    createdAt: Date.now(),
    createdBy: input.createdBy,
  };

  if (shouldApplyFlair) {
    await applyUserFlairForBadge(input.username, 'Community Achiever');
  }

  const savedBadge = { ...badge, flairApplied: shouldApplyFlair };
  await saveBadge(savedBadge);
  await redis.zIncrBy(keys.leaderboard(), input.username, 1);
  await unlockAchievement({
    achievement,
    subjectType: 'user',
    subjectId: input.username,
    subjectName: `u/${input.username}`,
    targetId: input.targetId,
    reason: input.reason,
    createdBy: input.createdBy,
  });
  await logEvent({
    type: input.source === 'supporter' ? 'entitlement_update' : 'manual_award',
    actor: input.createdBy,
    targetId: input.targetId,
    targetType: 'user',
    message: `${input.createdBy} awarded ${achievement.name} to u/${input.username}.`,
  });
  return savedBadge;
};

export const revokeLatestBadgeForUser = async (input: {
  username: string;
  actor: string;
}) => {
  const badges = await getUserBadges(input.username);
  const latest = badges.find((badge) => !badge.revoked);
  if (!latest) {
    return undefined;
  }

  const revoked: UserBadge = {
    ...latest,
    revoked: true,
    visible: false,
    visibility: 'private',
  };
  await saveBadge(revoked);
  await redis.zIncrBy(keys.leaderboard(), input.username, -1);
  await logEvent({
    type: 'manual_revoke',
    actor: input.actor,
    targetType: 'user',
    message: `${input.actor} revoked latest badge for u/${input.username}.`,
  });
  return revoked;
};

export const nominatePost = async (input: {
  postId: string;
  title: string;
  permalink: string;
  actor: string;
}) => {
  const achievements = await getAchievements();
  const achievement = achievements.find(
    (item) => item.id === 'meme_of_the_week' && item.enabled
  );
  if (!achievement) {
    throw new Error('Meme of the Week is disabled.');
  }

  return await unlockAchievement({
    achievement,
    subjectType: 'post',
    subjectId: input.postId,
    subjectName: input.title,
    targetId: input.postId,
    targetPermalink: input.permalink,
    reason: 'Selected manually by a moderator.',
    createdBy: input.actor,
  });
};

export const getTargetAuthor = async (targetId: string) => {
  if (isT3(targetId)) {
    const post = await reddit.getPostById(targetId);
    return {
      username: post.authorName,
      title: post.title,
      permalink: post.permalink,
      targetId: post.id,
    };
  }

  if (isT1(targetId)) {
    const comment = await reddit.getCommentById(targetId);
    return {
      username: comment.authorName,
      title: 'Comment',
      permalink: comment.permalink,
      targetId: comment.id,
    };
  }

  throw new Error('Unsupported target for this action.');
};

export const getPostInfo = async (targetId: string) => {
  if (!isT3(targetId)) {
    throw new Error('This action only works on posts.');
  }

  const post = await reddit.getPostById(targetId);
  return {
    id: post.id,
    title: post.title,
    permalink: post.permalink,
    numberOfComments: post.numberOfComments,
    numberOfReports: post.numberOfReports,
  };
};

export const applyUserFlairForBadge = async (
  username: string,
  overrideText?: string
) => {
  const config = await getConfig();
  const text = overrideText ?? config.flairTextTemplate;
  if (!text.trim()) {
    return;
  }

  await reddit.setUserFlair({
    subredditName: context.subredditName,
    username,
    text,
    backgroundColor: '#d93900',
    textColor: 'light',
  });
};

export const createDashboardPost = async (title = 'Community Achievements') => {
  return await reddit.submitCustomPost({
    title,
  });
};

const buildRecap = async () => {
  const [config, unlocks, badges, stats] = await Promise.all([
    getConfig(),
    getUnlocks(),
    getBadges(),
    getStats(),
  ]);
  const weekUnlocks = unlocks
    .filter(
      (unlock) =>
        unlock.periodKey === stats.weekKey &&
        unlock.status !== 'revoked' &&
        unlock.status !== 'hidden'
    )
    .slice(0, 12);
  const weekBadges = badges
    .filter(
      (badge) =>
        !badge.revoked &&
        weekKeyFromDate(new Date(badge.createdAt)) === stats.weekKey
    )
    .slice(0, 12);
  const title = `🏆 ${config.weeklyRecapTitle} — ${stats.weekKey}`;
  const bodyLines = [
    `# ${config.weeklyRecapTitle}`,
    '',
    `Week: ${stats.weekKey}`,
    '',
    '## Achievements unlocked',
    weekUnlocks.length
      ? weekUnlocks
          .map(
            (unlock) =>
              `- ${unlock.achievementIcon} **${unlock.achievementName}** — ${unlock.subjectName}: ${unlock.reason}`
          )
          .join('\n')
      : '- No public achievements unlocked yet. The board is ready for next week.',
    '',
    '## Community stats',
    `- Posts tracked: ${stats.postsThisWeek}`,
    `- Comments tracked: ${stats.commentsThisWeek}`,
    `- Distinct participants seen by the app: ${stats.uniqueParticipantsThisWeek.length}`,
    `- Most active UTC hour: ${stats.mostActiveHourUtc}:00`,
    '',
    '## Badges awarded',
    weekBadges.length
      ? weekBadges
          .map(
            (badge) =>
              `- ${badge.achievementIcon} **${badge.achievementName}** — u/${badge.username}: ${badge.reason}`
          )
          .join('\n')
      : '- No manual badges this week.',
    '',
    'Scopri gli achievement della community nel post interattivo dell’app.',
    '',
    '_This recap reports organic community activity only. It never asks for votes or manipulates ranking._',
  ];

  return {
    title,
    body: bodyLines.join('\n'),
    weekKey: stats.weekKey,
  };
};

export const getWeeklySnapshots = async () => {
  const snapshots = await readJsonHash(
    keys.weeklySnapshots(),
    weeklySnapshotSchema
  );
  return snapshots.sort((left, right) => right.createdAt - left.createdAt);
};

const saveWeeklySnapshot = async (snapshot: WeeklySnapshot) => {
  await redis.hSet(keys.weeklySnapshots(), {
    [snapshot.weekKey]: JSON.stringify(snapshot),
  });
  await pruneSnapshotRecords();
};

const pruneSnapshotRecords = async () => {
  const snapshots = await getWeeklySnapshots();
  const extra = snapshots.slice(MAX_SNAPSHOTS);
  if (extra.length) {
    await redis.hDel(
      keys.weeklySnapshots(),
      extra.map((snapshot) => snapshot.weekKey)
    );
  }
};

export const getRecapPreview = async () => {
  return await buildRecap();
};

export const createRecapPost = async (actor: string) => {
  const config = await getConfig();
  const recap = await buildRecap();
  const existing = (await getWeeklySnapshots()).find(
    (snapshot) =>
      snapshot.weekKey === recap.weekKey && snapshot.status === 'published'
  );
  if (existing?.postId) {
    return {
      id: existing.postId,
      permalink: `https://reddit.com/comments/${existing.postId.replace('t3_', '')}`,
    };
  }

  if (config.requireApprovalForAutoPosts && actor === 'scheduler') {
    await saveWeeklySnapshot({
      weekKey: recap.weekKey,
      title: recap.title,
      body: recap.body,
      status: 'draft',
      createdAt: Date.now(),
    });
    await logEvent({
      type: 'recap_draft',
      actor,
      targetType: 'subreddit',
      message: `Saved recap draft for ${recap.weekKey}.`,
    });
    return {
      id: '',
      permalink: '',
    };
  }

  const post = await reddit.submitPost({
    subredditName: context.subredditName,
    title: recap.title,
    text: recap.body,
  });

  await saveWeeklySnapshot({
    weekKey: recap.weekKey,
    title: recap.title,
    body: recap.body,
    status: 'published',
    postId: post.id,
    createdAt: Date.now(),
    publishedAt: Date.now(),
  });
  await logEvent({
    type: 'recap_created',
    actor,
    targetId: post.id,
    targetType: 'post',
    message: `Created weekly recap for ${recap.weekKey}.`,
  });
  return post;
};

export const getLeaderboard = async (limit: number) => {
  const entries = await redis.zRange(keys.leaderboard(), 0, limit - 1, {
    by: 'rank',
    reverse: true,
  });
  return entries
    .filter((entry) => entry.score > 0)
    .map<LeaderboardEntry>((entry) => ({
      username: entry.member,
      score: entry.score,
    }));
};

export const getSupporterStatus = async (username?: string) => {
  if (!username) {
    return undefined;
  }

  const raw = await redis.hGet(keys.supporters(), username);
  return (
    parseJson(raw, supporterEntitlementSchema) ??
    createEmptySupporterEntitlement(username)
  );
};

const saveSupporterStatus = async (status: SupporterEntitlement) => {
  await redis.hSet(keys.supporters(), {
    [status.username]: JSON.stringify(status),
  });
};

const productAppliesPremium = (sku: string) => {
  return (
    sku === 'community_theme_pack' ||
    sku === 'season_pack' ||
    sku === 'advanced_recaps'
  );
};

export const fulfillPaidOrder = async (order: PaidOrder) => {
  if (order.status !== 'PAID' && order.status !== 'DELIVERED') {
    return {
      success: false,
      reason: 'Order has not been paid yet.',
    };
  }

  const existing = await redis.hGet(keys.orders(), order.id);
  if (existing) {
    return { success: true };
  }

  const username =
    order.metadata.username ?? context.username ?? order.metadata.buyer ?? '';
  if (!username) {
    return {
      success: false,
      reason: 'Unable to resolve buyer username.',
    };
  }

  const entitlement =
    (await getSupporterStatus(username)) ??
    createEmptySupporterEntitlement(username);
  const products = order.products.map((product) => product.sku);
  const nextEntitlement: SupporterEntitlement = {
    ...entitlement,
    supporterBadge:
      entitlement.supporterBadge || products.includes('supporter_badge'),
    communityThemePack:
      entitlement.communityThemePack ||
      products.includes('community_theme_pack'),
    seasonPack: entitlement.seasonPack || products.includes('season_pack'),
    advancedRecaps:
      entitlement.advancedRecaps || products.includes('advanced_recaps'),
    cosmeticFrame:
      entitlement.cosmeticFrame === 'supporter' ||
      products.includes('supporter_badge')
        ? 'supporter'
        : 'none',
    orderIds: entitlement.orderIds.includes(order.id)
      ? entitlement.orderIds
      : [...entitlement.orderIds, order.id],
    updatedAt: Date.now(),
  };

  await saveSupporterStatus(nextEntitlement);
  await redis.hSet(keys.orders(), { [order.id]: JSON.stringify(order) });

  if (products.includes('supporter_badge')) {
    await awardSupporterBadge(username, order.id);
  }

  if (products.some(productAppliesPremium)) {
    const config = await getConfig();
    await saveConfig({
      ...config,
      plan: 'premium',
      theme: config.theme === 'default' ? 'classic' : config.theme,
    });
  }

  await logEvent({
    type: 'payment_fulfilled',
    actor: username,
    targetType: 'user',
    message: `Fulfilled order ${order.id}: ${products.join(', ')}.`,
  });
  return { success: true };
};

export const refundPaidOrder = async (order: PaidOrder) => {
  const username =
    order.metadata.username ?? context.username ?? order.metadata.buyer ?? '';
  if (!username) {
    return;
  }

  const entitlement =
    (await getSupporterStatus(username)) ??
    createEmptySupporterEntitlement(username);
  const products = order.products.map((product) => product.sku);
  const remainingOrderIds = entitlement.orderIds.filter(
    (orderId) => orderId !== order.id
  );

  await saveSupporterStatus({
    ...entitlement,
    supporterBadge: products.includes('supporter_badge')
      ? false
      : entitlement.supporterBadge,
    communityThemePack: products.includes('community_theme_pack')
      ? false
      : entitlement.communityThemePack,
    seasonPack: products.includes('season_pack')
      ? false
      : entitlement.seasonPack,
    advancedRecaps: products.includes('advanced_recaps')
      ? false
      : entitlement.advancedRecaps,
    cosmeticFrame: products.includes('supporter_badge')
      ? 'none'
      : entitlement.cosmeticFrame,
    orderIds: remainingOrderIds,
    updatedAt: Date.now(),
  });

  await logEvent({
    type: 'payment_refunded',
    actor: username,
    targetType: 'user',
    message: `Refunded order ${order.id}: ${products.join(', ')}.`,
  });
};

const awardSupporterBadge = async (username: string, orderId: string) => {
  const achievements = await getAchievements();
  let achievement = achievements.find((item) => item.id === 'supporter_badge');
  if (!achievement) {
    achievement = {
      id: 'supporter_badge',
      name: 'Community Supporter',
      description: 'Cosmetic recognition for supporting the app.',
      type: 'manual',
      icon: '💛',
      color: '#f59e0b',
      threshold: 1,
      period: 'all-time',
      visibility: 'public',
      reward: 'badge',
      autoPublish: false,
      requiresApproval: false,
      cooldownHours: 0,
      maxUnlocksPerPeriod: 1000,
      antiSpamRules: 'Cosmetic supporter badge only.',
      enabled: true,
      builtIn: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveAchievements([achievement, ...achievements]);
  }

  const existingBadge = (await getUserBadges(username)).find(
    (badge) => badge.achievementId === 'supporter_badge' && !badge.revoked
  );
  if (existingBadge) {
    return existingBadge;
  }

  return await awardUserBadge({
    username,
    achievementId: 'supporter_badge',
    reason: `Support confirmed by order ${orderId}.`,
    createdBy: 'payment',
    source: 'supporter',
    visibility: 'public',
    applyFlair: true,
  });
};

export const getDashboardData = async (): Promise<DashboardData> => {
  await ensureInitialized(context.username);
  const [config, achievements, unlocks, badges, events, stats, isModerator] =
    await Promise.all([
      getConfig(),
      getAchievements(),
      getUnlocks(),
      getBadges(),
      getEvents(),
      getStats(),
      isCurrentUserModerator(),
    ]);

  const username = context.username;
  const myBadges = await getUserBadges(username);
  const leaderboard = await getLeaderboard(config.publicLeaderboardLimit);
  const supporterStatus = await getSupporterStatus(username);
  const weeklySnapshots = await getWeeklySnapshots();
  const visibleAchievements = isModerator
    ? achievements
    : achievements.filter((achievement) => achievement.visibility === 'public');
  const visibleUnlocks = isModerator
    ? unlocks
    : unlocks.filter((unlock) => unlock.status === 'approved');
  const visibleEvents = isModerator
    ? events
    : events.filter(
        (event) =>
          event.type === 'achievement_unlock' || event.type === 'recap_created'
      );

  return {
    config,
    achievements: visibleAchievements,
    unlocks: visibleUnlocks,
    badges: badges.filter(
      (badge) =>
        isModerator ||
        badge.visible ||
        (username !== undefined && badge.username === username)
    ),
    myBadges,
    events: visibleEvents,
    errors: isModerator
      ? events.filter((event) => event.type === 'error')
      : [],
    stats,
    leaderboard,
    supporterStatus,
    weeklySnapshots,
    planLimits: getPlanLimits(config.plan),
    username,
    isModerator,
    subredditName: context.subredditName,
  };
};

export const createCustomAchievement = async (
  input: Omit<
    AchievementDefinition,
    'id' | 'builtIn' | 'createdAt' | 'updatedAt' | 'enabled'
  >
) => {
  const [achievements, config] = await Promise.all([
    getAchievements(),
    getConfig(),
  ]);
  const limits = getPlanLimits(config.plan);
  const activeCount = achievements.filter((achievement) => achievement.enabled)
    .length;
  if (activeCount >= limits.activeAchievementLimit) {
    throw new Error('Active achievement limit reached for this plan.');
  }

  const now = Date.now();
  const achievement: AchievementDefinition = {
    ...input,
    id: makeId('custom'),
    enabled: true,
    builtIn: false,
    createdAt: now,
    updatedAt: now,
  };

  await saveAchievements([achievement, ...achievements]);
  await logEvent({
    type: 'settings_update',
    actor: context.username,
    targetType: 'subreddit',
    message: `Created achievement ${achievement.name}.`,
  });
  return achievement;
};

export const toggleAchievement = async (
  achievementId: string,
  enabled: boolean
) => {
  const [achievements, config] = await Promise.all([
    getAchievements(),
    getConfig(),
  ]);
  const limits = getPlanLimits(config.plan);
  const activeCount = achievements.filter((achievement) => achievement.enabled)
    .length;
  if (enabled && activeCount >= limits.activeAchievementLimit) {
    throw new Error('Active achievement limit reached for this plan.');
  }

  const updated = achievements.map((achievement) =>
    achievement.id === achievementId
      ? { ...achievement, enabled, updatedAt: Date.now() }
      : achievement
  );
  await saveAchievements(updated);
  return updated.find((achievement) => achievement.id === achievementId);
};

export const idsFromContextTarget = (targetId: string) => {
  const ids: { postId?: T3; commentId?: T1 } = {};
  if (isT3(targetId)) {
    ids.postId = targetId;
  }
  if (isT1(targetId)) {
    ids.commentId = targetId;
  }
  return ids;
};
