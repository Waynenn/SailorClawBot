<div align="center">

# 🦀 SailorClawBot

**An all-in-one Discord bot — moderation, economy, leveling, tickets, auto-mod & a full dashboard. Built as a typed TypeScript monorepo, designed for Tier-1 scale.**

[![CI](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml/badge.svg)](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-in%20active%20development-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)

**🌐 Docs:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md)

</div>

---

## ✨ Features

| Module | What it does | Status |
|--------|--------------|--------|
| 🛡️ **Moderation** | Warnings, mutes, bans, kicks, case history, softban | ✅ Live |
| 💰 **Economy** | Wallets, daily/work/crime/rob, coinflip, slots, blackjack, roulette | ✅ Live |
| 🛒 **Shop & Inventory** | Item shop, buy/sell, per-user inventory | ✅ Live |
| 📈 **XP & Leveling** | XP grants, level-up roles, /rank, /leaderboard | ✅ Live |
| 🎫 **Tickets** | Support tickets with claim/close/rating buttons, 7-day retention | ✅ Live |
| 🤖 **Auto-Moderation** | 6 rule types, anti-raid, account age gate, verification button | 🔜 Phase 6 |
| 👨‍👩‍👧 **Family / Clan** | Social groups with officer hierarchy | ⏳ Planned |
| 🖥️ **Dashboard** | Role-based web panel (Owner / Admin / User) | ⏳ Planned |
| 🏆 **Achievements** | 20+ unlock types, DM notifications | ⏳ Planned |

## 🏗️ Architecture

Strict, acyclic dependency flow:

```
contracts → core → database → bot → worker → dashboard
```

- **`contracts`** — DTOs, repository interfaces, domain events
- **`core`** — business logic & services (no persistence, no Discord)
- **`database`** — Prisma ORM + repository implementations
- **`bot`** — Discord.js (thin: events → core services)
- **`worker`** — scheduled jobs (mute/ban expiry via node-cron)
- **`dashboard`** — Next.js web panel (reuses `core` + `database`)

## 🚀 Quick Start

```sh
pnpm install
docker compose up -d postgres
cp .env.example .env
node scripts/run-prisma.mjs migrate dev
node scripts/run-prisma.mjs generate
pnpm build
pnpm dev
```

## 🧪 Testing

```sh
pnpm test   # node --test, no DB needed
```

## 🗺️ Roadmap

- [x] Phase 0 — Foundation (monorepo, Prisma, Docker, CI)
- [x] Phase 1 — Core services + repos (58 tests)
- [x] Phase 2 — Discord bot layer (10 commands, DI container)
- [x] Phase 2.5 — Schema mega-migration, RoleMapping permissions
- [x] Phase 3 — XP / Leveling
- [x] Phase 4 — Economy extended (gambling, shop, inventory)
- [x] Phase 5 — Tickets (full Discord integration)
- [ ] **Phase 6** — Auto-Moderation + Sentry 🔜
- [ ] Phase 7 — Server management (logging, welcome, giveaways, starboard)
- [ ] Phase 8 — Family / Clan
- [ ] Phase 9 — Redis + Admin Dashboard (Next.js + Stripe)
- [ ] Phase 10 — User Dashboard + rank cards
- [ ] Phase 11 — Achievements
- [ ] Phase 12 — i18n + rate limiting + polish
- [ ] Phase 13 — Sharding
- [ ] Phase 14 — Music stub

See [`docs/REFINED_ROADMAP.md`](docs/REFINED_ROADMAP.md) for details.

## 📄 License

Proprietary — all rights reserved.

---
<div align="center"><sub>Built with ⚓ for Discord communities · TypeScript, Prisma & Discord.js</sub></div>
