# Architecture

SailorClawBot is a TypeScript monorepo for a modular Discord ecosystem.

## Dependency Model

The mandatory dependency flow is:

```text
contracts -> core -> database -> bot -> worker -> dashboard
```

Rules:

- `contracts` owns DTOs, shared types, event names, and repository interfaces.
- `core` owns business logic, domain errors, application services, event bus contracts, and logger contracts.
- `database` owns Prisma, migrations, seeds, and repository implementations.
- `bot` owns Discord integration only.
- `worker` owns queues, jobs, retry policies, and DLQ handling.
- `dashboard` owns administration UI and API integration.

No cyclic dependencies are allowed.

## Current Shape

- `packages/contracts`: source of truth for shared contracts.
- `packages/core`: domain primitives and application services.
- `packages/database`: Prisma schema and database boundary.
- `apps/bot`: Discord integration entrypoint placeholder.
- `apps/worker`: background worker entrypoint placeholder.
- `apps/dashboard`: dashboard entrypoint placeholder.

## Archive Selection

Useful material imported or consolidated:

- `SailorClawBot-Foundation-RootFiles.zip`: root package, workspace, TypeScript, Turbo, environment, ignore rules.
- `SailorClawBot-Foundation-Database-Pack.zip`: Prisma/PostgreSQL foundation and package boundary.
- `SailorClawBot-Foundation-Docker-Pack.zip`: Postgres Docker Compose and Dockerfile skeletons.
- `SailorClawBot-Knowledge-Pack.zip`: dependency model, launch readiness, and repository-source-of-truth guidance.
- `SailorClawBot-Codex-Handoff.zip` and `SailorClawBot-Handoff-Full.zip`: roadmap/order-of-work guidance.

Rejected material:

- NexusBot archives: different project identity.
- Archives containing only `// Placeholder` files.
- Duplicate or older snapshots that would reduce buildability or conflict with the selected architecture.
