<div align="center">

# 🦀 SailorClawBot

**An all-in-one Discord bot — moderation, economy, tickets, profiles, premium & a full dashboard. Built as a typed TypeScript monorepo, designed for Tier-1 scale.**

[![CI](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml/badge.svg)](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-in%20active%20development-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)

**🌐 Docs:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md)

</div>

---

## ✨ Features

| Module                     | What it does                                                       | Status        |
| -------------------------- | ------------------------------------------------------------------ | ------------- |
| 🛡️ **Moderation**          | Warnings, mutes, bans, kicks, case history, appeals, auto-mute     | 🟢 Core built |
| 💰 **Economy & Shop**      | Wallets, transactions, daily rewards, role/item shop, leaderboards | 🟡 Planned    |
| 🎫 **Tickets**             | Support tickets — open, assign, close, transcripts                 | 🟡 Planned    |
| 👤 **Profiles & Leveling** | Profile cards, XP, levels, leaderboards                            | 🟡 Planned    |
| 💎 **Premium**             | Subscription tiers & entitlements                                  | 🟡 Planned    |
| 🖥️ **Dashboard**           | Role-based web panel (Owner / Admin / User)                        | 🟡 Planned    |

## 🌍 Localization

The bot and dashboard are being built **i18n-first**. Per-guild language is stored in guild settings.

| Language      | Code | Docs | Bot UI |
| ------------- | ---- | :--: | :----: |
| 🇬🇧 English    | `en` |  ✅  |   🔜   |
| 🇷🇺 Русский    | `ru` |  ✅  |   🔜   |
| 🇺🇦 Українська | `uk` |  —   |   🔜   |
| 🇪🇸 Español    | `es` |  —   |   🔜   |
| 🇩🇪 Deutsch    | `de` |  —   |   🔜   |
| 🇫🇷 Français   | `fr` |  —   |   🔜   |

> 📘 **Docs policy:** all GitHub documentation is maintained in **🇬🇧 English + 🇷🇺 Русский**. See [`docs/I18N.md`](docs/I18N.md) for the localization plan.

## 🏗️ Architecture

A layered monorepo with a strict, acyclic dependency flow:

```
contracts → core → database → bot → worker → dashboard
```

- **`contracts`** — DTOs, repository interfaces, domain events (the source of truth)
- **`core`** — business logic & application services (no persistence, no Discord)
- **`database`** — Prisma ORM + repository implementations
- **`bot`** — Discord.js integration (thin: events → core services)
- **`worker`** — queues, scheduled jobs, retries
- **`dashboard`** — Next.js web panel (reuses `core` + `database`)

The same services power **both** the bot and the dashboard — zero logic duplication.

## 🧱 Tech Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-5865F2?logo=discord&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-60A5FA?logo=biome&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## 🚀 Quick Start

```sh
# 1. Install dependencies
pnpm install

# 2. Start a local PostgreSQL (Docker)
docker compose up -d postgres

# 3. Configure environment
cp .env.example .env        # then fill in DATABASE_URL & DISCORD_TOKEN

# 4. Generate Prisma client & apply migrations
node scripts/run-prisma.mjs generate
node scripts/run-prisma.mjs migrate dev

# 5. Build everything
pnpm build
```

## 🧪 Testing

```sh
pnpm test                                              # unit tests (no DB)
pnpm --filter @sailorclawbot/database test:integration # integration (needs Postgres)
```

## 🗺️ Roadmap

- [x] **Phase 0** — Foundation (monorepo, Prisma, Docker, CI)
- [ ] **Phase 1** — Moderation 🟢 · Permissions & guild settings · Economy · Tickets · Profiles
- [ ] **Phase 2** — Discord bot layer (slash commands, i18n)
- [ ] **Phase 3** — Worker (queues, scheduled unmutes/unbans)
- [ ] **Phase 4** — Caching & performance (Redis)
- [ ] **Phase 5** — Dashboard (Next.js, role-based)
- [ ] **Phase 6** — Observability, load testing & hardening

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the detailed plan.

## 🤝 Contributing

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Every change keeps `pnpm build` & `pnpm test` green
- Docs are written in **English + Русский**

## 📄 License

Proprietary — all rights reserved (for now). Licensing to be finalized before public launch.

---

<div align="center">
<sub>Built with ⚓ for Discord communities · powered by TypeScript, Prisma & Discord.js</sub>
</div>
