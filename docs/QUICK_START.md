# 🌙 SailorClawBot — Quick Start

> **For the full installation guide see [README.md](../README.md).**  
> This page covers developer-specific shortcuts and tips.

---

## Requirements

- Node.js >= 22 (`node --version`)
- pnpm >= 9 (`npm i -g pnpm`)
- Docker with Compose

---

## First-time setup (5 minutes)

```sh
git clone https://github.com/Waynenn/SailorClawBot.git
cd SailorClawBot

pnpm install
cp .env.example .env          # then edit .env with your token & DB URL

docker compose up -d postgres
node scripts/run-prisma.mjs migrate dev
node scripts/run-prisma.mjs generate

pnpm build
pnpm dev
```

---

## Daily workflow

```sh
# Start the database (if not running)
docker compose up -d postgres

# Run in dev mode with hot reload
pnpm dev

# Run tests
pnpm test

# Type check & lint
pnpm build
pnpm lint
```

---

## Database operations

Always use the wrapper script -- never call `prisma` directly from the monorepo root:

```sh
# Apply a new migration
node scripts/run-prisma.mjs migrate dev --name your_migration_name

# Regenerate client after schema changes
node scripts/run-prisma.mjs generate

# Open Prisma Studio (DB browser)
node scripts/run-prisma.mjs studio

# Reset DB (dev only -- destroys all data)
node scripts/run-prisma.mjs migrate reset
```

---

## Adding a new slash command

1. Create `apps/bot/src/commands/<domain>/<name>.ts` -- implement `SlashCommandBuilder` + `execute()`
2. Register it in `apps/bot/src/commands/index.ts` (add to `ALL_COMMANDS`)
3. If the command needs a new service: add to `packages/core/src/services/`, export from `packages/core/src/index.ts`
4. Wire into `apps/bot/src/container.ts`
5. Write tests in `packages/core/src/services/<Name>Service.test.ts`

---

## Dependency order (never break this)

```
contracts -> core -> database -> bot -> worker -> dashboard
```

No package may import from a package higher in the chain.

---

## Useful commands

| Command | What it does |
|---------|-------------|
| `pnpm build` | Compile all packages in order |
| `pnpm test` | Run all tests (no DB needed) |
| `pnpm lint` | Biome lint + format check |
| `pnpm dev` | Start bot + worker in watch mode |
| `docker compose logs -f postgres` | Stream Postgres logs |

---

## Architecture overview

See [ARCHITECTURE.md](ARCHITECTURE.md) and [REFINED_ROADMAP.md](REFINED_ROADMAP.md).
