# SailorClawBot — Bot Design Spec

**Date:** 2026-06-14  
**Status:** Approved  
**Scope:** Full feature set, Phase 2.5 → 13

---

## 1. Core Philosophy

**Beauty + Simplicity.** Dashboard/Website is primary interface. Slash commands supplement.

Every bot response:
- `EmbedBuilder` with domain color
- `ActionRowBuilder<ButtonBuilder>` where user action expected
- `ModalBuilder` for form input
- No plain text responses

---

## 2. Architecture

### Monorepo Layers (strict order)
```
contracts → core → database → bot → worker → dashboard
```

### Apps
| App | Role |
|-----|------|
| `apps/bot` | Discord events, slash commands, embeds, buttons |
| `apps/worker` | Background jobs: mute/ban expiry, giveaway timers, leaderboard cache |
| `apps/dashboard` | Next.js: OAuth2 Discord login, admin settings, user profile |

### Embed Color System
| Action Type | Color | Hex |
|-------------|-------|-----|
| Punitive (warn/mute/ban/kick) | Red | `0xe74c3c` |
| Restorative (unmute/unban) | Green | `0x57f287` |
| Info/neutral | Blurple | `0x5865f2` |
| Economy | Gold | `0xf1c40f` |
| XP/Level | Blue | `0x3498db` |
| Tickets | Teal | `0x1abc9c` |
| Family | Purple | `0x9b59b6` |

All colors stored in `GuildSettings.embedColors` (JSON), configurable in Dashboard.

---

## 3. Schema Additions (Phase 2.5 Mega-Migration)

### New models

```prisma
model GuildSettings {
  guildId              String  @id
  guild                Guild   @relation(fields: [guildId], references: [id])

  // Tickets
  ticketCategoryId     String?
  ticketChannelId      String?
  ticketStatsMessageId String?
  ticketLogChannelId   String?

  // Welcome/Leave
  welcomeChannelId     String?
  welcomeMessage       String? // JSON embed template with {username},{mention},{server},{memberCount}
  leaveChannelId       String?
  leaveMessage         String?
  welcomeDm            Boolean @default(false)

  // Leveling
  xpEnabled            Boolean @default(true)
  xpMin                Int     @default(15)
  xpMax                Int     @default(25)
  xpCooldown           Int     @default(60) // seconds
  levelUpChannelId     String? // null = current channel
  levelUpDm            Boolean @default(false)
  levelUpMessage       String? // template: "GG {mention}, level {level}!"

  // Starboard
  starboardEnabled     Boolean @default(false)
  starboardChannelId   String?
  starboardThreshold   Int     @default(3)

  // Logging
  logChannelId         String?
  logEvents            Json    @default("[]")

  // Colors
  embedColors          Json    @default("{}")

  // Locale
  locale               String  @default("en")

  // Economy
  currencyName         String  @default("coins")
  currencyEmoji        String  @default("🪙")
  dailyAmount          Int     @default(100)
  startingBalance      Int     @default(0)
}

model RoleMapping {
  id         String @id @default(cuid())
  guildId    String
  roleId     String
  permission String // "can_warn" | "can_mute" | "can_ban" | "can_manage_tickets" | "can_manage_guild"
  @@unique([guildId, roleId, permission])
}

model LevelRole {
  id      String @id @default(cuid())
  guildId String
  level   Int
  roleId  String
  @@unique([guildId, level])
}

model XpMultiplier {
  id         String @id @default(cuid())
  guildId    String
  targetId   String
  targetType String // "channel" | "role"
  multiplier Float  @default(1.0)
  @@unique([guildId, targetId, targetType])
}

model NoXpTarget {
  id         String @id @default(cuid())
  guildId    String
  targetId   String
  targetType String // "channel" | "role"
  @@unique([guildId, targetId])
}

model Item {
  id             String          @id @default(cuid())
  guildId        String
  name           String
  description    String?
  price          BigInt
  emoji          String?
  type           String          // "role" | "cosmetic" | "consumable"
  effect         Json?
  stock          Int?            // null = unlimited
  inventoryItems InventoryItem[]
}

model InventoryItem {
  id       String @id @default(cuid())
  guildId  String
  userId   String
  itemId   String
  quantity Int    @default(1)
  item     Item   @relation(fields: [itemId], references: [id])
  @@unique([guildId, userId, itemId])
}

model AutoModRule {
  id      String  @id @default(cuid())
  guildId String
  type    String  // "spam"|"links"|"caps"|"invites"|"mentions"|"words"
  enabled Boolean @default(true)
  config  Json    // { threshold, whitelist, action, duration }
}

model ReactionRole {
  id        String @id @default(cuid())
  guildId   String
  messageId String
  channelId String
  emoji     String
  roleId    String
  @@unique([guildId, messageId, emoji])
}

model Giveaway {
  id           String    @id @default(cuid())
  guildId      String
  channelId    String
  messageId    String?
  prize        String
  winnersCount Int       @default(1)
  endsAt       DateTime
  endedAt      DateTime?
  hostId       String
  participants Json      @default("[]")
  winners      Json      @default("[]")
}

model StarboardEntry {
  id             String @id @default(cuid())
  guildId        String
  originalMsgId  String
  starboardMsgId String
  authorId       String
  starCount      Int    @default(0)
  @@unique([guildId, originalMsgId])
}

model Achievement {
  id               String            @id @default(cuid())
  key              String            @unique
  name             String
  description      String
  emoji            String
  userAchievements UserAchievement[]
}

model UserAchievement {
  id            String      @id @default(cuid())
  guildId       String
  userId        String
  achievementId String
  unlockedAt    DateTime    @default(now())
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  @@unique([guildId, userId, achievementId])
}
```

### Profile model additions
```prisma
// Add to existing Profile:
xp      Int @default(0)
level   Int @default(0)
totalXp Int @default(0)
```

### Ticket model additions
```prisma
// Add to existing Ticket:
channelId   String?
claimedById String?
claimedAt   DateTime?
closedById  String?
rating      Int?     // 1-5
subject     String?
```

---

## 4. Feature Domains

### 4.1 Moderation (Phase 2.5 fix)
Existing 5 commands — add real Discord API calls:
- `/ban` → `guild.members.ban(userId, { reason })`
- `/mute` → `member.timeout(durationMs, reason)`
- `/unban` → `guild.members.unban(userId)`
- `/unmute` → `member.timeout(null)`

Permission check order:
1. Guild owner → always allowed
2. `RoleMapping` table: check if user's Discord roles have required permission string
3. `PermissionOverride` table: explicit grant/deny per user

### 4.2 XP / Leveling (Phase 3)
**Formula:** `XP_needed(level) = 5 * level² + 50 * level + 100`

**Flow:**
1. `messageCreate` fires → check cooldown (in-memory Map per guild `<userId, timestamp>`)
2. If cooldown passed → grant `random(xpMin, xpMax) * multiplier` XP
3. Check level-up: while `xp >= XP_needed(level)` → `xp -= XP_needed(level)`, `level++`
4. On level-up → assign LevelRole if exists → send embed notification

**Commands:** `/rank`, `/leaderboard [page]`, `/xp give @user amount` (admin), `/xp set @user amount` (admin)

**XP multiplier priority:** role multiplier > channel multiplier > 1.0

### 4.3 Economy Extended (Phase 4)
**Cooldowns:** daily (24h), weekly (7d), work (1h), crime (2h), rob (4h)

**Gambling:**
- `/coinflip heads|tails amount` — 50/50
- `/slots amount` — 3-reel, 5 symbols, configurable payouts
- `/blackjack amount` — vs dealer, stand/hit buttons
- `/roulette amount red|black|number` — standard roulette

**Economy events:**
- `/daily` — `dailyAmount` from GuildSettings
- `/work` — random job, random amount (min/max configurable)
- `/crime` — higher reward, chance of fine
- `/rob @user` — steal % of balance, chance of backfire

**Shop:** `/shop`, `/buy <item>`, `/sell <item>`, `/inventory`

### 4.4 Ticket System (Phase 5)
**Flow:**
1. Admin runs `/ticket setup` in desired channel → bot posts stats embed, saves `ticketChannelId` + `ticketStatsMessageId` to GuildSettings
2. User sends message in ticket channel → `messageCreate`:
   - Delete user message
   - Create channel `ticket-username-N` in `ticketCategoryId`
   - Post claim embed in new channel (title, subject, user mention, claim button, close button)
   - Update stats embed (edit in-place)
3. Staff clicks **Claim** → embed updates "Claimed by @staff", stats update
4. Staff/admin clicks **Close** → ticket status = closed, prompt user for 1-5 star rating via buttons
5. User rates → `Ticket.rating` saved, log to `ticketLogChannelId`

**Stats embed fields:** Total | Pending | In Progress | Closed

**Commands:** `/ticket setup`, `/ticket close [reason]`, `/ticket add @user`, `/ticket remove @user`

### 4.5 Auto-Moderation (Phase 6)
Rules run on every `messageCreate` in order:

| Rule | Config fields | Default action |
|------|--------------|----------------|
| `spam` | threshold (msgs/5s) | mute 5min |
| `links` | whitelist domains[] | delete |
| `caps` | threshold % (0-100) | delete |
| `invites` | whitelist servers[] | delete + warn |
| `mentions` | max mentions per msg | mute 10min |
| `words` | patterns string[] | delete + warn |

Each rule has `action`: `"warn"` \| `"delete"` \| `"mute"` \| `"kick"` \| `"ban"` with optional `duration`.

### 4.6 Server Management (Phase 7)
**Logging events (configurable per-event in Dashboard):**
`ban` `unban` `mute` `unmute` `warn` `kick` `join` `leave` `messageEdit` `messageDelete` `channelCreate` `channelDelete`

**Welcome/Leave embed template variables:** `{username}` `{mention}` `{server}` `{memberCount}` `{date}`
Destination: specific channel OR DM to user (separate for welcome/leave).

**Reaction Roles:** `messageReactionAdd/Remove` → lookup `ReactionRole` → add/remove Discord role.
Setup: `/reactionrole add <message_link> <emoji> @role` or via Dashboard panel.

**Giveaways:**
- `/giveaway create prize:"..." duration:"1h" winners:1`
- Post embed with 🎉 reaction → users react to enter
- `messageReactionAdd` → add to `Giveaway.participants`, edit embed with participant count
- Worker job at `endsAt` → pick random winners, update embed, announce with mentions
- `/giveaway end <id>`, `/giveaway reroll <id>`

**Starboard** (disabled by default):
- `messageReactionAdd` with ⭐ → count stars on original message
- If stars ≥ threshold AND no existing StarboardEntry → post to starboard channel, save entry
- If stars change → edit starboard message (update count)
- If stars drop below threshold → delete starboard message, remove entry

### 4.7 Family / Clan (Phase 8)
Social structure — no bank, no quests, no bonuses.

**Data:** name, leaderId, members (from GuildMember), createdAt
**Family XP** = sum of `Profile.totalXp` of all members (computed, not stored)

**Commands:** `/family create <name>`, `/family info [name]`, `/family join <name>`, `/family leave`, `/family invite @user`, `/family kick @user`, `/family top`

Family top embed: sorted by sum member XP, paginated.

### 4.8 Achievements (Phase 11)
Predefined set (20+), checked at key events:

| Key | Trigger | Emoji |
|-----|---------|-------|
| `first_message` | first XP grant | 💬 |
| `level_5` | reach level 5 | ⭐ |
| `level_10` | reach level 10 | 🌟 |
| `level_25` | reach level 25 | 💫 |
| `level_50` | reach level 50 | 🏆 |
| `first_daily` | claim first daily | 📅 |
| `daily_7` | 7-day daily streak | 🔥 |
| `balance_1000` | reach 1000 balance | 💰 |
| `balance_10000` | reach 10000 balance | 💎 |
| `first_ticket` | open first ticket | 🎫 |
| `first_family` | join a family | 👨‍👩‍👧 |
| `gambler` | first gambling game | 🎰 |
| `winner` | win a giveaway | 🎉 |

`AchievementService.check(guildId, userId, trigger)` — called from all relevant services.

---

## 5. Dashboard

### Phase 9 — Admin Dashboard
Tech: Next.js 14 (App Router), Discord OAuth2, Tailwind CSS.

**Pages per domain:**
- `/dashboard/[guildId]/settings` — general, locale, colors
- `/dashboard/[guildId]/moderation` — role permissions, cases list
- `/dashboard/[guildId]/leveling` — XP config, level roles, multipliers, no-XP lists
- `/dashboard/[guildId]/economy` — currency config, shop management
- `/dashboard/[guildId]/tickets` — ticket config (category, channels)
- `/dashboard/[guildId]/automod` — per-rule enable/disable/config
- `/dashboard/[guildId]/logging` — per-event channel assignment
- `/dashboard/[guildId]/welcome` — embed builder, destination
- `/dashboard/[guildId]/roles` — reaction roles panels
- `/dashboard/[guildId]/giveaways` — active giveaways
- `/dashboard/[guildId]/starboard` — enable/threshold/channel
- `/dashboard/[guildId]/family` — family leaderboard (read-only)

### Phase 10 — User Dashboard
Public profile pages (no admin):

- `/u/[guildId]/[userId]` — rank card, level, XP bar, balance, achievements showcase
- `/dashboard/[guildId]/leaderboard` — XP leaderboard (paginated)
- `/dashboard/[guildId]/economy/top` — balance leaderboard

---

## 6. Music (Phase 13 — Stub Only)

Add to `packages/contracts/src/services/IMusicService.ts`:
- Interface: `play()`, `skip()`, `stop()`, `getQueue()`, `setVolume()`

Add `@discordjs/voice` to `apps/bot/package.json` (installed, unused).

Placeholder command `/music` → embed "Music coming soon 🎵".

Full implementation deferred: requires copyright-safe streaming source, separate infrastructure.

---

## 7. Rate Limiting Strategy

Per-user per-command cooldowns (in-memory, reset on bot restart):
- Moderation commands: no per-user cooldown (staff use)
- `/daily`, `/work`, `/crime`, `/rob`: persisted in DB (`DailyStreak` or cooldown field)
- Gambling: 5s between rolls (in-memory)
- XP: per-guild per-user Map (GuildSettings.xpCooldown seconds)
- General commands: 3s global per user (in-memory)

---

## 8. i18n Strategy (Phase 12)

- Detect from `interaction.guildLocale` or `GuildSettings.locale`
- String files: `apps/bot/src/i18n/en.json`, `apps/bot/src/i18n/ru.json`
- Helper: `t(key, locale, vars?)` — no external library, simple lookup
- Supported locales: `en`, `ru`

---

## 9. Phase Summary

| Phase | Focus | Key deliverable |
|-------|-------|----------------|
| 2.5 | Foundation fixes | Schema migration, real Discord API, RoleMapping permissions |
| 3 | XP/Levels | messageCreate XP, rank/leaderboard commands, Dashboard page |
| 4 | Economy extended | Gambling, shop, inventory, Daily/work/crime commands |
| 5 | Tickets full | Auto-channel, buttons, stats embed, Dashboard page |
| 6 | Auto-moderation | 6 rule types, Dashboard per-rule config |
| 7 | Server management | Logging, Welcome/Leave, Reaction roles, Giveaways, Starboard |
| 8 | Family/Clan | Commands, XP-based leaderboard |
| 9 | Admin Dashboard | Next.js, OAuth2, all settings pages |
| 10 | User Dashboard | Rank card, leaderboards, achievements |
| 11 | Achievements | 20+ types, AchievementService, user display |
| 12 | Polish | i18n EN+RU, rate limiting, performance |
| 13 | Music stub | Interface, dep, placeholder command |
