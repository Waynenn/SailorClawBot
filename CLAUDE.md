# SailorClawBot

All-in-one Discord bot для массового использования на разных серверах.

## Структура монорепо

Рабочий корень: `D:\Code\SailorClawBot\` (Turbo monorepo с pnpm workspaces)

```
D:\Code\SailorClawBot\
├── packages/
│   ├── contracts/    (@sailorclawbot/contracts) — DTOs, интерфейсы, события, типы
│   ├── core/         (@sailorclawbot/core)      — бизнес-логика, сервисы, EventBus
│   └── database/     (@sailorclawbot/database)   — Prisma + репозитории
├── apps/
│   ├── bot/          — Discord.js v14 (slash commands, embeds, buttons)
│   ├── worker/       — очереди, задачи (placeholder)
│   └── dashboard/    — UI администратора (placeholder)
├── docs/             — архитектурная документация
│   └── superpowers/specs/2026-06-14-bot-design.md — полный дизайн бота
├── infrastructure/   — docker-compose, deploy-конфиги
└── scripts/          — run-prisma.mjs и др.
```

**Зависимость пакетов (строгий порядок):**
```
contracts → core → database → bot → worker → dashboard
```
Нарушать порядок и создавать циклы — запрещено.

## Текущий статус (2026-06-14)

| Phase | Статус | Детали |
|-------|--------|--------|
| 0 | ✅ Done | Монорепо, Prisma, Docker, docs |
| 1 | ✅ Done | 12 репо + 7 сервисов, 58 тестов |
| 2 | ✅ Done | 10 slash команд, DI container |
| 2.5 | ✅ Done | Mega-migration, RoleMapping, Discord API calls, /kick /cases, EmbedBuilder |
| 3 | 🔜 NEXT | XP/Leveling — XpService, /rank, /leaderboard, messageCreate |
| 4–13 | ⏳ | Economy ext, Tickets, AutoMod, ServerMgmt, Family, Dashboard, Achievements, i18n, Music |

**Тесты:** 58 pass (node --test, packages/core)  
**Build:** pnpm build — 0 ошибок

## Ключевые файлы

| Путь | Назначение |
|------|-----------|
| `packages/contracts/src/repositories/` | Интерфейсы репо: Guild, Profile, Wallet, Transaction, Family, Ticket, RoleMapping, Warning, Mute, Ban, Case, Permission |
| `packages/contracts/src/types/index.ts` | SnowflakeId, все DTO |
| `packages/contracts/src/events/EventNames.ts` | Enum событий (включает moderation.kicked) |
| `packages/core/src/services/` | GuildService, ProfileService, ModerationService, EconomyService, TicketService, FamilyService, PermissionService |
| `packages/database/prisma/schema.prisma` | Полная Prisma-схема (все модели Phase 0–2.5) |
| `packages/database/src/repositories/` | 13 реализаций репозиториев |
| `apps/bot/src/container.ts` | DI-контейнер (все репо + сервисы) |
| `apps/bot/src/main.ts` | Точка входа, ALL_COMMANDS, intents |
| `apps/bot/src/commands/moderation/` | warn, mute, unmute, ban, unban, kick, cases |
| `apps/bot/src/commands/economy/` | balance, transfer |
| `apps/bot/src/commands/profile/` | profile |
| `apps/bot/src/lib/embedColors.ts` | Цвета embed: punitive/restorative/info/economy/xp/tickets/family |
| `apps/bot/src/middleware/errorHandler.ts` | Маппинг ошибок домена → embed |
| `docs/REFINED_ROADMAP.md` | Детальный roadmap Phase 0–13 |
| `docs/superpowers/specs/2026-06-14-bot-design.md` | Полный дизайн-спек (все домены) |

## БД-модели (Prisma / PostgreSQL)

**Core:**
- `Guild` — Discord-сервер
- `GuildMember` — участник (PK: guildId+userId)
- `Profile` — профиль + XP/level/totalXp
- `Wallet` — BigInt balance + cooldown поля + activeBoosts
- `Transaction` — транзакция кошелька

**Settings & Permissions:**
- `GuildSettings` — все настройки гильдии (tickets, welcome, XP, economy, starboard, logging, colors)
- `PermissionOverride` — per-user overrides
- `RoleMapping` — Discord role → permission string (can_warn/can_mute/can_ban/can_kick/can_manage_tickets/can_manage_guild)

**Leveling:**
- `LevelRole` — Discord роль за уровень
- `XpMultiplier` — множитель XP для канала/роли
- `NoXpTarget` — канал/роль без XP

**Economy:**
- `Item` — товар магазина (BigInt price)
- `InventoryItem` — инвентарь пользователя

**Family:**
- `Family`, `FamilyMember` (FamilyRole: OWNER/OFFICER/MEMBER)

**Moderation:**
- `Warning`, `Mute`, `Ban`, `Case`, `GuildCaseCounter`

**Tickets:**
- `Ticket` (TicketStatus: open/claimed/closed)

**Server Management:**
- `AutoModRule`, `ReactionRole`, `Giveaway`, `StarboardEntry`

**Achievements:**
- `Achievement`, `UserAchievement`

## Архитектурные паттерны

- Repository pattern: интерфейсы в `contracts`, реализации в `database`
- Сервисы в `core` — только через интерфейсы, без Prisma
- Permissions: guild owner → RoleMapping (Discord roles) → PermissionOverride (per-user)
- EventBus для доменных событий
- EmbedBuilder + кнопки для всех ответов бота
- SnowflakeId = `string`, BigInt для всех денежных значений
- Все разрешения проверяются на уровне bot-команд (не в сервисах)
- Цвета embed: `EMBED_COLORS` из `apps/bot/src/lib/embedColors.ts`

## XP формула (Phase 3)

```
XP_needed(level) = 5 * level² + 50 * level + 100
```

## Команды

```bash
# Из SailorClawBot/ (turbo)
pnpm build        # собрать все пакеты
pnpm test         # запустить тесты (node --test)
pnpm dev          # запустить в dev-режиме
pnpm lint         # biome lint

# Prisma
cd packages/database
pnpm prisma migrate dev
pnpm prisma generate
```

## Переменные окружения

- `.env` — не трогать, не коммитить
- `DATABASE_URL` — PostgreSQL connection string
- `DISCORD_TOKEN` — токен бота
- `DISCORD_CLIENT_ID` — ID приложения (для регистрации команд)

## Стиль кода

- TypeScript strict mode
- Biome для lint/format (не ESLint/Prettier)
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- PascalCase для классов/интерфейсов, camelCase для утилит
- Тесты: node --test, AAA паттерн, in-memory моки через интерфейсы
- Минимум комментариев — только неочевидное WHY
