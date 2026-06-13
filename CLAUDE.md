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
│   ├── bot/          — Discord.js интеграция (placeholder: console.log only)
│   ├── worker/       — очереди, задачи, DLQ (placeholder)
│   └── dashboard/    — UI администратора (placeholder)
├── docs/             — архитектурная документация
├── infrastructure/   — docker-compose, deploy-конфиги
└── scripts/          — run-prisma.mjs и др.
```

**Зависимость пакетов (строгий порядок):**
```
contracts → core → database → bot → worker → dashboard
```
Нарушать порядок и создавать циклы — запрещено.

## Ключевые файлы

| Путь | Назначение |
|------|-----------|
| `packages/contracts/src/repositories/` | Интерфейсы репозиториев (Guild, Profile, Wallet, Transaction, Family, Ticket) |
| `packages/contracts/src/types/index.ts` | Общие типы (SnowflakeId, ProfileDto и др.) |
| `packages/contracts/src/events/EventNames.ts` | Enum событий |
| `packages/core/src/services/ProfileService.ts` | Единственный реализованный сервис |
| `packages/database/prisma/schema.prisma` | Prisma-схема (Guild, GuildMember, Profile, Wallet, Transaction, Family, Ticket) |
| `packages/database/src/client.ts` | Prisma-клиент singleton |
| `docs/PHASE_1_IMPLEMENTATION_GUIDE.md` | Детальный план Phase 1 (что делать, в каком порядке) |
| `docs/MASTER_AUDIT_REPORT.md` | Аудит проекта (статусы, риски, что нужно сделать) |
| `docs/TIER1_TECHNICAL_STRATEGY.md` | Архитектурная стратегия для 100K серверов |
| `docs/00-contracts-types-extended.ts` | Расширенные DTOs готовые к копированию в `packages/contracts/src/types/extended.ts` |
| `docs/01-contracts-repositories-extended.ts` | 13 интерфейсов репозиториев готовых к добавлению в contracts |
| `docs/03-WarningRepositoryImpl.ts` | Эталонная реализация репозитория (паттерн для Phase 1) |
| `docs/04-ModerationService.ts` | Эталонная реализация сервиса (паттерн для Phase 1) |

## Текущий статус (2026-06-13)

- **Phase 0** ✅ Complete — монорепо, Prisma, Docker, docs
- **Phase 1** 🔄 Ready to start — расширение contracts + репозитории + сервисы + тесты
- **Тесты** ❌ Нет ни одного
- **apps/bot, worker, dashboard** ❌ Только placeholder

## БД-модели (Prisma / PostgreSQL)

- **Guild** — Discord-сервер
- **GuildMember** — участник сервера (PK: guildId + userId)
- **Profile** — профиль участника на сервере (unique: guildId + userId)
- **Wallet** — кошелёк (BigInt balance), связан с транзакциями
- **Transaction** — транзакция кошелька
- **Family** — клан/семья на сервере (unique: guildId + name)
- **Ticket** — тикет поддержки (enum status: open/closed)

## Архитектурные паттерны

- Repository pattern через интерфейсы в `contracts`
- Доменные сервисы в `core` работают только через интерфейсы, без Prisma напрямую
- EventBus для событий между сервисами
- SnowflakeId = `string` (Discord IDs)

## Команды

```bash
# Из SailorClawBot/ (turbo)
pnpm build        # собрать все пакеты
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

## Стиль кода

- TypeScript strict mode
- Biome для lint/format (не ESLint/Prettier)
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Именование файлов: PascalCase для классов/интерфейсов, camelCase для утилит
