<div align="center">

<img src="https://raw.githubusercontent.com/Waynenn/SailorClawBot/main/docs/assets/banner.png" alt="SailorClawBot" width="600" onerror="this.style.display='none'"/>

# 🌙 SailorClawBot

**An all-in-one Discord bot — moderation, economy, leveling, tickets, auto-mod & a full dashboard.**
**Built as a strict TypeScript monorepo, designed for Tier-1 scale.**

[![CI](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml/badge.svg)](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-in%20active%20development-yellow?style=flat-square)](https://github.com/Waynenn/SailorClawBot)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.js.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)

**🌐 Docs:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md)

</div>

---

## ✨ Features

| Module | What it does | Status |
|--------|--------------|:------:|
| 🛡️ **Moderation** | Warnings, mutes, bans, kicks, case history, softban, purge | ✅ Live |
| 💰 **Economy** | Wallets, daily/work/crime/rob, coinflip, slots, blackjack, roulette | ✅ Live |
| 🛒 **Shop & Inventory** | Item shop, buy/sell, per-user inventory | ✅ Live |
| 📈 **XP & Leveling** | XP grants, level-up roles, /rank, /leaderboard | ✅ Live |
| 🎫 **Tickets** | Support tickets with claim/close/rating buttons, 7-day retention | ✅ Live |
| 🤖 **Auto-Moderation** | 6 rule types, anti-raid, account age gate, slowmode, lockdown | ✅ Live |
| 🌙 **Server Management** | Giveaways, welcome messages, starboard, reaction roles, logging | ✅ Live |
| 👨‍👩‍👧 **Family / Clan** | Social groups with officer hierarchy | ⏳ Planned |
| 🖥️ **Dashboard** | Role-based web panel (Owner / Admin / User) | ⏳ Planned |
| 🏆 **Achievements** | 20+ unlock types, DM notifications | ⏳ Planned |

---

## 🏗️ Architecture

Strict, acyclic dependency flow — no layer may import from a layer above it:

```
contracts → core → database → bot → worker → dashboard
```

| Package | Role |
|---------|------|
| 📋 `contracts` | DTOs, repository interfaces, domain events |
| 🧠 `core` | Business logic & services — no persistence, no Discord |
| 🗄️ `database` | Prisma ORM + repository implementations |
| 🤖 `bot` | Discord.js — thin layer, events route to core services |
| ⚙️ `worker` | Scheduled jobs (mute/ban expiry via node-cron) |
| 🌙 `dashboard` | Next.js web panel (reuses `core` + `database`) |

---

## 📋 Prerequisites

| Tool | Version | How to check |
|------|---------|--------------|
| [Node.js](https://nodejs.org/) | ≥ 22 | `node --version` |
| [pnpm](https://pnpm.io/) | ≥ 9 | `pnpm --version` · install: `npm i -g pnpm` |
| [Docker](https://www.docker.com/) | any recent | `docker --version` |
| Discord Application | — | [Create one →](https://discord.com/developers/applications) |

---

## 🚀 Installation

### 1. Clone the repository

```sh
git clone https://github.com/Waynenn/SailorClawBot.git
cd SailorClawBot
```

### 2. Install dependencies

```sh
pnpm install
```

### 3. Configure environment

```sh
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DATABASE_URL=postgresql://sailorclaw:change_me@localhost:5432/sailorclawbot
```

> **How to get a Discord token:**
> 1. Open [discord.com/developers/applications](https://discord.com/developers/applications)
> 2. Create an application → **Bot** tab → **Reset Token** → copy into `DISCORD_TOKEN`
> 3. **General Information** → copy **Application ID** into `DISCORD_CLIENT_ID`
> 4. **Bot → Privileged Gateway Intents** → enable **Server Members Intent** + **Message Content Intent**

### 4. Start the database

```sh
docker compose up -d postgres
```

### 5. Apply migrations & generate client

```sh
node scripts/run-prisma.mjs migrate dev
node scripts/run-prisma.mjs generate
```

### 6. Build all packages

```sh
pnpm build
```

### 7. Invite the bot to your server

Replace `YOUR_CLIENT_ID` with your application ID:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

> Permission `8` = Administrator. Use a tighter bitmask for production.

### 8. Run

```sh
pnpm dev     # development — hot reload
pnpm start   # production
```

Slash commands are registered automatically on every startup.

---

## 🧪 Testing & Quality

```sh
pnpm test     # node --test — no database required
pnpm build    # TypeScript compilation
pnpm lint     # Biome lint + format check
```

---

## 📁 Project Structure

```
SailorClawBot/
├── apps/
│   ├── bot/        🌙 Discord.js (slash commands, events)
│   ├── worker/     ⚙️  Scheduled jobs (mute/ban expiry)
│   └── dashboard/  🖥️  Web panel (placeholder)
├── packages/
│   ├── contracts/  📋 DTOs, interfaces, domain events
│   ├── core/       🧠 Business logic + unit tests
│   └── database/   🗄️  Prisma schema + repositories
├── docs/           📚 Architecture documentation
├── infrastructure/ 🐋 Docker & deploy configs
└── scripts/        🛠️  Prisma helper scripts
```

---

## 🗺️ Roadmap

| Phase | Focus | Status |
|-------|-------|:------:|
| 0 | Foundation — monorepo, Prisma, Docker, CI | ✅ Done |
| 1 | Core services + repos (58 tests) | ✅ Done |
| 2 | Discord bot layer (commands, DI container) | ✅ Done |
| 2.5 | Schema mega-migration, RoleMapping permissions | ✅ Done |
| 3 | XP / Leveling | ✅ Done |
| 4 | Economy extended (gambling, shop, inventory) | ✅ Done |
| 5 | Tickets (full Discord integration) | ✅ Done |
| 6 | 🌙 Auto-Mod + Sentry + Anti-raid | ✅ Done |
| 7 | 🌙 Server management (giveaways, starboard, reaction roles, welcome, logging) | ✅ Done |
| 8 | Family / Clan | ⏳ |
| 9 | Redis + Admin Dashboard (Next.js + Stripe) | ⏳ |
| 10 | User Dashboard + rank cards | ⏳ |
| 11 | Achievements | ⏳ |
| 12 | i18n + rate limiting + polish | ⏳ |
| 13 | Sharding | ⏳ |
| 14 | Music stub | ⏳ |

Full details → [`docs/REFINED_ROADMAP.md`](docs/REFINED_ROADMAP.md)

---

## 📄 License

Proprietary — all rights reserved.

---

<div align="center">
<sub>🌙 Built for Discord communities · TypeScript · Prisma · Discord.js</sub>
</div>
