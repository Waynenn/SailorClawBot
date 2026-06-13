# README for Next Agent

## Start here

1. Read `CLAUDE.md` — project structure, current status, key files.
2. Read `docs/PROJECT_STATE.md` — what's done, what's next, technical debt.
3. Read `docs/INDEX.md` — ordered checklist for Phase 1 implementation.

## Current state (2026-06-13)

- Phase 0 (foundation) ✅ complete and validated
- Phase 1 (contracts + core + repos) 🔄 ready to start
- Zero tests exist
- Only `ProfileService` is implemented in core
- `apps/bot`, `apps/worker`, `apps/dashboard` are console.log placeholders

## What to do next

**Do not write from scratch.** Source files are prepared in `docs/`:

```
docs/00-contracts-types-extended.ts    → packages/contracts/src/types/extended.ts
docs/01-contracts-repositories-extended.ts → packages/contracts/src/repositories/extended.ts
docs/02-events-eventnames.ts           → packages/contracts/src/events/EventNames.ts (REPLACE)
docs/03-WarningRepositoryImpl.ts       → pattern to follow for all repositories
docs/04-ModerationService.ts          → pattern to follow for all services
```

After copying, run `pnpm build` — must pass before proceeding.

Then expand Prisma schema, run `pnpm prisma migrate dev`, implement repositories and services.

## Validation commands (run after every phase)

```sh
pnpm install
pnpm build
pnpm prisma validate
pnpm prisma generate
pnpm test
```

## Non-negotiables

- Dependency order: `contracts → core → database → bot → worker → dashboard`
- No business logic in bot layer
- 80%+ test coverage for new code
- No cyclic dependencies
