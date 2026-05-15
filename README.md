# Community Achievements

Community Achievements is a Devvit Web moderator tool for turning organic subreddit activity into achievements, badges, weekly recaps, positive leaderboards, and celebration posts.

The app is designed around Reddit-safe engagement:

- It never asks users to upvote, comment, share, or manipulate ranking.
- Automated recap publishing is disabled by default.
- Moderator approval stays on by default for automated celebrations.
- User-facing rewards are recognition, badges, recap mentions, and optional flair.
- Audit events explain why an achievement or badge was created.

## MVP

- Inline splash entrypoint for the Reddit feed.
- Expanded React dashboard for moderators and public viewers.
- Redis-backed config, stats, events, achievements, unlocks, and badges.
- Default achievements: First Spark, Comment Storm, Helpful Hero, Meme of the Week, Community Milestone, Daily Conversation, Clean Crowd, Newcomer Wave, High Quality Week, Community Legend.
- Moderator dashboard: app state, enabled achievements, weekly unlocks, awarded users, event log, safety state, manual recap.
- Custom achievements with threshold, period, visibility, reward, cooldown, cap, and anti-spam note fields.
- Menu actions for moderators:
  - Open Community Achievements.
  - Award Achievement with reason, visibility, and flair options.
  - Award Helpful Hero.
  - Nominate Meme of the Week.
  - Award Community Legend.
  - Revoke Latest Badge.
- Trigger tracking for post submit, comment submit, post update, and post report.
- Weekly scheduler endpoint that only posts when moderators opt in and the plan supports automatic recaps.
- Aggregate stats export through clipboard.
- Public gallery with progress bars, recent badges, latest winners, optional leaderboard, "My Badges", and support flow.
- User badge page with date, reason, source, subreddit, visibility, and flair status.
- Payment endpoints for `supporter_badge`, `community_theme_pack`, `season_pack`, and `advanced_recaps`.
- Idempotent supporter entitlement storage and refund handling.

## Plans And Products

Free communities can keep five achievements active, create one manual weekly recap, use base manual badges, and publish the public gallery. Premium-compatible products are defined in `devvit.json`:

- `supporter_badge`: cosmetic supporter badge and optional flair.
- `community_theme_pack`: premium gallery/recap themes.
- `season_pack`: monthly season mode structure.
- `advanced_recaps`: automatic recaps and advanced recap templates.

Supporter rewards are cosmetic only and do not affect ranking, scores, or competitive placement.

## Redis Model

- `config:{subredditId}`: hash for subreddit configuration.
- `achievements:{subredditId}`: hash of achievement definitions by achievement id.
- `counter:{subredditId}:...`: string counters for daily and weekly progress.
- `badges:{subredditId}` and `badges:{subredditId}:user:{username}`: badge hashes.
- `events:{subredditId}`: capped hash event log.
- `audit:{subredditId}`: capped hash moderator/payment audit log.
- `leaderboard:{subredditId}`: sorted set for positive badge counts.
- `weekly-snapshots:{subredditId}`: weekly recap drafts/published snapshots.
- `supporters:{subredditId}` and `payment-orders:{subredditId}`: entitlement and idempotent order records.

## Project Layout

- `src/client/splash.tsx`: fast inline view.
- `src/client/game.tsx`: expanded dashboard.
- `src/client/trpc.ts`: tRPC client.
- `src/shared/achievements.ts`: shared schemas, types, defaults, and period helpers.
- `src/server/trpc.ts`: dashboard, settings, achievement, award, and recap API.
- `src/server/core/achievements.ts`: Redis storage, achievement engine, badge system, recap generation.
- `src/server/routes/menu.ts`: moderator menu actions.
- `src/server/routes/payments.ts`: order fulfillment and refund endpoints.
- `src/server/routes/triggers.ts`: Devvit trigger handlers.
- `src/server/routes/scheduler.ts`: weekly recap task handler.
- `devvit.json`: Devvit entrypoints, menu items, triggers, scheduler, permissions.

## Commands

```bash
npm run type-check
npm run lint
npm run test
npm run build
npm run dev
```

## GitHub Pages

The public legal pages for GitHub Pages live in `docs/`:

- [Privacy Policy](docs/privacy-policy.md)
- [Terms & Conditions](docs/terms-and-conditions.md)

To publish them, enable GitHub Pages from the repository settings and use the `docs/` folder as the Pages source.

## Manuale Utente — Moderatori

### Come iniziare

1. Installa l’app nel subreddit.
2. Apri “Community Achievements” dal menu subreddit.
3. Attiva l’app.
4. Scegli achievement iniziali.
5. Imposta soglie.
6. Decidi se abilitare il recap settimanale.
7. Salva.

### Come assegnare un badge

1. Apri il menu su un post o commento.
2. Clicca “Award Achievement”.
3. Scegli badge.
4. Scrivi motivo.
5. Condividi se deve essere pubblico o privato, se la funzione è attiva.
6. Scegli se applicare il flair, se abilitato.
7. Conferma.

### Come creare un achievement

1. Apri dashboard.
2. Clicca “Create Achievement”.
3. Compila nome, descrizione, trigger e soglia.
4. Scegli periodo, visibilità e reward.
5. Imposta cooldown e regole anti-spam.
6. Salva.

### Come pubblicare recap

1. Apri dashboard.
2. Clicca “Generate Recap”.
3. Controlla anteprima.
4. Pubblica o salva bozza.

### Come evitare spam

- Lascia “Require mod approval” attivo.
- Imposta cooldown.
- Disabilita auto-publish per community molto grandi.
- Limita menzioni utenti.
- Usa recap settimanale invece di post giornalieri.

## Manuale Utente — Redditor

### Cosa sono gli achievement

Gli achievement sono riconoscimenti della community per milestone, eventi o contributi positivi. Possono celebrare obiettivi collettivi, post selezionati dai moderatori, badge manuali o momenti speciali del subreddit.

### Come ricevo un badge

Puoi riceverlo:

- Automaticamente quando la community raggiunge un obiettivo.
- Manualmente da un moderatore.
- Partecipando a eventi configurati dal subreddit.
- Supportando l’app, se il subreddit abilita badge supporter.

### Posso comprare vantaggi?

No. Eventuali acquisti sono cosmetici o di supporto. Non danno vantaggi nelle classifiche e non influenzano Reddit, voti, karma o ranking.

### Posso nascondere un badge?

Se la community abilita la funzione, puoi rendere alcuni badge non pubblici. I badge privati restano visibili a te e, quando necessario, ai moderatori per motivi di gestione e audit.

## Moderator Flow

1. Install the app on a subreddit.
2. The install trigger initializes Redis defaults and creates a Community Achievements setup post.
3. Open the expanded dashboard.
4. Keep the default achievements or create custom ones.
5. Use menu actions on posts/comments for manual awards.
6. Generate the weekly recap manually, or enable the weekly scheduler from settings.

## Privacy And Safety

The app stores aggregate subreddit counters, tracked event summaries, badge records, achievement unlock records, and moderator-configured settings. It does not profile sensitive categories and does not use Reddit votes, karma manipulation, or calls-to-action that influence ranking. Excluded users can be configured by moderators; `AutoModerator` is excluded by default.
