# Project State

Last updated: 2026-06-13

## Current Phase

**Phase 1: Contracts + Core + Database** — ready to implement.

Phase 0 (foundation) is complete and validated.

## Phase 0 Summary (Complete)

### Completed Work

- Monorepo root files reconstructed (pnpm workspaces, Turbo, tsconfig.base.json, biome.json)
- Package boundaries established: contracts, core, database, bot, worker, dashboard
- Prisma schema created with core entities (Guild, GuildMember, Profile, Wallet, Transaction, Family, Ticket)
- Docker/Postgres foundation added
- Architecture and dependency documentation written
- Master Audit Report completed

### Validated

- `pnpm install` ✅
- `pnpm build` ✅ (all 6 packages)
- `pnpm prisma validate` ✅
- `pnpm prisma generate` ✅

### Notes

- `pnpm install` initially failed because pnpm 11 blocked Prisma build scripts — Prisma packages were approved manually.
- `pnpm prisma generate` initially failed because Prisma CLI and client were in different package boundaries — prisma was added to packages/database and generation now passes.

## Phase 1 Plan

### Deliverables

1. Expand Prisma schema — add Moderation, Economy, Logging, Config models
2. Implement all repository interfaces (11 repositories using `docs/03-WarningRepositoryImpl.ts` as pattern)
3. Implement all core services (6 services using `docs/04-ModerationService.ts` as pattern)
4. Setup domain error hierarchy
5. Setup Jest + integration tests (80%+ coverage target)

### Source files ready in docs/

- `docs/00-contracts-types-extended.ts` → `packages/contracts/src/types/extended.ts`
- `docs/01-contracts-repositories-extended.ts` → `packages/contracts/src/repositories/extended.ts`
- `docs/02-events-eventnames.ts` → `packages/contracts/src/events/EventNames.ts` (replace)
- `docs/03-WarningRepositoryImpl.ts` → study pattern, implement all repos
- `docs/04-ModerationService.ts` → study pattern, implement all services

### Order of work

1. Copy extended types + repositories + EventNames to contracts
2. Verify `pnpm build`
3. Expand Prisma schema, run migration
4. Implement 11 repositories (follow `03-WarningRepositoryImpl.ts`)
5. Implement 6 services (follow `04-ModerationService.ts`)
6. Write tests alongside each implementation

## Phase 1 Progress

### Moderation slice — COMPLETE (reference pattern), 2026-06-13

End-to-end at data + domain layer. Becomes the template for all other domains.

- contracts: `types/moderation.ts` (Warning/Mute/Ban/Case/PermissionOverride DTOs); repository interfaces (WarningRepository, MuteRepository, BanRepository, CaseRepository, PermissionRepository); expanded `EventNames` catalog (36 events).
- core: error hierarchy (ValidationError, NotFoundError, PermissionDeniedError, ConflictError); `ModerationService` (warn/mute/ban + reversals, auto-mute after 3 warnings).
- database: 5 repository impls + `mappers.ts` (Prisma null → DTO undefined) + `prisma-errors.ts` (P2002→Conflict, P2003→Validation, P2025→NotFound).
- schema: Warning, Mute, Ban, Case, PermissionOverride, GuildCaseCounter (atomic case numbering); migration `20260613182559_moderation` applied.
- tests: 9 unit (`pnpm test`, mocked, no DB) + 8 integration (`pnpm --filter @sailorclawbot/database test:integration`, real Postgres). All green.

Remaining for full command-to-DB e2e: Discord slash-command layer in `apps/bot` (needs DISCORD_TOKEN).

### Verification commands

```sh
docker compose up -d postgres          # start DB (required for migrate + integration)
node scripts/run-prisma.mjs migrate dev
pnpm build                             # all 6 packages
pnpm test                              # unit tests (no DB)
pnpm --filter @sailorclawbot/database test:integration   # integration (needs DB)
```

## Technical Debt

- apps/bot, apps/worker, apps/dashboard still placeholders (no Discord.js yet)
- Only `ProfileService` and `ModerationService` implemented in core (placeholder)
- No repository implementations in database package
- apps/bot, apps/worker, apps/dashboard are console.log placeholders
- No Husky/commitlint pre-commit hooks
- No ESLint (only Biome for formatting)
- No zod validation on DTOs

## Dependency State

| Package | Depends on | Status |
|---------|-----------|--------|
| @sailorclawbot/contracts | (none) | ✅ Built |
| @sailorclawbot/core | contracts | ✅ Built |
| @sailorclawbot/database | contracts, @prisma/client | ✅ Built |
| @sailorclawbot/bot | (placeholder) | ✅ Built |
| @sailorclawbot/worker | (placeholder) | ✅ Built |
| @sailorclawbot/dashboard | (placeholder) | ✅ Built |
