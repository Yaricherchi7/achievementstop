import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnCommentSubmitRequest,
  OnPostReportRequest,
  OnPostSubmitRequest,
  OnPostUpdateRequest,
  TriggerResponse,
} from '@devvit/web/shared';

import {
  createDashboardPost,
  ensureInitialized,
  evaluatePostAchievements,
  logError,
  recordCommentSubmit,
  recordPostReport,
  recordPostSubmit,
} from '../core/achievements';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const input = await c.req.json<OnAppInstallRequest>();
    await ensureInitialized(input.installer?.name);
    const post = await createDashboardPost('Community Achievements setup');

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `Community Achievements initialized with dashboard post ${post.id}.`,
      },
      200
    );
  } catch (error) {
    console.error(`Error during install trigger: ${error}`);
    await logError('Install trigger failed.');
    return c.json<TriggerResponse>(
      {
        status: 'error',
        message: 'Failed to initialize Community Achievements.',
      },
      400
    );
  }
});

triggers.post('/on-post-submit', async (c) => {
  try {
    const input = await c.req.json<OnPostSubmitRequest>();
    await recordPostSubmit({
      postId: input.post?.id,
      authorName: input.author?.name,
      title: input.post?.title,
    });
    return c.json<TriggerResponse>({}, 200);
  } catch (error) {
    console.error(`Error tracking post submit: ${error}`);
    await logError('Post submit trigger failed.');
    return c.json<TriggerResponse>({}, 400);
  }
});

triggers.post('/on-comment-submit', async (c) => {
  try {
    const input = await c.req.json<OnCommentSubmitRequest>();
    await recordCommentSubmit({
      commentId: input.comment?.id,
      postId: input.post?.id,
      authorName: input.author?.name ?? input.comment?.author,
      postCommentCount: input.post?.numComments,
      postTitle: input.post?.title,
    });
    return c.json<TriggerResponse>({}, 200);
  } catch (error) {
    console.error(`Error tracking comment submit: ${error}`);
    await logError('Comment submit trigger failed.');
    return c.json<TriggerResponse>({}, 400);
  }
});

triggers.post('/on-post-update', async (c) => {
  try {
    const input = await c.req.json<OnPostUpdateRequest>();
    if (input.post) {
      await evaluatePostAchievements({
        postId: input.post.id,
        postTitle: input.post.title,
        commentCount: input.post.numComments,
        reportCount: input.post.numReports,
        permalink: input.post.permalink,
      });
    }
    return c.json<TriggerResponse>({}, 200);
  } catch (error) {
    console.error(`Error tracking post update: ${error}`);
    await logError('Post update trigger failed.');
    return c.json<TriggerResponse>({}, 400);
  }
});

triggers.post('/on-post-report', async (c) => {
  try {
    const input = await c.req.json<OnPostReportRequest>();
    await recordPostReport(input.post?.id);
    return c.json<TriggerResponse>({}, 200);
  } catch (error) {
    console.error(`Error tracking post report: ${error}`);
    await logError('Post report trigger failed.');
    return c.json<TriggerResponse>({}, 400);
  }
});
