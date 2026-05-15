import './index.css';

import type { inferRouterOutputs } from '@trpc/server';
import { purchase, showToast } from '@devvit/web/client';
import { OrderResultStatus } from '@devvit/protos/json/devvit/ui/effect_types/v1alpha/create_order.js';
import type { ReactNode } from 'react';
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import type { AppRouter } from '../server/trpc';
import { weekKeyFromDate } from '../shared/achievements';
import { trpc } from './trpc';

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DashboardData = RouterOutputs['dashboard']['get'];
type Achievement = DashboardData['achievements'][number];
type Tab =
  | 'overview'
  | 'achievements'
  | 'awards'
  | 'settings'
  | 'public'
  | 'my-badges'
  | 'recap';

type CustomFormState = {
  name: string;
  description: string;
  type: 'community' | 'user' | 'post' | 'manual';
  icon: string;
  color: string;
  threshold: number;
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
};

type BooleanConfigKey =
  | 'enabled'
  | 'autoTrackingEnabled'
  | 'weeklyRecapEnabled'
  | 'leaderboardEnabled'
  | 'autoPublishEnabled'
  | 'requireApprovalForAutoPosts'
  | 'publicGalleryEnabled'
  | 'allowUserBadgeVisibilityControls'
  | 'flairRewardsEnabled'
  | 'manualAwardsEnabled'
  | 'supportEnabled';

const booleanSettings: { field: BooleanConfigKey; label: string }[] = [
  { field: 'enabled', label: 'App enabled' },
  { field: 'autoTrackingEnabled', label: 'Auto tracking enabled' },
  { field: 'weeklyRecapEnabled', label: 'Weekly recap scheduler' },
  { field: 'leaderboardEnabled', label: 'Public leaderboard' },
  { field: 'autoPublishEnabled', label: 'Auto-publish celebrations' },
  { field: 'requireApprovalForAutoPosts', label: 'Require mod approval' },
  { field: 'publicGalleryEnabled', label: 'Public gallery enabled' },
  {
    field: 'allowUserBadgeVisibilityControls',
    label: 'User badge visibility controls',
  },
  { field: 'flairRewardsEnabled', label: 'Flair rewards enabled' },
  { field: 'manualAwardsEnabled', label: 'Manual awards enabled' },
  { field: 'supportEnabled', label: 'Support / upgrade surface' },
];

const initialCustomForm: CustomFormState = {
  name: '',
  description: '',
  type: 'community',
  icon: '🏅',
  color: '#d93900',
  threshold: 10,
  period: 'weekly',
};

const formatDate = (value: number) => {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const classNames = (...values: (string | false | undefined)[]) => {
  return values.filter(Boolean).join(' ');
};

const parseCustomType = (value: string): CustomFormState['type'] => {
  if (
    value === 'community' ||
    value === 'user' ||
    value === 'post' ||
    value === 'manual'
  ) {
    return value;
  }
  return 'community';
};

const parseCustomPeriod = (value: string): CustomFormState['period'] => {
  if (
    value === 'daily' ||
    value === 'weekly' ||
    value === 'monthly' ||
    value === 'all-time'
  ) {
    return value;
  }
  return 'weekly';
};

const parseRecapDay = (
  value: string
): DashboardData['config']['weeklyRecapDay'] => {
  if (
    value === 'SUNDAY' ||
    value === 'MONDAY' ||
    value === 'TUESDAY' ||
    value === 'WEDNESDAY' ||
    value === 'THURSDAY' ||
    value === 'FRIDAY' ||
    value === 'SATURDAY'
  ) {
    return value;
  }
  return 'SUNDAY';
};

const parseTheme = (value: string): DashboardData['config']['theme'] => {
  if (
    value === 'default' ||
    value === 'classic' ||
    value === 'neon' ||
    value === 'minimal'
  ) {
    return value;
  }
  return 'default';
};

const parseAntiSpamSensitivity = (
  value: string
): DashboardData['config']['antiSpamSensitivity'] => {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'medium';
};

const progressForAchievement = (
  achievement: Achievement,
  data: DashboardData
) => {
  if (achievement.id === 'daily_post_goal') {
    return data.stats.postsToday;
  }
  if (achievement.id === 'daily_comment_goal') {
    return data.stats.commentsToday;
  }
  if (achievement.id === 'weekly_activity_goal') {
    return data.stats.activityThisWeek;
  }
  if (achievement.id === 'newcomer_wave') {
    return data.stats.uniqueParticipantsThisWeek.length;
  }
  if (achievement.id === 'high_quality_week') {
    return data.stats.reportsThisWeek <= 3
      ? data.stats.activityThisWeek
      : 0;
  }
  return data.unlocks.filter(
    (unlock) =>
      unlock.achievementId === achievement.id && unlock.status !== 'revoked'
  ).length;
};

const progressPercent = (achievement: Achievement, data: DashboardData) => {
  const progress = progressForAchievement(achievement, data);
  return Math.min(100, Math.round((progress / achievement.threshold) * 100));
};

const Stat = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className={classNames('text-xl font-semibold', accent)}>{value}</div>
    <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
  </div>
);

const Pill = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
    {children}
  </span>
);

export const App = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [awardUser, setAwardUser] = useState('');
  const [awardReason, setAwardReason] = useState('');
  const [awardAchievement, setAwardAchievement] = useState('helpful_contributor');
  const [awardVisibility, setAwardVisibility] = useState<'public' | 'private'>(
    'public'
  );
  const [awardFlair, setAwardFlair] = useState(true);
  const [customForm, setCustomForm] =
    useState<CustomFormState>(initialCustomForm);

  const refresh = async () => {
    const result = await trpc.dashboard.get.query();
    setData(result);
    if (!result.isModerator && tab === 'overview') {
      setTab('public');
    }
  };

  useEffect(() => {
    void trpc.dashboard.get.query().then((result) => {
      setData(result);
      if (!result.isModerator) {
        setTab('public');
      }
    });
  }, []);

  const enabledAchievements = useMemo(() => {
    return data?.achievements.filter((item) => item.enabled).length ?? 0;
  }, [data?.achievements]);

  const weekUnlocks = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.unlocks.filter(
      (unlock) =>
        unlock.periodKey === data.stats.weekKey && unlock.status !== 'revoked'
    );
  }, [data]);

  const weekBadges = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.badges.filter(
      (badge) =>
        !badge.revoked &&
        weekKeyFromDate(new Date(badge.createdAt)) === data.stats.weekKey
    );
  }, [data]);

  const leaderboard = data?.config.leaderboardEnabled ? data.leaderboard : [];

  const createRecap = async () => {
    setBusy(true);
    try {
      await trpc.recap.create.mutate();
      await refresh();
      showToast({ text: 'Weekly recap created.', appearance: 'success' });
    } catch {
      showToast('Could not create recap.');
    } finally {
      setBusy(false);
    }
  };

  const updateSettings = async (patch: Partial<DashboardData['config']>) => {
    if (!data) {
      return;
    }

    setBusy(true);
    try {
      const updated = await trpc.settings.update.mutate({
        active: patch.enabled ?? data.config.enabled,
        enabled: patch.enabled ?? data.config.enabled,
        autoTrackingEnabled:
          patch.autoTrackingEnabled ?? data.config.autoTrackingEnabled,
        weeklyRecapEnabled:
          patch.weeklyRecapEnabled ?? data.config.weeklyRecapEnabled,
        weeklyRecapDay:
          patch.weeklyRecapDay ?? data.config.weeklyRecapDay,
        weeklyRecapHour:
          patch.weeklyRecapHour ?? data.config.weeklyRecapHour,
        timezone: patch.timezone ?? data.config.timezone,
        leaderboardEnabled:
          patch.leaderboardEnabled ?? data.config.leaderboardEnabled,
        autoPublishEnabled:
          patch.autoPublishEnabled ?? data.config.autoPublishEnabled,
        requireApprovalForAutoPosts:
          patch.requireApprovalForAutoPosts ??
          data.config.requireApprovalForAutoPosts,
        publicGalleryEnabled:
          patch.publicGalleryEnabled ?? data.config.publicGalleryEnabled,
        allowUserBadgeVisibilityControls:
          patch.allowUserBadgeVisibilityControls ??
          data.config.allowUserBadgeVisibilityControls,
        flairRewardsEnabled:
          patch.flairRewardsEnabled ?? data.config.flairRewardsEnabled,
        manualAwardsEnabled:
          patch.manualAwardsEnabled ?? data.config.manualAwardsEnabled,
        publicLeaderboardLimit:
          patch.publicLeaderboardLimit ?? data.config.publicLeaderboardLimit,
        weeklyRecapTitle:
          patch.weeklyRecapTitle ?? data.config.weeklyRecapTitle,
        supportEnabled: patch.supportEnabled ?? data.config.supportEnabled,
        premiumTheme: patch.premiumTheme ?? data.config.premiumTheme,
        theme: patch.theme ?? data.config.theme,
        celebrationPostStyle:
          patch.celebrationPostStyle ?? data.config.celebrationPostStyle,
        excludedUsers: patch.excludedUsers ?? data.config.excludedUsers,
        excludedFlairs: patch.excludedFlairs ?? data.config.excludedFlairs,
        excludedPostTypes:
          patch.excludedPostTypes ?? data.config.excludedPostTypes,
        minimumAccountAgeDays:
          patch.minimumAccountAgeDays ?? data.config.minimumAccountAgeDays,
        antiSpamSensitivity:
          patch.antiSpamSensitivity ?? data.config.antiSpamSensitivity,
        flairTextTemplate:
          patch.flairTextTemplate ?? data.config.flairTextTemplate,
      });
      setData({ ...data, config: updated });
      showToast({ text: 'Settings saved.', appearance: 'success' });
    } catch {
      showToast('Could not save settings.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAchievement = async (achievementId: string, enabled: boolean) => {
    if (!data) {
      return;
    }

    setBusy(true);
    try {
      await trpc.achievements.toggle.mutate({ achievementId, enabled });
      await refresh();
      showToast({ text: 'Achievement updated.', appearance: 'success' });
    } catch {
      showToast('Could not update achievement.');
    } finally {
      setBusy(false);
    }
  };

  const createCustomAchievement = async () => {
    setBusy(true);
    try {
      await trpc.achievements.create.mutate({
        ...customForm,
        visibility: 'public',
        reward: customForm.type === 'manual' ? 'badge' : 'recap_mention',
        autoPublish: false,
        requiresApproval: true,
        cooldownHours: 24,
        maxUnlocksPerPeriod: 1,
        antiSpamRules: 'Moderator-created rule with cooldown and cap.',
      });
      setCustomForm(initialCustomForm);
      await refresh();
      showToast({ text: 'Achievement created.', appearance: 'success' });
    } catch {
      showToast('Could not create achievement.');
    } finally {
      setBusy(false);
    }
  };

  const awardManualBadge = async () => {
    if (!awardUser.trim() || !awardReason.trim()) {
      showToast('Add a username and reason first.');
      return;
    }

    setBusy(true);
    try {
      await trpc.awards.user.mutate({
        username: awardUser.trim().replace(/^u\//, ''),
        achievementId: awardAchievement,
        reason: awardReason.trim(),
        visibility: awardVisibility,
        applyFlair: awardFlair,
      });
      setAwardReason('');
      await refresh();
      showToast({ text: 'Badge awarded.', appearance: 'success' });
    } catch {
      showToast('Could not award badge.');
    } finally {
      setBusy(false);
    }
  };

  const exportStats = async () => {
    if (!data) {
      return;
    }
    const payload = {
      subredditName: data.subredditName,
      exportedAt: new Date().toISOString(),
      stats: data.stats,
      unlockedAchievements: data.unlocks.length,
      badgesAwarded: data.badges.filter((badge) => !badge.revoked).length,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    showToast({ text: 'Aggregate stats copied.', appearance: 'success' });
  };

  const supportApp = async () => {
    if (!data?.username) {
      showToast('Sign in to support and receive a badge.');
      return;
    }

    setBusy(true);
    try {
      const result = await purchase('supporter_badge', {
        subredditId: data.config.subredditId,
        subredditName: data.subredditName,
        username: data.username,
      });
      if (result.status === OrderResultStatus.STATUS_SUCCESS) {
        showToast({
          text: 'Thanks for the support. Your supporter badge will appear after fulfillment.',
          appearance: 'success',
        });
        await refresh();
      } else if (result.status === OrderResultStatus.STATUS_CANCELLED) {
        showToast('Support purchase cancelled.');
      } else {
        showToast(result.errorMessage ?? 'Support purchase failed.');
      }
    } catch {
      showToast('Support purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-700">
        <div className="text-center">
          <img className="mx-auto h-16 w-16" src="/snoo.png" alt="" />
          <p className="mt-4 text-sm font-medium">Loading achievements...</p>
        </div>
      </main>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '▦' },
    { id: 'achievements', label: 'Achievements', icon: '◇' },
    { id: 'awards', label: 'Awards', icon: '★' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
    { id: 'public', label: 'Public', icon: '◉' },
    { id: 'my-badges', label: 'My Badges', icon: '◎' },
    { id: 'recap', label: 'Recap', icon: '☰' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <img className="h-10 w-10" src="/snoo.png" alt="" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
              r/{data.subredditName}
            </p>
            <h1 className="truncate text-xl font-bold">
              Community Achievements
            </h1>
          </div>
          <span
            className={classNames(
              'rounded-full px-3 py-1 text-xs font-semibold',
              data.config.enabled
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-600'
            )}
          >
            {data.config.enabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={classNames(
                'flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold',
                tab === item.id
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
              onClick={() => setTab(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <section className="mx-auto max-w-6xl px-4 py-5">
        {tab === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat
                label="Achievements enabled"
                value={enabledAchievements}
                accent="text-orange-700"
              />
              <Stat
                label="Unlocked this week"
                value={weekUnlocks.length}
                accent="text-blue-700"
              />
              <Stat
                label="Users awarded"
                value={weekBadges.length}
                accent="text-emerald-700"
              />
              <Stat
                label="Weekly activity"
                value={data.stats.activityThisWeek}
                accent="text-fuchsia-700"
              />
            </div>

            {data.isModerator && (
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  className="rounded-md bg-orange-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={createRecap}
                >
                  🏆 Create weekly recap
                </button>
                <button
                  className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                  onClick={() => setTab('achievements')}
                >
                  ＋ Create achievement
                </button>
                <button
                  className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800"
                  onClick={() => setTab('settings')}
                >
                  ⚙ Manage settings
                </button>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-base font-bold">Latest tracked events</h2>
                <div className="mt-3 divide-y divide-slate-100">
                  {data.events.slice(0, 8).map((event) => (
                    <div key={event.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{event.message}</p>
                        <span className="shrink-0 text-xs text-slate-500">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{event.type}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-base font-bold">Safety status</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Auto-publish</span>
                    <strong>
                      {data.config.autoPublishEnabled ? 'Enabled' : 'Off'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Approval required</span>
                    <strong>
                      {data.config.requireApprovalForAutoPosts ? 'Yes' : 'No'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Weekly recap</span>
                    <strong>
                      {data.config.weeklyRecapEnabled ? 'Scheduled' : 'Manual'}
                    </strong>
                  </div>
                  <div className="pt-2">
                    <button
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold"
                      onClick={exportStats}
                    >
                      ⧉ Export aggregate stats
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === 'achievements' && (
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            {data.isModerator && (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-base font-bold">Create achievement</h2>
                <div className="mt-3 grid gap-3">
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Name"
                    value={customForm.name}
                    onChange={(event) =>
                      setCustomForm({ ...customForm, name: event.target.value })
                    }
                  />
                  <textarea
                    className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Description"
                    value={customForm.description}
                    onChange={(event) =>
                      setCustomForm({
                        ...customForm,
                        description: event.target.value,
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Icon"
                      value={customForm.icon}
                      onChange={(event) =>
                        setCustomForm({
                          ...customForm,
                          icon: event.target.value,
                        })
                      }
                    />
                    <input
                      className="h-10 rounded-md border border-slate-300 px-2"
                      type="color"
                      value={customForm.color}
                      onChange={(event) =>
                        setCustomForm({
                          ...customForm,
                          color: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={customForm.type}
                      onChange={(event) =>
                        setCustomForm({
                          ...customForm,
                          type: parseCustomType(event.target.value),
                        })
                      }
                    >
                      <option value="community">Community</option>
                      <option value="user">User</option>
                      <option value="post">Post</option>
                      <option value="manual">Manual</option>
                    </select>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={customForm.period}
                      onChange={(event) =>
                        setCustomForm({
                          ...customForm,
                          period: parseCustomPeriod(event.target.value),
                        })
                      }
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="all-time">All-time</option>
                    </select>
                  </div>
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    type="number"
                    min={1}
                    value={customForm.threshold}
                    onChange={(event) =>
                      setCustomForm({
                        ...customForm,
                        threshold: Number(event.target.value),
                      })
                    }
                  />
                  <button
                    className="rounded-md bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    disabled={busy}
                    onClick={createCustomAchievement}
                  >
                    ＋ Save achievement
                  </button>
                </div>
              </section>
            )}

            <section className="space-y-3">
              {data.achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-xl text-white"
                      style={{ backgroundColor: achievement.color }}
                    >
                      {achievement.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{achievement.name}</h3>
                        <Pill>{achievement.type}</Pill>
                        <Pill>{achievement.period}</Pill>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {achievement.description}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        Threshold {achievement.threshold}.{' '}
                        {achievement.antiSpamRules}
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs font-semibold text-slate-500">
                          <span>Progress</span>
                          <span>
                            {progressForAchievement(achievement, data)} /{' '}
                            {achievement.threshold}
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-orange-600"
                            style={{
                              width: `${progressPercent(achievement, data)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {data.isModerator && (
                      <button
                        className={classNames(
                          'rounded-md px-3 py-2 text-xs font-bold',
                          achievement.enabled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        )}
                        disabled={busy}
                        onClick={() =>
                          toggleAchievement(
                            achievement.id,
                            !achievement.enabled
                          )
                        }
                      >
                        {achievement.enabled ? 'On' : 'Off'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'awards' && (
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            {data.isModerator && (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-base font-bold">Manual award</h2>
                <div className="mt-3 grid gap-3">
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="username"
                    value={awardUser}
                    onChange={(event) => setAwardUser(event.target.value)}
                  />
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={awardAchievement}
                    onChange={(event) => setAwardAchievement(event.target.value)}
                  >
                    {data.achievements
                      .filter((achievement) => achievement.reward === 'badge')
                      .map((achievement) => (
                        <option key={achievement.id} value={achievement.id}>
                          {achievement.icon} {achievement.name}
                        </option>
                      ))}
                  </select>
                  <textarea
                    className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Reason shown in audit log and profile"
                    value={awardReason}
                    onChange={(event) => setAwardReason(event.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={awardVisibility}
                      onChange={(event) =>
                        setAwardVisibility(
                          event.target.value === 'private'
                            ? 'private'
                            : 'public'
                        )
                      }
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                    <label className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
                      Flair
                      <input
                        type="checkbox"
                        checked={awardFlair}
                        onChange={(event) => setAwardFlair(event.target.checked)}
                      />
                    </label>
                  </div>
                  <button
                    className="rounded-md bg-orange-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    disabled={busy}
                    onClick={awardManualBadge}
                  >
                    ★ Award badge
                  </button>
                </div>
              </section>
            )}

            <section className="space-y-3">
              {data.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{badge.achievementIcon}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">
                        {badge.achievementName}{' '}
                        <span className="text-slate-500">u/{badge.username}</span>
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {badge.reason}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {badge.source} · {badge.visibility} · Awarded by{' '}
                        {badge.createdBy} on {formatDate(badge.createdAt)}
                      </p>
                    </div>
                    <Pill>{badge.revoked ? 'revoked' : 'visible'}</Pill>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'settings' && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-base font-bold">Moderator settings</h2>
            {!data.isModerator && (
              <p className="mt-3 text-sm text-slate-600">
                Settings are only visible to moderators.
              </p>
            )}
            {data.isModerator && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {booleanSettings.map(({ field, label }) => (
                  <label
                    key={field}
                    className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm font-semibold"
                  >
                    {label}
                    <input
                      className="h-5 w-5"
                      type="checkbox"
                      checked={data.config[field]}
                      disabled={busy}
                      onChange={(event) =>
                        updateSettings({ [field]: event.target.checked })
                      }
                    />
                  </label>
                ))}
                <label className="grid gap-2 text-sm font-semibold">
                  Recap title
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.weeklyRecapTitle}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({ weeklyRecapTitle: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Leaderboard limit
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    type="number"
                    min={3}
                    max={25}
                    value={data.config.publicLeaderboardLimit}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        publicLeaderboardLimit: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Recap day
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.weeklyRecapDay}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        weeklyRecapDay: parseRecapDay(event.target.value),
                      })
                    }
                  >
                    {[
                      'SUNDAY',
                      'MONDAY',
                      'TUESDAY',
                      'WEDNESDAY',
                      'THURSDAY',
                      'FRIDAY',
                      'SATURDAY',
                    ].map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Recap hour
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    type="number"
                    min={0}
                    max={23}
                    value={data.config.weeklyRecapHour}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        weeklyRecapHour: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Timezone
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.timezone}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({ timezone: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Premium theme
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.theme}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({ theme: parseTheme(event.target.value) })
                    }
                  >
                    <option value="default">Default</option>
                    <option value="classic">Classic</option>
                    <option value="neon">Neon</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Anti-spam sensitivity
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.antiSpamSensitivity}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        antiSpamSensitivity: parseAntiSpamSensitivity(
                          event.target.value
                        ),
                      })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Minimum account age filter
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    type="number"
                    min={0}
                    value={data.config.minimumAccountAgeDays}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        minimumAccountAgeDays: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Flair text
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.flairTextTemplate}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({ flairTextTemplate: event.target.value })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Excluded flairs
                  <textarea
                    className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.excludedFlairs.join('\n')}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        excludedFlairs: event.target.value
                          .split('\n')
                          .map((name) => name.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Excluded post types
                  <textarea
                    className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.excludedPostTypes.join('\n')}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        excludedPostTypes: event.target.value
                          .split('\n')
                          .map((name) => name.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Excluded users
                  <textarea
                    className="min-h-24 rounded-md border border-slate-300 px-3 py-2"
                    value={data.config.excludedUsers.join('\n')}
                    disabled={busy}
                    onChange={(event) =>
                      updateSettings({
                        excludedUsers: event.target.value
                          .split('\n')
                          .map((name) => name.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              </div>
            )}
          </section>
        )}

        {tab === 'public' && (
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                    Public gallery
                  </p>
                  <h2 className="text-2xl font-bold">r/{data.subredditName}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {data.stats.activityThisWeek} organic posts and comments
                    tracked this week.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold"
                    onClick={() => setTab('my-badges')}
                  >
                    ◎ View my badges
                  </button>
                  {data.config.supportEnabled && (
                    <button
                      className="rounded-md bg-orange-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={supportApp}
                    >
                      💛 Support this app
                    </button>
                  )}
                </div>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="text-base font-bold">Achievement gallery</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {data.achievements
                    .filter((achievement) => achievement.visibility === 'public')
                    .map((achievement) => (
                      <div
                        key={achievement.id}
                        className="rounded-md border border-slate-200 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg text-white"
                            style={{ backgroundColor: achievement.color }}
                          >
                            {achievement.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold">{achievement.name}</p>
                            <p className="mt-1 text-xs text-slate-600">
                              {achievement.description}
                            </p>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-orange-600"
                                style={{
                                  width: `${progressPercent(
                                    achievement,
                                    data
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {progressForAchievement(achievement, data)} /{' '}
                              {achievement.threshold}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>

              <section className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-base font-bold">Recent badges</h2>
                  <div className="mt-3 space-y-3">
                    {data.badges
                      .filter((badge) => !badge.revoked && badge.visible)
                      .slice(0, 8)
                      .map((badge) => (
                        <div key={badge.id} className="flex gap-3">
                          <span className="text-xl">
                            {badge.achievementIcon}
                          </span>
                          <div>
                            <p className="text-sm font-bold">
                              {badge.achievementName} · u/{badge.username}
                            </p>
                            <p className="text-xs text-slate-600">
                              {badge.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h2 className="text-base font-bold">Latest winners</h2>
                  <div className="mt-3 space-y-3">
                    {data.unlocks.slice(0, 8).map((unlock) => (
                      <div key={unlock.id} className="flex gap-3">
                        <span className="text-xl">
                          {unlock.achievementIcon}
                        </span>
                        <div>
                          <p className="text-sm font-bold">
                            {unlock.achievementName}
                          </p>
                          <p className="text-xs text-slate-600">
                            {unlock.subjectName}: {unlock.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {data.config.leaderboardEnabled && (
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h2 className="text-base font-bold">
                      Positive leaderboard
                    </h2>
                    <div className="mt-3 space-y-2">
                      {leaderboard.map((entry, index) => (
                        <div
                          key={entry.username}
                          className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                        >
                          <span className="text-sm font-semibold">
                            {index + 1}. u/{entry.username}
                          </span>
                          <Pill>{entry.score} badge(s)</Pill>
                        </div>
                      ))}
                      {!leaderboard.length && (
                        <p className="text-sm text-slate-600">
                          No public badge leaderboard yet.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {tab === 'my-badges' && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">My badges</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Badge visibility is local to this subreddit.
                </p>
              </div>
              {data.supporterStatus?.cosmeticFrame === 'supporter' && (
                <Pill>Supporter frame</Pill>
              )}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.myBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="rounded-md border border-slate-200 p-4"
                >
                  <div className="flex gap-3">
                    <span className="text-2xl">{badge.achievementIcon}</span>
                    <div>
                      <p className="font-bold">{badge.achievementName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {badge.reason}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDate(badge.createdAt)} · {badge.source} · r/
                        {badge.subredditName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Visibility: {badge.visibility}. Flair:{' '}
                        {badge.flairApplied ? 'applied' : 'not applied'}.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {!data.myBadges.length && (
                <p className="text-sm text-slate-600">
                  No badges yet. When moderators recognize a contribution, it
                  will appear here.
                </p>
              )}
            </div>
          </section>
        )}

        {tab === 'recap' && (
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-bold">Recap preview</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Latest generated drafts and published weekly snapshots.
                </p>
              </div>
              {data.isModerator && (
                <button
                  className="rounded-md bg-orange-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={busy}
                  onClick={createRecap}
                >
                  Publish now
                </button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {data.weeklySnapshots.map((snapshot) => (
                <div
                  key={snapshot.weekKey}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{snapshot.title}</p>
                    <Pill>{snapshot.status}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {snapshot.weekKey} · {formatDate(snapshot.createdAt)}
                  </p>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                    {snapshot.body}
                  </pre>
                </div>
              ))}
              {!data.weeklySnapshots.length && (
                <p className="text-sm text-slate-600">
                  No recap snapshots yet.
                </p>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
