# SailorClawBot

All-in-one Discord bot for multi-server deployment. TypeScript monorepo.

## Quick start

```sh
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Setup database (requires PostgreSQL)
cp .env.example .env
# Edit .env with your DATABASE_URL
pnpm prisma migrate dev
pnpm prisma generate
```

## Architecture

```
contracts → core → database → bot → worker → dashboard
```

| Package | Purpose |
|---------|---------|
| `@sailorclawbot/contracts` | DTOs, repository interfaces, event names |
| `@sailorclawbot/core` | Business logic, application services |
| `@sailorclawbot/database` | Prisma ORM, repository implementations |
| `apps/bot` | Discord.js integration (placeholder) |
| `apps/worker` | Queue processing (placeholder) |
| `apps/dashboard` | Admin UI (placeholder) |

## Current status

- **Phase 0** ✅ — Foundation complete (monorepo, Prisma, Docker, docs)
- **Phase 1** 🔄 — In progress (contracts expansion, repositories, services, tests)

See `docs/ROADMAP.md` for the full roadmap.

## Development

```sh
# Run all packages in dev mode
pnpm dev

# Lint
pnpm lint

# Test
pnpm test
```

## Documentation

- `docs/ARCHITECTURE.md` — architecture decisions and dependency model
- `docs/ROADMAP.md` — project phases and timeline
- `docs/PROJECT_STATE.md` — current state and technical debt
- `docs/MASTER_AUDIT_REPORT.md` — full audit (June 2026)
- `docs/PHASE_1_IMPLEMENTATION_GUIDE.md` — Phase 1 implementation guide
- `AGENTS.md` — rules for AI agents working in this repo

## Requirements

- Node.js 22+
- pnpm 9+
- PostgreSQL 16+
