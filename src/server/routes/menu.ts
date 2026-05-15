import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import type { Form, MenuItemRequest, UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';

import {
  applyUserFlairForBadge,
  awardUserBadge,
  createDashboardPost,
  getAchievements,
  getPostInfo,
  getTargetAuthor,
  nominatePost,
  revokeLatestBadgeForUser,
} from '../core/achievements';

export const menu = new Hono();

const currentActor = () => context.username ?? 'moderator';

const readMenuRequest = async (c: HonoContext) => {
  return await c.req.json<MenuItemRequest>();
};

const firstString = (value: unknown) => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : '';
  }
  return '';
};

const firstBoolean = (value: unknown) => {
  return value === true || value === 'true';
};

menu.post('/open-dashboard', async (c) => {
  try {
    const post = await createDashboardPost('Community Achievements Dashboard');
    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/comments/${post.id.replace('t3_', '')}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error opening dashboard: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not open dashboard.' }, 400);
  }
});

menu.post('/award-helpful', async (c) => {
  try {
    const input = await readMenuRequest(c);
    const target = await getTargetAuthor(input.targetId);
    await awardUserBadge({
      username: target.username,
      achievementId: 'helpful_contributor',
      reason: `Recognized from ${target.title}.`,
      targetId: target.targetId,
      createdBy: currentActor(),
    });
    await applyUserFlairForBadge(target.username);

    return c.json<UiResponse>(
      {
        showToast: {
          text: `Awarded Helpful Hero to u/${target.username}.`,
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error awarding helpful contributor: ${error}`);
    return c.json<UiResponse>(
      { showToast: 'Could not award Helpful Hero.' },
      400
    );
  }
});

menu.post('/award-custom', async (c) => {
  try {
    const input = await readMenuRequest(c);
    const target = await getTargetAuthor(input.targetId);
    const achievements = (await getAchievements()).filter(
      (achievement) => achievement.enabled && achievement.reward === 'badge'
    );
    const form: Form = {
      title: 'Award achievement',
      description: `Award a badge to u/${target.username}.`,
      acceptLabel: 'Award',
      cancelLabel: 'Cancel',
      fields: [
        {
          name: 'target_id',
          label: 'Target',
          type: 'string',
          defaultValue: input.targetId,
          required: true,
        },
        {
          name: 'username',
          label: 'Username',
          type: 'string',
          defaultValue: target.username,
          required: true,
        },
        {
          name: 'achievement_id',
          label: 'Achievement',
          type: 'select',
          defaultValue: [achievements[0]?.id ?? 'helpful_contributor'],
          options: achievements.map((achievement) => ({
            label: `${achievement.icon} ${achievement.name}`,
            value: achievement.id,
          })),
          required: true,
        },
        {
          name: 'reason',
          label: 'Reason',
          type: 'paragraph',
          defaultValue: `Recognized from ${target.title}.`,
          required: true,
        },
        {
          name: 'visibility',
          label: 'Visibility',
          type: 'select',
          defaultValue: ['public'],
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Private', value: 'private' },
          ],
          required: true,
        },
        {
          name: 'apply_flair',
          label: 'Apply linked flair if enabled',
          type: 'boolean',
          defaultValue: true,
        },
      ],
    };

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'manual_award',
          form,
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error opening award form: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not open award form.' }, 400);
  }
});

menu.post('/manual-award-submit', async (c) => {
  try {
    const values = await c.req.json<Record<string, unknown>>();
    const visibilityValue = firstString(values.visibility);
    const visibility = visibilityValue === 'private' ? 'private' : 'public';
    const badge = await awardUserBadge({
      username: firstString(values.username).replace(/^u\//, ''),
      achievementId: firstString(values.achievement_id),
      reason: firstString(values.reason),
      visibility,
      targetId: firstString(values.target_id),
      createdBy: currentActor(),
      applyFlair: firstBoolean(values.apply_flair),
    });

    return c.json<UiResponse>(
      {
        showToast: {
          text: `Awarded ${badge.achievementName} to u/${badge.username}.`,
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error submitting award form: ${error}`);
    return c.json<UiResponse>({ showToast: 'Could not award badge.' }, 400);
  }
});

menu.post('/award-legend', async (c) => {
  try {
    const input = await readMenuRequest(c);
    const target = await getTargetAuthor(input.targetId);
    await awardUserBadge({
      username: target.username,
      achievementId: 'community_legend',
      reason: `Rare moderator recognition from ${target.title}.`,
      targetId: target.targetId,
      createdBy: currentActor(),
    });
    await applyUserFlairForBadge(target.username);

    return c.json<UiResponse>(
      {
        showToast: {
          text: `Awarded Community Legend to u/${target.username}.`,
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error awarding community legend: ${error}`);
    return c.json<UiResponse>(
      { showToast: 'Could not award Community Legend.' },
      400
    );
  }
});

menu.post('/nominate-post', async (c) => {
  try {
    const input = await readMenuRequest(c);
    const post = await getPostInfo(input.targetId);
    await nominatePost({
      postId: post.id,
      title: post.title,
      permalink: post.permalink,
      actor: currentActor(),
    });

    return c.json<UiResponse>(
      {
        showToast: {
          text: 'Post nominated for Meme of the Week.',
          appearance: 'success',
        },
      },
      200
    );
  } catch (error) {
    console.error(`Error nominating post: ${error}`);
    return c.json<UiResponse>(
      { showToast: 'Could not nominate this post.' },
      400
    );
  }
});

menu.post('/revoke-latest', async (c) => {
  try {
    const input = await readMenuRequest(c);
    const target = await getTargetAuthor(input.targetId);
    const revoked = await revokeLatestBadgeForUser({
      username: target.username,
      actor: currentActor(),
    });

    return c.json<UiResponse>(
      {
        showToast: revoked
          ? {
              text: `Revoked latest badge for u/${target.username}.`,
              appearance: 'success',
            }
          : `u/${target.username} has no active badge to revoke.`,
      },
      200
    );
  } catch (error) {
    console.error(`Error revoking badge: ${error}`);
    return c.json<UiResponse>(
      { showToast: 'Could not revoke the latest badge.' },
      400
    );
  }
});
