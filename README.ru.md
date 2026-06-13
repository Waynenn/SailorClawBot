<div align="center">

# 🦀 SailorClawBot

**Многофункциональный Discord-бот — модерация, экономика, тикеты, профили, premium и полноценный дашборд. Построен как типизированный TypeScript-монорепозиторий, рассчитан на Tier-1 масштаб.**

[![CI](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml/badge.svg)](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/статус-в%20активной%20разработке-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)

**🌐 Документация:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md)

</div>

---

## ✨ Возможности

| Модуль | Что делает | Статус |
|--------|------------|--------|
| 🛡️ **Модерация** | Предупреждения, муты, баны, кики, история кейсов, апелляции, авто-мут | 🟢 Ядро готово |
| 💰 **Экономика и магазин** | Кошельки, транзакции, ежедневные награды, магазин ролей/предметов, топы | 🟡 В планах |
| 🎫 **Тикеты** | Тикеты поддержки — открытие, назначение, закрытие, транскрипты | 🟡 В планах |
| 👤 **Профили и уровни** | Профильные карточки, XP, уровни, лидерборды | 🟡 В планах |
| 💎 **Premium** | Уровни подписки и привилегии | 🟡 В планах |
| 🖥️ **Дашборд** | Веб-панель с ролями (Owner / Admin / User) | 🟡 В планах |

## 🌍 Локализация

Бот и дашборд строятся по принципу **i18n-first**. Язык хранится отдельно для каждого сервера в его настройках.

| Язык | Код | Документация | Интерфейс бота |
|------|-----|:------------:|:--------------:|
| 🇬🇧 English | `en` | ✅ | 🔜 |
| 🇷🇺 Русский | `ru` | ✅ | 🔜 |
| 🇺🇦 Українська | `uk` | — | 🔜 |
| 🇪🇸 Español | `es` | — | 🔜 |
| 🇩🇪 Deutsch | `de` | — | 🔜 |
| 🇫🇷 Français | `fr` | — | 🔜 |

> 📘 **Политика документации:** вся документация на GitHub ведётся на **🇬🇧 английском + 🇷🇺 русском**. План локализации — в [`docs/I18N.md`](docs/I18N.md).

## 🏗️ Архитектура

Слоистый монорепозиторий со строгим ацикличным потоком зависимостей:

```
contracts → core → database → bot → worker → dashboard
```

- **`contracts`** — DTO, интерфейсы репозиториев, доменные события (источник истины)
- **`core`** — бизнес-логика и сервисы приложения (без БД, без Discord)
- **`database`** — Prisma ORM + реализации репозиториев
- **`bot`** — интеграция с Discord.js (тонкая: события → сервисы core)
- **`worker`** — очереди, отложенные задачи, повторы
- **`dashboard`** — веб-панель на Next.js (переиспользует `core` + `database`)

Одни и те же сервисы питают **и бота, и дашборд** — без дублирования логики.

## 🧱 Технологии

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-5865F2?logo=discord&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-60A5FA?logo=biome&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

## 🚀 Быстрый старт

```sh
# 1. Установить зависимости
pnpm install

# 2. Поднять локальный PostgreSQL (Docker)
docker compose up -d postgres

# 3. Настроить окружение
cp .env.example .env        # затем заполнить DATABASE_URL и DISCORD_TOKEN

# 4. Сгенерировать Prisma-клиент и применить миграции
node scripts/run-prisma.mjs generate
node scripts/run-prisma.mjs migrate dev

# 5. Собрать всё
pnpm build
```

## 🧪 Тестирование

```sh
pnpm test                                              # юнит-тесты (без БД)
pnpm --filter @sailorclawbot/database test:integration # интеграционные (нужен Postgres)
```

## 🗺️ Дорожная карта

- [x] **Фаза 0** — Фундамент (монорепо, Prisma, Docker, CI)
- [ ] **Фаза 1** — Модерация 🟢 · Права и настройки сервера · Экономика · Тикеты · Профили
- [ ] **Фаза 2** — Слой Discord-бота (slash-команды, i18n)
- [ ] **Фаза 3** — Worker (очереди, отложенные размуты/разбаны)
- [ ] **Фаза 4** — Кэширование и производительность (Redis)
- [ ] **Фаза 5** — Дашборд (Next.js, ролевой доступ)
- [ ] **Фаза 6** — Наблюдаемость, нагрузочное тестирование и хардненинг

Подробный план — в [`docs/ROADMAP.md`](docs/ROADMAP.md).

## 🤝 Участие в разработке

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`)
- Каждое изменение оставляет `pnpm build` и `pnpm test` зелёными
- Документация ведётся на **английском + русском**

## 📄 Лицензия

Проприетарная — все права защищены (пока что). Лицензирование будет определено перед публичным запуском.

---

<div align="center">
<sub>Сделано с ⚓ для Discord-сообществ · на TypeScript, Prisma и Discord.js</sub>
</div>
