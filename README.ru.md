<div align="center">

# 🌙 SailorClawBot

**Многофункциональный Discord-бот — модерация, экономика, уровни, тикеты, авто-модерация и дашборд.**
**TypeScript-монорепо, рассчитан на Tier-1 масштаб.**

[![CI](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml/badge.svg)](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/статус-активная%20разработка-yellow?style=flat-square)](https://github.com/Waynenn/SailorClawBot)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?style=flat-square&logo=discord&logoColor=white)](https://discord.js.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)

**🌐 Документация:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md)

</div>

---

## ✨ Возможности

| Модуль | Что делает | Статус |
|--------|------------|:------:|
| 🛡️ **Модерация** | Предупреждения, муты, баны, кики, история кейсов, softban, purge | ✅ Работает |
| 💰 **Экономика** | Кошельки, daily/work/crime/rob, монетка, слоты, блэкджек, рулетка | ✅ Работает |
| 🛒 **Магазин и инвентарь** | Магазин предметов, покупка/продажа, инвентарь | ✅ Работает |
| 📈 **XP и уровни** | Начисление XP, роли за уровень, /rank, /leaderboard | ✅ Работает |
| 🎫 **Тикеты** | Кнопки claim/close/оценка, хранение 7 дней | ✅ Работает |
| 🤖 **Авто-модерация** | 6 правил, анти-рейд, возраст аккаунта, slowmode, lockdown | ✅ Работает |
| 🌙 **Управление сервером** | Giveaway, приветствия, starboard, reaction roles, логирование | ✅ Работает |
| 👨‍👩‍👧 **Семья / Клан** | Социальные группы с иерархией офицеров | ⏳ Планируется |
| 🖥️ **Дашборд** | Веб-панель с ролевым доступом (Owner / Admin / User) | ⏳ Планируется |
| 🏆 **Достижения** | 20+ типов разблокировки, уведомления в DM | ⏳ Планируется |

---

## 🏗️ Архитектура

Строгий ацикличный поток зависимостей — ни один слой не импортирует из слоя выше:

```
contracts → core → database → bot → worker → dashboard
```

| Пакет | Роль |
|-------|------|
| 📋 `contracts` | DTO, интерфейсы репозиториев, доменные события |
| 🧠 `core` | Бизнес-логика (без БД, без Discord) |
| 🗄️ `database` | Prisma ORM + реализации репозиториев |
| 🤖 `bot` | Discord.js — тонкий слой, события → сервисы core |
| ⚙️ `worker` | Отложенные задачи (истечение мута/бана, node-cron) |
| 🌙 `dashboard` | Next.js веб-панель (переиспользует `core` + `database`) |

---

## 📋 Требования

| Инструмент | Версия | Как проверить |
|-----------|--------|---------------|
| [Node.js](https://nodejs.org/) | ≥ 22 | `node --version` |
| [pnpm](https://pnpm.io/) | ≥ 9 | `pnpm --version` · установка: `npm i -g pnpm` |
| [Docker](https://www.docker.com/) | любая свежая | `docker --version` |
| Discord-приложение | — | [Создать здесь →](https://discord.com/developers/applications) |

---

## 🚀 Установка

### 1. Клонировать репозиторий

```sh
git clone https://github.com/Waynenn/SailorClawBot.git
cd SailorClawBot
```

### 2. Установить зависимости

```sh
pnpm install
```

### 3. Настроить окружение

```sh
cp .env.example .env
```

Откройте `.env` и заполните переменные:

```env
DISCORD_TOKEN=токен_вашего_бота
DISCORD_CLIENT_ID=id_вашего_приложения
DATABASE_URL=postgresql://sailorclaw:change_me@localhost:5432/sailorclawbot
```

> **Как получить токен Discord:**
> 1. Откройте [discord.com/developers/applications](https://discord.com/developers/applications)
> 2. Создайте приложение → вкладка **Bot** → **Reset Token** → скопируйте в `DISCORD_TOKEN`
> 3. **General Information** → скопируйте **Application ID** в `DISCORD_CLIENT_ID`
> 4. **Bot → Privileged Gateway Intents** → включите **Server Members Intent** + **Message Content Intent**

### 4. Запустить базу данных

```sh
docker compose up -d postgres
```

### 5. Применить миграции и сгенерировать клиент

```sh
node scripts/run-prisma.mjs migrate dev
node scripts/run-prisma.mjs generate
```

### 6. Собрать все пакеты

```sh
pnpm build
```

### 7. Пригласить бота на сервер

Замените `YOUR_CLIENT_ID` на ваш Application ID:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

> Разрешение `8` = Administrator. Для продакшена используйте более ограниченный bitmask.

### 8. Запустить

```sh
pnpm dev     # разработка — hot reload
pnpm start   # продакшен
```

Slash-команды регистрируются автоматически при каждом запуске.

---

## 🧪 Тестирование и качество

```sh
pnpm test     # node --test — база данных не нужна
pnpm build    # проверка компиляции TypeScript
pnpm lint     # Biome lint + проверка форматирования
```

---

## 📁 Структура проекта

```
SailorClawBot/
├── apps/
│   ├── bot/        🌙 Discord.js (slash-команды, события)
│   ├── worker/     ⚙️  Cron-задачи (истечение мута/бана)
│   └── dashboard/  🖥️  Веб-панель (placeholder)
├── packages/
│   ├── contracts/  📋 DTO, интерфейсы, доменные события
│   ├── core/       🧠 Бизнес-логика + юнит-тесты
│   └── database/   🗄️  Prisma-схема + репозитории
├── docs/           📚 Архитектурная документация
├── infrastructure/ 🐋 Docker и deploy-конфиги
└── scripts/        🛠️  Вспомогательные Prisma-скрипты
```

---

## 🗺️ Дорожная карта

| Фаза | Фокус | Статус |
|------|-------|:------:|
| 0 | Фундамент — монорепо, Prisma, Docker, CI | ✅ Готово |
| 1 | Core-сервисы + репозитории (58 тестов) | ✅ Готово |
| 2 | Discord-бот (команды, DI-контейнер) | ✅ Готово |
| 2.5 | Мега-миграция, RoleMapping, права | ✅ Готово |
| 3 | XP / Уровни | ✅ Готово |
| 4 | Расширенная экономика (gambling, магазин, инвентарь) | ✅ Готово |
| 5 | Тикеты (полная Discord-интеграция) | ✅ Готово |
| 6 | 🌙 Авто-модерация + Sentry + Анти-рейд | ✅ Готово |
| 7 | 🌙 Управление сервером (giveaway, starboard, reaction roles, welcome, логи) | ✅ Готово |
| 8 | Семья / Клан | ⏳ |
| 9 | Redis + Admin-дашборд (Next.js + Stripe) | ⏳ |
| 10 | Пользовательский дашборд + rank cards | ⏳ |
| 11 | Достижения | ⏳ |
| 12 | i18n + rate limiting + полировка | ⏳ |
| 13 | Шардинг | ⏳ |
| 14 | Заглушка музыки | ⏳ |

Подробный план → [`docs/REFINED_ROADMAP.md`](docs/REFINED_ROADMAP.md)

---

## 📄 Лицензия

Проприетарная — все права защищены.

---

<div align="center">
<sub>🌙 Сделано для Discord-сообществ · TypeScript · Prisma · Discord.js</sub>
</div>
