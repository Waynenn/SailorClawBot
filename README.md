# SailorClawBot

SailorClawBot is a modular Discord ecosystem built as a TypeScript monorepo.

The current repository phase is foundation reconstruction: buildable root files, contracts, core primitives, database foundation, app entrypoints, validation, and documentation.

## Architecture

Mandatory dependency flow:

```text
contracts -> core -> database -> bot -> worker -> dashboard
```

Repository layers must remain acyclic. Bot code is Discord integration only; business logic belongs in core.

## Validation

```sh
pnpm install
pnpm build
pnpm prisma validate
pnpm prisma generate
```
