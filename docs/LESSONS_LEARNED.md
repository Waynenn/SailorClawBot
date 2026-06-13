# Lessons Learned

## Foundation Phase

- Archive files are inputs, not the source of truth. The repository is the source of truth after reconstruction.
- Buildability comes before feature work. A non-building monorepo blocks everything.
- Validation must run before calling any phase complete: `pnpm install && pnpm build && pnpm prisma validate && pnpm prisma generate`.
- Prisma CLI and Prisma client must be in the same package boundary. Having Prisma only in the root and client in a sub-package breaks `prisma generate`.
- pnpm 11 blocks Prisma build scripts by default — approve them explicitly or add to `pnpm.onlyBuiltDependencies`.
- NexusBot archives were excluded because they target a different project identity. Do not mix archive sources from different projects.
- Documentation must be updated continuously — stale docs cost more time than writing them costs.

## Architecture

- Never let business logic leak into the bot layer. Discord.js events are triggers, not logic containers.
- Cyclic dependencies in a monorepo silently break build order and are hard to detect after the fact. Enforce the `contracts → core → database → bot → worker → dashboard` chain from day one.
- `SnowflakeId = string` must be enforced everywhere. Mixing `number` or `bigint` for Discord IDs causes silent precision loss for large IDs.

## Process

- Prisma schema expansion should happen before repository implementation — schema is the contract, implementations follow.
- Write integration tests alongside repository implementations, not after. Retrofitting tests on database code is painful.
- One source of truth for contracts: if a DTO or interface changes, it must change in `contracts` first.

## Tooling

- Biome replaces both Prettier and ESLint for formatting/linting in this project. Do not add ESLint on top of Biome — they conflict.
- Turbo cache helps only if outputs are declared correctly in `turbo.json`. Missing `dist/**` in outputs breaks incremental builds.
