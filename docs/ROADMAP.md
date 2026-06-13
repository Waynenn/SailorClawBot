# Roadmap

## Phase 0: Foundation

Status: complete after validation.

- Reconstruct monorepo root files.
- Add architecture documentation.
- Add package boundaries for contracts, core, database, bot, worker, and dashboard.
- Add Prisma foundation.
- Add Docker/Postgres foundation.
- Validate install, build, Prisma schema, and Prisma client generation.

## Phase 1: Contracts

Status: next.

- Expand DTOs for approved MVP domains.
- Add event contracts.
- Finalize repository interfaces.
- Add contract tests.

## Phase 2: Core

Status: pending.

- Implement application services.
- Add domain errors.
- Add event bus abstractions.
- Add unit tests.

## Phase 3: Database

Status: pending.

- Add migrations.
- Implement Prisma repositories.
- Add seed scripts.
- Add integration tests.

## Phase 4: Bot

Status: pending.

- Add Discord.js integration.
- Wire commands to core services.
- Keep business logic out of the bot layer.

## Phase 5: Worker

Status: pending.

- Add queue infrastructure.
- Add jobs, retry policies, and DLQ.

## Phase 6: Dashboard

Status: pending.

- Add administration UI.
- Add API integration.
- Add auth and operational views after backend boundaries are stable.
