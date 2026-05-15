import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/web/server';

import {
  createRecapPost,
  getConfig,
  logEvent,
} from '../core/achievements';
import { getPlanLimits } from '../../shared/achievements';

export const schedulerRoutes = new Hono();

schedulerRoutes.post('/weekly-recap', async (c) => {
  try {
    await c.req.json<TaskRequest>();
    const config = await getConfig();

    const limits = getPlanLimits(config.plan);
    if (!config.enabled || !config.weeklyRecapEnabled || !limits.automaticRecaps) {
      await logEvent({
        type: 'settings_update',
        targetType: 'subreddit',
        message: 'Weekly recap scheduler ran but automatic recap is disabled.',
      });
      return c.json<TaskResponse>({}, 200);
    }

    await createRecapPost('scheduler');
    return c.json<TaskResponse>({}, 200);
  } catch (error) {
    console.error(`Error running weekly recap: ${error}`);
    return c.json<TaskResponse>({}, 400);
  }
});
