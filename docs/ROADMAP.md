# Roadmap

## Phase 0: Foundation

**Status: ✅ COMPLETE** (validated 2026-06-13)

- ✅ Reconstruct monorepo root files (pnpm workspaces, Turbo, tsconfig.base.json, biome.json)
- ✅ Add architecture documentation
- ✅ Add package boundaries for contracts, core, database, bot, worker, dashboard
- ✅ Add Prisma foundation (schema with Guild, Profile, Wallet, Transaction, Family, Ticket)
- ✅ Add Docker/Postgres foundation
- ✅ Validate: pnpm install, pnpm build, prisma validate, prisma generate

## Phase 1: Contracts + Core + Repositories

**Status: 🔄 READY TO START** (target: 2026-06-27)

Source files are prepared in `docs/` — copy and implement, don't write from scratch.

- [ ] Expand DTOs (`docs/00-contracts-types-extended.ts` → `packages/contracts/src/types/extended.ts`)
- [ ] Add extended repository interfaces (`docs/01-contracts-repositories-extended.ts`)
- [ ] Replace EventNames with full catalog (`docs/02-events-eventnames.ts`)
- [ ] Expand Prisma schema (add Moderation, Economy, Logging, Config models)
- [ ] Create initial migration (`pnpm prisma migrate dev --name initial_schema`)
- [ ] Implement 11 repositories (pattern: `docs/03-WarningRepositoryImpl.ts`)
- [ ] Implement 6 core services (pattern: `docs/04-ModerationService.ts`)
- [ ] Setup Jest + write tests (80%+ coverage target)
- [ ] Setup domain error hierarchy

## Phase 2: Bot Integration

**Status: ⏳ PENDING**

- Add Discord.js v14
- Wire slash commands to core services
- No business logic in bot layer
- Add error handling middleware

## Phase 3: Worker

**Status: ⏳ PENDING**

- Add Bull/BullMQ queue infrastructure
- Add jobs, retry policies, DLQ
- Add Redis

## Phase 4: Performance

**Status: ⏳ PENDING**

- Define database indexes
- Add connection pooling
- Redis caching (leaderboard, guild config, permissions)
- Query monitoring

## Phase 5: Dashboard

**Status: ⏳ PENDING**

- Administration UI
- API integration
- Discord OAuth2 auth

## Phase 6: Observability

**Status: ⏳ PENDING**

- Winston structured logging
- Prometheus metrics
- OpenTelemetry tracing
- Alerting rules

## Phase 7: Sharding

**Status: ⏳ PENDING**

- Discord.js ShardingManager (needed at 2500+ guilds)
- Shard communication via Redis
- For 100K guilds: 40+ bot instances

## Phase 8: Production Hardening

**Status: ⏳ PENDING**

- Database backups
- Disaster recovery
- Load testing
- Security audit

## Localization

The bot is built **i18n-first** (6 launch languages: en, ru, uk, es, de, fr).
GitHub docs are maintained in English + Russian. See [`docs/I18N.md`](./I18N.md).

## Non-Negotiables (all phases)

- No cyclic dependencies (contracts → core → database → bot → worker → dashboard)
- Business logic only in `core` package
- No user-facing strings hardcoded in services — i18n-first (services return codes/data)
- All DTOs validated with zod before Phase 2
- 80%+ test coverage for any new code
- Conventional commits
- GitHub docs maintained in English + Russian
