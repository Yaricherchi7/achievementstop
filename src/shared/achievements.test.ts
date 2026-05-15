import { describe, expect, it } from 'vitest';

import {
  createDefaultAchievements,
  createDefaultConfig,
  dayKeyFromDate,
  weekKeyFromDate,
} from './achievements';

describe('achievement defaults', () => {
  it('ships the MVP achievements enabled', () => {
    const achievements = createDefaultAchievements(1);

    expect(achievements.map((achievement) => achievement.id)).toContain(
      'daily_post_goal'
    );
    expect(achievements.map((achievement) => achievement.id)).toContain(
      'helpful_contributor'
    );
    expect(achievements.map((achievement) => achievement.id)).toContain(
      'meme_of_the_week'
    );
    expect(achievements.filter((achievement) => achievement.enabled)).toHaveLength(
      5
    );
  });

  it('keeps automated recap disabled until a moderator opts in', () => {
    const config = createDefaultConfig('example', 't5_example', 1);

    expect(config.weeklyRecapEnabled).toBe(false);
    expect(config.autoPublishEnabled).toBe(false);
    expect(config.requireApprovalForAutoPosts).toBe(true);
  });
});

describe('period keys', () => {
  it('creates stable daily and weekly keys in UTC', () => {
    const date = new Date('2026-05-15T12:00:00.000Z');

    expect(dayKeyFromDate(date)).toBe('2026-05-15');
    expect(weekKeyFromDate(date)).toBe('2026-W20');
  });
});
