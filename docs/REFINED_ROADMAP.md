# SailorClawBot: Roadmap

**Baseline:** June 14, 2026  
**Design spec:** `docs/superpowers/specs/2026-06-14-bot-design.md`

---

## Status Overview

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Monorepo, Prisma, Docker | ✅ DONE |
| 1 | Core services + repos (41 tests) | ✅ DONE |
| 2 | Discord.js bot foundation (8 commands) | ✅ DONE (partial — no Discord API calls yet) |
| 2.5 | Schema mega-migration + Discord API fixes + RoleMapping + Worker infra + /kick /cases | 🔜 NEXT |
| 3 | XP/Leveling vertical slice | ⏳ |
| 4 | Economy extended (gambling, shop, inventory) | ⏳ |
| 5 | Tickets full Discord integration | ⏳ |
| 6 | Auto-moderation (6 rule types) | ⏳ |
| 7 | Server management (logging, welcome, reaction roles, giveaways, starboard) | ⏳ |
| 8 | Family/Clan | ⏳ |
| 9 | Admin Dashboard (Next.js + OAuth2) | ⏳ |
| 10 | User Dashboard (rank card, leaderboards) | ⏳ |
| 11 | Achievements (20+ types) | ⏳ |
| 12 | i18n EN+RU + rate limiting + polish | ⏳ |
| 13 | Music stub (interface + placeholder) | ⏳ |

---

## PHASE 0 ✅ DONE

- Monorepo (Turbo + pnpm workspaces)
- TypeScript strict config
- Prisma + PostgreSQL + Docker
- Base contracts (DTOs, events, errors)
- CI pipeline (GitHub Actions)

---

## PHASE 1 ✅ DONE

**41 tests passing. 95%+ coverage on core services.**

### Repos implemented
`GuildRepositoryImpl`, `GuildMemberRepositoryImpl`, `ProfileRepositoryImpl`, `WalletRepositoryImpl`, `TransactionRepositoryImpl`, `WarningRepositoryImpl`, `MuteRepositoryImpl`, `BanRepositoryImpl`, `CaseRepositoryImpl`, `PermissionRepositoryImpl`, `TicketRepositoryImpl`, `FamilyRepositoryImpl`

### Services implemented
`GuildService`, `ProfileService`, `ModerationService`, `EconomyService`, `TicketService`, `FamilyService`, `PermissionService`

---

## PHASE 2 ✅ DONE (partial)

**8 slash commands, DI container, event handlers.**

### Commands
`/warn`, `/mute`, `/unmute`, `/ban`, `/unban`, `/balance`, `/transfer`, `/profile`

### Events
`ready`, `guildCreate`, `guildDelete`, `interactionCreate`

### Known gaps (fixed in Phase 2.5)
- Ban/mute do NOT call Discord API yet (DB only)
- No RoleMapping permission check
- No GuildSettings service/repo
- Missing schema models (GuildSettings, XP fields, etc.)

---

## PHASE 2.5 🔜 NEXT — Foundation Fixes

**Completion criteria:**
```sh
✅ pnpm build — no TS errors
✅ /ban actually bans in Discord
✅ /mute actually timeouts in Discord
✅ Guild owner always has full permissions
✅ pnpm test — all 41+ tests pass
```

### 2.5.1 Prisma mega-migration
Add all models from design spec Section 3:
- `GuildSettings` (ticket config, welcome, XP config, starboard, logging, colors, economy config)
- `RoleMapping` (Discord role → bot permission string)
- `LevelRole`, `XpMultiplier`, `NoXpTarget`
- `Item`, `InventoryItem`
- `AutoModRule`
- `ReactionRole`
- `Giveaway`
- `StarboardEntry`
- `Achievement`, `UserAchievement`

Add fields to existing models:
- `Profile`: `xp Int @default(0)`, `level Int @default(0)`, `totalXp Int @default(0)`
- `Ticket`: `channelId String?`, `claimedById String?`, `claimedAt DateTime?`, `closedById String?`, `rating Int?`, `subject String?`

### 2.5.2 Fix Discord API calls
- `/ban` → `guild.members.ban(userId, { reason })`
- `/mute` → `member.timeout(durationMs, reason)` (max 28 days Discord limit)
- `/unban` → `guild.members.unban(userId)`
- `/unmute` → `member.timeout(null)`

### 2.5.3 RoleMapping permission system
- `GuildSettingsRepositoryImpl` + `GuildSettingsService` (getSettings, updateSettings)
- Update `PermissionService.hasPermission()`: check guild owner → RoleMapping → PermissionOverride
- Per-action permission strings: `can_warn`, `can_mute`, `can_ban`, `can_manage_tickets`, `can_manage_guild`
- Add to container: `guildSettingsRepo`, `guildSettingsService`

### 2.5.4 Add missing commands
- `/kick @user [reason]` → `member.kick(reason)` — was missing from Phase 2
- `/cases [@user]` → paginated embed of moderation cases from CaseRepository

### 2.5.5 Update bot intents
Add `GatewayIntentBits.MessageContent` (privileged — must be enabled in Discord Developer Portal).
`GUILD_MEMBERS` already in intents — verify it's enabled in portal too.

### 2.5.6 Worker infrastructure (apps/worker)
Basic worker setup needed before Phase 3 (XP cooldowns, mute/ban expiry):
- `apps/worker/src/jobs/ProcessMuteExpiry.ts` — cron every 1 min: find expired Mute records → `member.timeout(null)` via Discord REST
- `apps/worker/src/jobs/ProcessBanExpiry.ts` — cron every 1 min: find expired Ban records → `guild.members.unban()`
- Worker needs its own Discord REST client (not full gateway, just REST)
- Job runner: `node-cron` (no Redis/Bull needed at this stage — add Redis in Phase 4 if scale requires)

---

## PHASE 3 — XP / Leveling

**Vertical slice: schema (done in 2.5) → service → commands → Dashboard page.**

### XpService (packages/core)
- `grantXp(guildId, userId, amount)` → returns `{ leveled: boolean, newLevel: number }`
- `getLeaderboard(guildId, page, limit)` → sorted by `totalXp DESC`
- `setXp(guildId, userId, amount)` — admin
- Level formula: `XP_needed(n) = 5n² + 50n + 100`

### Bot integration
- `messageCreate` handler: check cooldown (in-memory Map), check NoXpTarget, apply XpMultiplier, call `xpService.grantXp()`
- On level-up: assign LevelRole if configured, send embed notification (channel or DM per GuildSettings)
- Level-up embed: color `0x3498db`, show new level + XP needed for next

### Commands
- `/rank [@user]` — embed with avatar, level, XP bar (text-based), rank position
- `/leaderboard [page]` — top 10 per page, paginated with Prev/Next buttons
- `/xp give @user <amount>` (admin)
- `/xp set @user <amount>` (admin)

### Dashboard page
- `/dashboard/[guildId]/leveling`: enable/disable XP, xpMin/xpMax/cooldown sliders, level-up message template, level-up channel selector, LevelRole table (add/remove), XpMultiplier table, NoXpTarget list

**Completion criteria:**
```sh
✅ XP granted on message, cooldown respected
✅ Level-up triggers role assignment
✅ /rank shows correct data
✅ /leaderboard paginates correctly
✅ XpService tests 80%+ coverage
```

---

## PHASE 4 — Economy Extended

### EconomyService extensions (packages/core)
- `claimDaily(guildId, userId)` → amount from GuildSettings, 24h cooldown
- `work(guildId, userId)` → random amount, 1h cooldown
- `crime(guildId, userId)` → higher reward, 25% chance fine, 2h cooldown
- `rob(guildId, userId, targetId)` → steal 10-30% target balance, 30% backfire, 4h cooldown
- `coinflip(guildId, userId, choice, amount)` → 50/50
- `slots(guildId, userId, amount)` → 3-reel, 5 symbols
- `blackjack(guildId, userId, amount)` → deal cards, stand/hit/double buttons
- `roulette(guildId, userId, bet, amount)` → red/black/number

### ShopService / InventoryService (packages/core)
- `ShopService`: `listItems(guildId)`, `buyItem(guildId, userId, itemId)`, `createItem(guildId, data)`, `deleteItem(guildId, itemId)`
- `InventoryService`: `listInventory(guildId, userId)`, `useItem(guildId, userId, itemId)`

### Commands
`/daily`, `/work`, `/crime`, `/rob @user`, `/coinflip heads|tails <amount>`, `/slots <amount>`, `/blackjack <amount>` (with Hit/Stand/Double buttons), `/roulette <bet> <amount>`, `/shop [page]`, `/buy <item>`, `/sell <item>`, `/inventory`

### Dashboard page
`/dashboard/[guildId]/economy`: currency name/emoji, dailyAmount, startingBalance, shop item management table (add/edit/delete)

---

## PHASE 5 — Tickets (Full Discord Integration)

### Bot events
`messageCreate` in ticket channel:
1. Delete user message
2. Create channel `ticket-{username}-{ticketNumber}` in `ticketCategoryId`
3. Set permissions: only user + staff roles see channel
4. Post claim embed (blue border, user info, subject, Claim button, Close button)
5. Call `ticketService.openTicket()` → save `channelId`, `subject`
6. Edit stats embed in `ticketStatsMessageId`

Button interactions:
- **Claim** → edit embed (show claimer), update DB `claimedById`, update stats
- **Close** → prompt rating (5 buttons 1-5 ⭐), close ticket in DB, update stats, optionally delete/archive channel after 24h (worker job)
- **Rate 1-5** → save `Ticket.rating`

### Commands
- `/ticket setup` — creates stats embed in current channel, saves to GuildSettings
- `/ticket close [reason]` — closes ticket if run inside ticket channel
- `/ticket add @user` — adds user to ticket channel permissions
- `/ticket remove @user` — removes user from ticket channel permissions

### Stats embed format
```
🎫 Support Tickets
📨 Total: 42
⏳ Pending: 3
🔍 In Progress: 2
✅ Closed: 37
```

### Dashboard page
`/dashboard/[guildId]/tickets`: category selector, stats channel selector, log channel selector, active tickets list with claim/close actions

---

## PHASE 6 — Auto-Moderation

### AutoModService (packages/core)
`checkMessage(message, rules, guildSettings)` → `AutoModResult | null`

### Rules
| Type | Config | Trigger | Default action |
|------|--------|---------|----------------|
| `spam` | threshold (msgs/5s window) | Rate > threshold | mute 5min |
| `links` | whitelist: string[] | Non-whitelisted URLs | delete |
| `caps` | threshold: 0-100% | % caps > threshold | delete |
| `invites` | whitelist: guildId[] | discord.gg links | delete + warn |
| `mentions` | max: number | @mention count > max | mute 10min |
| `words` | patterns: string[] | Word/regex match | delete + warn |

### Bot integration
`messageCreate` → `autoModService.checkMessage()` → execute action → log to mod-log channel

### Dashboard page
`/dashboard/[guildId]/automod`: per-rule card (enable toggle, threshold input, whitelist, action selector, duration input)

---

## PHASE 7 — Server Management

### Logging
- `LogService.log(guildId, event, data)` → format embed → send to `logChannelId`
- Events: `ban`, `unban`, `mute`, `unmute`, `warn`, `kick`, `join`, `leave`, `messageEdit`, `messageDelete`, `channelCreate`, `channelDelete`
- Each event toggleable in Dashboard per-channel
- Log embed: timestamp, actor, target, reason, case ID (if applicable)

### Welcome / Leave
- `guildMemberAdd` event → fetch GuildSettings → render embed template → send to welcomeChannelId or user DM
- `guildMemberRemove` event → same for leaveMessage
- Template variables: `{username}`, `{mention}`, `{server}`, `{memberCount}`, `{date}`

### Reaction Roles
- `messageReactionAdd` → lookup `ReactionRole` by `guildId + messageId + emoji` → add Discord role
- `messageReactionRemove` → remove Discord role
- `/reactionrole add <message_link> <emoji> @role`
- `/reactionrole remove <message_link> <emoji>`
- Dashboard: visual panel builder

### Giveaways
- `/giveaway create prize:"..." duration:"1h" winners:1` → post embed, save to DB
- `messageReactionAdd` on 🎉 → add userId to `Giveaway.participants`, edit embed with count
- Worker job at `endsAt` → pick winners, update embed, ping winners in channel
- `/giveaway end <id>`, `/giveaway reroll <id>`

### Starboard (disabled by default)
- `messageReactionAdd` with ⭐ → count total ⭐ on message
- If ≥ threshold AND no StarboardEntry → post to `starboardChannelId`, save entry
- If count changes → edit starboard message
- If drops below threshold → delete starboard message, remove entry

---

## PHASE 8 — Family / Clan

**No family bank, no quests, no bonuses. Social only.**

### FamilyService extensions
- `getFamilyLeaderboard(guildId)` → join Profile, sum `totalXp`, group by family
- `inviteMember(guildId, familyId, userId, inviterId)`
- `kickMember(guildId, familyId, userId, kickerId)` — leader only

### Commands
`/family create <name>`, `/family info [name]`, `/family join <name>`, `/family leave`, `/family invite @user`, `/family kick @user`, `/family top`

Family top embed: top 10 families by total member XP, color `0x9b59b6`.

---

## PHASE 9 — Admin Dashboard (Next.js)

**Tech:** Next.js 14 App Router, Tailwind CSS, Discord OAuth2, REST API from bot/core.

- OAuth2 login → store session → check user is guild admin/owner
- Guild selector (shows all mutual guilds where user has MANAGE_GUILD)
- Settings pages per domain (see design spec Section 5)
- All changes call API → update GuildSettings in DB

---

## PHASE 10 — User Dashboard

Public profile pages:
- `/u/[guildId]/[userId]` — rank card (level, XP bar, rank#, balance, achievements)
- `/dashboard/[guildId]/leaderboard` — XP top, paginated, weekly/all-time toggle
- `/dashboard/[guildId]/economy/top` — balance leaderboard

No admin required to view. Discord OAuth2 only for "my profile" features.

---

## PHASE 11 — Achievements

- `AchievementService.check(guildId, userId, trigger)` — called from XpService, EconomyService, TicketService
- 20+ predefined achievements (see design spec Section 4.8)
- On unlock: send DM embed + log to server
- `/achievements [@user]` — embed grid of earned achievements
- User Dashboard: achievements showcase section

---

## PHASE 12 — i18n + Rate Limiting + Polish

### i18n
- `apps/bot/src/i18n/en.json` + `ru.json`
- `t(key, locale, vars?)` helper — no external lib
- Locale from `interaction.guildLocale` → fallback to `GuildSettings.locale` → fallback `en`

### Rate limiting
- Moderation commands: no user cooldown (staff)
- Gambling: 5s in-memory per user
- General commands: 3s in-memory per user
- Daily/work/crime/rob: persisted cooldowns in DB

### Polish
- Error embed improvements
- Loading states (deferReply everywhere)
- Consistent footer text across all embeds
- Slash command descriptions in RU + EN

---

## PHASE 13 — Music Stub

- `packages/contracts/src/services/IMusicService.ts` — interface only
- `@discordjs/voice` added to `apps/bot/package.json`
- `/music` command → embed "🎵 Music coming soon"
- No implementation. Full music requires separate infrastructure + streaming source decision.

---

## Completion Criteria (per phase)

Each phase must pass before starting next:
```sh
pnpm build          # zero TS errors
pnpm test           # all tests pass, 80%+ coverage on new code
pnpm prisma validate
# Manual: test commands in dev Discord server
```
