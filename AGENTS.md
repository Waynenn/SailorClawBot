## Project Overview

SailorClawBot is a modular Discord ecosystem built as a TypeScript monorepo.

Primary goal:

Build a production-ready Discord platform that is maintainable, testable, and compatible with Claude Code and Codex.

## Architecture

Dependency flow is mandatory:

contracts
-> core
-> database
-> bot
-> worker
-> dashboard

Never violate this order.

No cyclic dependencies.

## Development Priorities

Priority order:

1. Buildability
2. Correct architecture
3. Validation
4. Features

Do not add features if current phase is incomplete.

## Repository Rules

Contracts:

- Source of truth.
- DTO.
- Events.
- Repository interfaces.
- Shared types.

Core:

- Business logic only.
- Application services.
- Domain errors.
- EventBus contracts.
- Logger contracts.

Database:

- Prisma.
- Repository implementations.
- Migrations.
- Seed scripts.

Bot:

- Discord integration only.
- No business logic.

Worker:

- Queues.
- Jobs.
- Retry policies.
- DLQ.

Dashboard:

- Administration UI.
- API integration.

## Required Audits

Before implementation:

- Dependency Audit
- Blocker Audit
- Technical Debt Audit

After implementation:

- Exit Audit
- Project Status
- Next Recommended Step

## Validation Rules

Before any launch:

Run:

```sh
pnpm install
pnpm build
pnpm prisma validate
pnpm prisma generate
```

Fix all blockers before proceeding.

## Documentation Rules

Keep updated:

- docs/PROJECT_STATE.md
- docs/ROADMAP.md
- docs/ARCHITECTURE.md

Repository is the source of truth.

## Sprint Rules

After every completed sprint:

1. Update documentation.
2. Update project state.
3. Create archive checkpoint.
4. Commit changes.

## Forbidden

Do not:

- Introduce cyclic dependencies.
- Place business logic in bot layer.
- Skip validation.
- Mark a task complete without verification.
- Add new features before current phase is complete.
