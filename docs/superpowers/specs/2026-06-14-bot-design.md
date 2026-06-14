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

  // Economy (BigInt for all monetary values)
  currencyName            String  @default("coins")
  currencyEmoji           String  @default("🪙")
  dailyAmount             BigInt  @default(100)
  startingBalance         BigInt  @default(0)
  workMin                 BigInt  @default(50)
  workMax                 BigInt  @default(200)
  crimeMin                BigInt  @default(100)
  crimeMax                BigInt  @default(500)
  gamblingMinBet          BigInt  @default(10)
  gamblingMaxBet          BigInt  @default(10000)
  robMinTargetBalance     BigInt  @default(100)
  treasuryBalance         BigInt  @default(0)   // accumulated transfer taxes
  transferTaxPercent      Int     @default(5)    // % — Int OK (0-100 range)
  shopTaxPercent          Int     @default(0)
  // Anti-inflation limits
  dailyWorkLimit          Int     @default(3)    // max work uses per day
  dailyCrimeLimit         Int     @default(2)    // max crime uses per day
  workDiminishingFactor   Float   @default(0.5)  // each next work = prev * factor
  crimeDiminishingFactor  Float   @default(0.5)
  // Family economy
  familyCreationCost      BigInt  @default(5000)
  familyNameChangeCost    BigInt  @default(2000)
  // Family limits (anti-overflow)
  familyCreationEnabled   Boolean @default(true)
  maxFamilies             Int?               // null = unlimited
  maxFamilyMembers        Int     @default(20)
  familyRequireApproval   Boolean @default(false) // invite must be accepted
  familyCreationMode      String  @default("coins") // "coins"|"item"|"both"
}

// NOTE: Guild model needs back-relation added:
// settings GuildSettings?

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

// FamilyMember — bot-level roles only, NO Discord roles created
model FamilyMember {
  id       String     @id @default(cuid())
  guildId  String
  familyId String
  userId   String
  role     FamilyRole @default(MEMBER)
  joinedAt DateTime   @default(now())
  family   Family     @relation(fields: [familyId], references: [id], onDelete: Cascade)
  @@unique([guildId, userId]) // one family per user per guild
  @@index([familyId])
}

enum FamilyRole {
  OWNER    // creator, full control
  OFFICER  // can invite/kick members
  MEMBER   // regular
}

// NOTE: Family model needs: members FamilyMember[], ownerId String

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

### Wallet model additions (economy cooldowns + daily limits)
```prisma
// Add to existing Wallet:
lastDailyAt      DateTime?
lastWorkAt       DateTime?
lastCrimeAt      DateTime?
lastRobAt        DateTime?
workUsesToday    Int       @default(0)   // resets lazily at midnight UTC
crimeUsesToday   Int       @default(0)
dailyLimitReset  DateTime?              // date of last reset (lazy reset)
activeBoosts     Json      @default("[]") // [{type, multiplier, expiresAt}]
```

---

## 4. Feature Domains

### 4.1 Moderation (Phase 2.5 fix)
Existing commands — add real Discord API calls:
- `/ban` → `guild.members.ban(userId, { reason })`
- `/mute` → `member.timeout(durationMs, reason)` (Discord max: 2419200000ms = 28 days)
- `/unban` → `guild.members.unban(userId)`
- `/unmute` → `member.timeout(null)`
- `/kick` → `member.kick(reason)` **[NEW — was missing from Phase 2]**
- `/cases [@user]` → list moderation history **[NEW — was missing from Phase 2]**

**Discord privileged intents required (enable in Developer Portal):**
- `GUILD_MEMBERS` — needed for member fetching, join/leave events
- `MESSAGE_CONTENT` — needed for XP, auto-mod, ticket messageCreate handler

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

#### BigInt usage
All monetary values stored and passed as `BigInt`. Never use `number` for balances, bets, prices, or amounts. Prisma already uses `BigInt` for `Wallet.balance` and `Transaction.amount`.

Additional schema fields that must be `BigInt`:
```prisma
// GuildSettings — change from Int to BigInt:
dailyAmount      BigInt @default(100)
startingBalance  BigInt @default(0)
workMin          BigInt @default(50)
workMax          BigInt @default(200)
crimeMin         BigInt @default(100)
crimeMax         BigInt @default(500)
gamblingMinBet   BigInt @default(10)
gamblingMaxBet   BigInt @default(10000)

// Item — already BigInt:
price  BigInt  // ✅
```

#### Anti-cheat rules (enforced in EconomyService, all atomic via prisma.$transaction)

| Rule | Implementation |
|------|---------------|
| Positive amounts only | `if (amount <= 0n) throw ValidationError` |
| No self-transfer | `if (fromId === toId) throw ValidationError` |
| Sufficient funds check | Atomic DB-level: debit fails if `balance < amount` |
| No negative balance | Balance never goes below `0n` — service throws `ValidationError('Insufficient funds')` |
| Bet within bounds | `if (amount < gamblingMinBet \|\| amount > gamblingMaxBet) throw ValidationError` |
| Rob minimum target balance | Target must have `> robMinBalance` (default 100 coins) |
| All writes atomic | Every balance change wrapped in `prisma.$transaction([...])` |

#### Tax system (configurable in Dashboard)

```
transferTaxPercent: Int @default(5)   // % taken from transfer amount
shopTaxPercent:     Int @default(0)   // % added to shop purchases
```

Transfer flow:
```
sender pays:    amount (full)
receiver gets:  amount - floor(amount * taxRate / 100n)
tax goes to:    guild treasury (GuildSettings.treasuryBalance BigInt, optional display)
```

No tax on: daily, work, gambling winnings, XP rewards.

#### Anti-inflation system

**Problem:** hourly cooldown alone allows 24 work uses/day = up to 4800 coins. After 30 days = ~300K. Economy inflates.

**Solution: daily use limits + diminishing returns**

```
Work uses per day:    max dailyWorkLimit (default 3)
Crime uses per day:   max dailyCrimeLimit (default 2)
Diminishing returns:  each use earns prev_reward * diminishingFactor (default 0.5)
```

Example with defaults:
```
Work 1: 50-200 coins  (100% payout)
Work 2: 25-100 coins  (50%)
Work 3: 12-50 coins   (25%)
Daily total work max: ~350 coins

Crime 1: 100-500 coins (100%)
Crime 2: 50-250 coins  (50%)
Daily total crime max: ~750 coins

Daily:   100 coins
Gambling: net negative (house edge drains ~5-10%)
Rob:      zero-sum (no new money created)

MAX income per day (perfect play): ~1200 coins
```

Daily counter reset: **lazy reset** — on each work/crime call, check if `dailyLimitReset` date < today UTC → reset counts to 0 first.

**Money sinks (where money leaves economy):**
| Sink | Drain rate |
|------|-----------|
| Transfer tax (5%) | Every transfer |
| Gambling house edge | ~5-10% of bet per game |
| Shop purchases (roles, badges, boosts) | Configurable prices |
| Family creation | 5000 coins one-time |
| Family name change | 2000 coins |
| Consumable items expire | Repurchase needed |
| Profile cosmetics | 200-2000 coins |

#### Cooldowns (persisted in Wallet model)
| Action | Field | Duration | Daily limit |
|--------|-------|----------|-------------|
| `/daily` | `lastDailyAt` | 24h | 1 |
| `/work` | `lastWorkAt` | 1h | `dailyWorkLimit` (default 3) |
| `/crime` | `lastCrimeAt` | 2h | `dailyCrimeLimit` (default 2) |
| `/rob @user` | `lastRobAt` | 4h | unlimited (zero-sum) |

#### Economy events
- `/daily` → grant `dailyAmount`. Shows time remaining if on cooldown.
- `/work` → payout = `random(workMin, workMax) * diminishFactor^(useIndex)`. Random job title. Shows uses remaining today.
- `/crime` → 65% success: `random(crimeMin, crimeMax) * diminishFactor^(useIndex)`. 35% fail: fine = `floor(reward * 0.5n)`. Shows uses remaining.
- `/rob @user` → 40% success: steal `random(10n, 30n) * target.balance / 100n`. 60% fail: fine = 20% of intended amount. Zero-sum (no new money).

#### Shop item types

```typescript
type ItemType =
  | 'role'         // assign Discord role on purchase
  | 'badge'        // profile badge emoji/icon shown on /rank
  | 'frame'        // rank card border frame
  | 'background'   // rank card background image/color
  | 'xp_boost'     // temporary XP multiplier (stored in Wallet.activeBoosts)
  | 'color'        // username color in rank card
  | 'family_slot'  // grants ability to create a family (checks on /family create)
  | 'name_change'  // grants one display name change (profile or family)
  | 'consumable'   // admin-defined one-time use
```

**Effect JSON per type:**
```json
{ "type": "role",        "effect": { "roleId": "123456789" } }
{ "type": "badge",       "effect": { "emoji": "🌟" } }
{ "type": "frame",       "effect": { "frameKey": "gold" } }
{ "type": "background",  "effect": { "backgroundKey": "space" } }
{ "type": "xp_boost",    "effect": { "multiplier": 2.0, "durationHours": 1 } }
{ "type": "family_slot", "effect": {} }
{ "type": "name_change", "effect": { "target": "profile" } }
```

**Family economy integration:**
- `/family create` → requires `family_slot` item in inventory OR costs `familyCreationCost` coins directly (admin configures which)
- `/family rename` → costs `familyNameChangeCost` coins
- Both configurable in Dashboard

**Commands:** `/daily`, `/work`, `/crime`, `/rob @user`, `/coinflip heads|tails <amount>`, `/slots <amount>`, `/blackjack <amount>` (Hit/Stand/Double buttons), `/roulette <red|black|0-36> <amount>`, `/shop [page]`, `/buy <item>`, `/sell <item>`, `/inventory`

#### Gambling (house edge = passive money sink)
| Game | House edge | Notes |
|------|-----------|-------|
| `/coinflip` | ~2% | Win pays 0.98x. Tiny sink to prevent 50/50 grinding. |
| `/slots` | ~10% | Payout table sums to 90% expected return. |
| `/blackjack` | ~3% | Standard rules (dealer hits on 16, stands on 17). |
| `/roulette` | ~5% | 19 red/black, 1 zero (house). Number pays 18x. |

House edge money does NOT go to treasury — it is burned (removed from economy). This is deflationary.

All gambling amounts: BigInt. Winnings calculated as BigInt multiplication then division. No float arithmetic.

#### Shop
- Buy: atomic check `balance >= price` → debit `price * (1 + shopTaxPercent/100)` → create InventoryItem
- Sell: credit `floor(price * 0.5n)` (50% resale value, configurable)
- Role items: on buy → assign Discord role via bot. On sell → remove role.

**Commands:** `/daily`, `/work`, `/crime`, `/rob @user`, `/coinflip heads|tails <amount>`, `/slots <amount>`, `/blackjack <amount>` (Hit/Stand/Double buttons), `/roulette <red|black|0-36> <amount>`, `/shop [page]`, `/buy <item>`, `/sell <item>`, `/inventory`

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

**Ticket channel permissions:** on channel create, grant VIEW_CHANNEL + SEND_MESSAGES to: ticket author, roles with `can_manage_tickets` in `RoleMapping`, bot itself. Deny VIEW_CHANNEL to `@everyone`.

**Stats embed rate limiting:** debounce edits — flush max once per 2 seconds. Prevents Discord 5-edits/5s limit during burst opens.

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
- Skip if reactor = message author (no self-starring)
- If stars ≥ threshold AND no existing StarboardEntry → post to starboard channel, save entry
- If stars change → edit starboard message (update count)
- If stars drop below threshold → delete starboard message, remove entry

### 4.7 Family / Clan (Phase 8)
Social only — no bank, no quests, no bonuses. **No Discord roles created.**

#### Member roles (bot-level only, stored in `FamilyMember.role`)
| Role | Permissions |
|------|------------|
| `OWNER` | Disband, rename, promote, demote, transfer ownership, invite, kick all |
| `OFFICER` | Invite members, kick MEMBERs only |
| `MEMBER` | View info, leave |

One user = one family per guild (`@@unique([guildId, userId])` on `FamilyMember`).

#### Creation controls (Dashboard-configurable)
| Setting | Default | Purpose |
|---------|---------|---------|
| `familyCreationEnabled` | `true` | Master toggle |
| `maxFamilies` | `null` (unlimited) | Hard cap per server |
| `maxFamilyMembers` | `20` | Cap per family |
| `familyCreationMode` | `"coins"` | `"coins"` / `"item"` / `"both"` |
| `familyCreationCost` | `5000` | Coin cost |
| `familyRequireApproval` | `false` | Invites need explicit accept |

#### FamilyService methods
- `createFamily(guildId, ownerId, name)` — validate limits + charge/consume, create, add OWNER
- `disbandFamily(guildId, familyId, requesterId)` — OWNER only
- `inviteMember(guildId, familyId, targetId, inviterId)` — OWNER/OFFICER, check maxMembers
- `acceptInvite(guildId, familyId, userId)` — if requireApproval
- `kickMember(guildId, familyId, targetId, kickerId)` — OWNER kicks all; OFFICER kicks MEMBER only
- `promoteMember(guildId, familyId, targetId, promoterId)` — OWNER only (MEMBER→OFFICER)
- `demoteMember(guildId, familyId, targetId, demoterId)` — OWNER only (OFFICER→MEMBER)
- `transferOwnership(guildId, familyId, newOwnerId, currentOwnerId)` — old OWNER→OFFICER
- `renameFamily(guildId, familyId, newName, requesterId)` — OWNER only, costs `familyNameChangeCost`
- `leaveFamily(guildId, userId)` — OWNER must transfer or disband first
- `getFamilyLeaderboard(guildId)` — JOIN Profile, SUM totalXp GROUP BY family (cache 5min)

#### Commands
`/family create <name>`, `/family disband`, `/family info [name]`, `/family join <name>`, `/family leave`, `/family invite @user`, `/family kick @user`, `/family promote @user`, `/family demote @user`, `/family transfer @user`, `/family rename <name>`, `/family top`

Family info embed: name, owner, officer list, member count/max, total XP, rank on server.
Family top embed: top 10 families by total member XP, paginated, color `0x9b59b6`.

**Performance:** leaderboard = grouped JOIN over Profile. Cache 5min in-memory per guild. Invalidate on member XP change.

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
