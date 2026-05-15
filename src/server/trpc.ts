import { TRPCError, initTRPC } from '@trpc/server';
import { context } from '@devvit/web/server';
import { z } from 'zod';

import { transformer } from '../shared/transformer';
import type { Context } from './context';
import {
  achievementTypeSchema,
  periodSchema,
  rewardSchema,
  visibilitySchema,
} from '../shared/achievements';
import {
  awardUserBadge,
  createCustomAchievement,
  createRecapPost,
  getRecapPreview,
  getConfig,
  getDashboardData,
  isCurrentUserModerator,
  logEvent,
  saveConfig,
  toggleAchievement,
} from './core/achievements';

const t = initTRPC.context<Context>().create({
  transformer,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireModerator = async () => {
  const isModerator = await isCurrentUserModerator();
  if (!isModerator) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Moderator permissions are required.',
    });
  }
};

const customAchievementInput = z.object({
  name: z
    .string()
    .min(2)
    .max(50)
    .refine((value) => !/upvote|downvote|karma|vote/i.test(value), {
      message: 'Achievement names cannot ask for vote or karma activity.',
    }),
  description: z
    .string()
    .min(4)
    .max(200)
    .refine((value) => !/upvote|downvote|karma|vote|cash|money/i.test(value), {
      message:
        'Achievement descriptions cannot promise money or manipulate voting.',
    }),
  type: achievementTypeSchema,
  icon: z.string().min(1).max(8),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  threshold: z.number().int().min(1).max(1000000),
  period: periodSchema,
  visibility: visibilitySchema,
  reward: rewardSchema,
  autoPublish: z.boolean(),
  requiresApproval: z.boolean(),
  cooldownHours: z.number().int().min(0).max(8760),
  maxUnlocksPerPeriod: z.number().int().min(1).max(1000),
  antiSpamRules: z.string().max(240),
});

export const appRouter = t.router({
  dashboard: t.router({
    get: publicProcedure.query(async () => {
      return await getDashboardData();
    }),
  }),
  settings: t.router({
    update: publicProcedure
      .input(
        z.object({
          active: z.boolean(),
          enabled: z.boolean(),
          autoTrackingEnabled: z.boolean(),
          weeklyRecapEnabled: z.boolean(),
          weeklyRecapDay: z.enum([
            'SUNDAY',
            'MONDAY',
            'TUESDAY',
            'WEDNESDAY',
            'THURSDAY',
            'FRIDAY',
            'SATURDAY',
          ]),
          weeklyRecapHour: z.number().int().min(0).max(23),
          timezone: z.string().min(1).max(64),
          leaderboardEnabled: z.boolean(),
          autoPublishEnabled: z.boolean(),
          requireApprovalForAutoPosts: z.boolean(),
          publicGalleryEnabled: z.boolean(),
          allowUserBadgeVisibilityControls: z.boolean(),
          flairRewardsEnabled: z.boolean(),
          manualAwardsEnabled: z.boolean(),
          publicLeaderboardLimit: z.number().int().min(3).max(25),
          weeklyRecapTitle: z.string().min(4).max(80),
          supportEnabled: z.boolean(),
          premiumTheme: z.enum(['classic', 'neon', 'minimal']),
          theme: z.enum(['default', 'classic', 'neon', 'minimal']),
          celebrationPostStyle: z.enum(['compact', 'detailed']),
          excludedUsers: z.array(z.string().min(1).max(40)).max(200),
          excludedFlairs: z.array(z.string().min(1).max(64)).max(200),
          excludedPostTypes: z.array(z.string().min(1).max(64)).max(50),
          minimumAccountAgeDays: z.number().int().min(0).max(3650),
          antiSpamSensitivity: z.enum(['low', 'medium', 'high']),
          flairTextTemplate: z.string().max(64),
        })
      )
      .mutation(async ({ input }) => {
        await requireModerator();
        const config = await getConfig();
        const updated = {
          ...config,
          ...input,
          active: input.enabled,
          requireApproval: input.requireApprovalForAutoPosts,
          updatedAt: Date.now(),
        };
        await saveConfig(updated);
        await logEvent({
          type: 'settings_update',
          actor: context.username,
          targetType: 'subreddit',
          message: 'Moderator updated app settings.',
        });
        return updated;
      }),
  }),
  achievements: t.router({
    create: publicProcedure
      .input(customAchievementInput)
      .mutation(async ({ input }) => {
        await requireModerator();
        return await createCustomAchievement(input);
      }),
    toggle: publicProcedure
      .input(
        z.object({
          achievementId: z.string(),
          enabled: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await requireModerator();
        return await toggleAchievement(input.achievementId, input.enabled);
      }),
  }),
  awards: t.router({
    user: publicProcedure
      .input(
        z.object({
          username: z.string().min(1).max(40),
          achievementId: z.string(),
          reason: z.string().min(3).max(180),
          visibility: z.enum(['public', 'private']),
          applyFlair: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        await requireModerator();
        return await awardUserBadge({
          ...input,
          createdBy: context.username ?? 'moderator',
        });
      }),
  }),
  recap: t.router({
    preview: publicProcedure.query(async () => {
      await requireModerator();
      return await getRecapPreview();
    }),
    create: publicProcedure.mutation(async () => {
      await requireModerator();
      const post = await createRecapPost(context.username ?? 'moderator');
      return {
        postId: post.id,
        permalink: post.permalink,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
