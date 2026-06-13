# Architecture

SailorClawBot is a TypeScript monorepo for a modular Discord ecosystem.

## Dependency Model

The mandatory dependency flow is:

```text
contracts → core → database → bot → worker → dashboard
```

Rules:

- `contracts` owns DTOs, shared types, event names, and repository interfaces.
- `core` owns business logic, domain errors, application services, event bus contracts, and logger contracts.
- `database` owns Prisma, migrations, seeds, and repository implementations.
- `bot` owns Discord integration only. No business logic.
- `worker` owns queues, jobs, retry policies, and DLQ handling.
- `dashboard` owns administration UI and API integration.

No cyclic dependencies are allowed. Lower layers must not import from higher layers.

## Current Shape (2026-06-13)

### packages/ — shared libraries

| Package | Path | Status | Notes |
|---------|------|--------|-------|
| `@sailorclawbot/contracts` | `packages/contracts/` | ✅ Built | Needs Phase 1 expansion (extended types, repos, events) |
| `@sailorclawbot/core` | `packages/core/` | ⚠️ Partial | Only `ProfileService` implemented |
| `@sailorclawbot/database` | `packages/database/` | ⚠️ Partial | Prisma schema OK, no repository implementations |

### apps/ — application entrypoints

| App | Path | Status |
|-----|------|--------|
| bot | `apps/bot/` | ❌ Placeholder (console.log only) |
| worker | `apps/worker/` | ❌ Placeholder |
| dashboard | `apps/dashboard/` | ❌ Placeholder |

### docs/ — preparation materials for Phase 1

| File | Purpose |
|------|---------|
| `docs/00-contracts-types-extended.ts` | Extended DTOs → copy to `packages/contracts/src/types/extended.ts` |
| `docs/01-contracts-repositories-extended.ts` | 13 repo interfaces → copy to `packages/contracts/src/repositories/extended.ts` |
| `docs/02-events-eventnames.ts` | Full event catalog → replace `packages/contracts/src/events/EventNames.ts` |
| `docs/03-WarningRepositoryImpl.ts` | Repository implementation pattern |
| `docs/04-ModerationService.ts` | Service implementation pattern |

## Key Design Decisions

### Repository Pattern

All data access goes through interfaces defined in `@sailorclawbot/contracts`. Business logic in `core` depends only on these interfaces — never on Prisma directly. Prisma implementations live exclusively in `database`.

### SnowflakeId

Discord IDs are `string`, aliased as `SnowflakeId` in contracts. Do not use `number` or `bigint` for Discord IDs.

### EventBus

`core` defines `EventBus` as an abstract contract. Concrete implementations (in-process, Redis pub/sub) are wired at the app layer (bot/worker).

### Error Hierarchy

`DomainError` base class is in `core`. Service-specific errors extend it. Never throw generic `Error` from services — use typed domain errors.

## Planned Extensions (Phase 1)

Prisma schema needs expansion with:
- Moderation: Warning, Mute, Ban, Case
- Economy: DailyStreak, RoleReward
- Logging: AuditLog, ErrorLog, RateLimitLog
- Config: GuildSettings, RoleMapping, PermissionOverride

## Archive Note

`SailorClawBot/` directory at the repo root is an imported archive copy with the same structure. It is NOT the working monorepo. All development happens at the repo root.
