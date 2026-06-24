<div align="center">

# 🦀 SailorClawBot

**Многофункциональный Discord-бот — модерация, экономика, уровни, тикеты, авто-модерация и дашборд. TypeScript-монорепо, рассчитан на Tier-1 масштаб.**

[![CI](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml/badge.svg)](https://github.com/Waynenn/SailorClawBot/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/статус-в%20активной%20разработке-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)

**🌐 Документация:** [🇬🇧 English](README.md) · [🇷🇺 Русский](README.ru.md)

</div>

---

## ✨ Возможности

| Модуль | Что делает | Статус |
|--------|------------|--------|
| 🛡️ **Модерация** | Предупреждения, муты, баны, кики, история кейсов, softban | ✅ Работает |
| 💰 **Экономика** | Кошельки, daily/work/crime/rob, монетка, слоты, блэкджек, рулетка | ✅ Работает |
| 🛒 **Магазин и инвентарь** | Магазин предметов, покупка/продажа, инвентарь | ✅ Работает |
| 📈 **XP и уровни** | Начисление XP, роли за уровень, /rank, /leaderboard | ✅ Работает |
| 🎫 **Тикеты** | Кнопки claim/close/оценка, хранение 7 дней | ✅ Работает |
| 🤖 **Авто-модерация** | 6 правил, анти-рейд, возраст аккаунта, верификация | 🔜 Фаза 6 |
| 👨‍👩‍👧 **Семья / Клан** | Социальные группы с иерархией офицеров | ⏳ Планируется |
| 🖥️ **Дашборд** | Веб-панель с ролевым доступом | ⏳ Планируется |
| 🏆 **Достижения** | 20+ типов разблокировки, уведомления в DM | ⏳ Планируется |

## 🏗️ Архитектура

Строгий ацикличный поток зависимостей:

```
contracts → core → database → bot → worker → dashboard
```

- **`contracts`** — DTO, интерфейсы репозиториев, доменные события
- **`core`** — бизнес-логика (без БД, без Discord)
- **`database`** — Prisma ORM + реализации репозиториев
- **`bot`** — Discord.js (тонкая: события → сервисы core)
- **`worker`** — отложенные задачи (истечение мута/бана, node-cron)
- **`dashboard`** — Next.js (переиспользует `core` + `database`)

## 🚀 Быстрый старт

```sh
pnpm install
docker compose up -d postgres
cp .env.example .env
node scripts/run-prisma.mjs migrate dev
node scripts/run-prisma.mjs generate
pnpm build
pnpm dev
```

## 🧪 Тестирование

```sh
pnpm test   # node --test, без БД
```

## 🗺️ Дорожная карта

- [x] Фаза 0 — Фундамент (монорепо, Prisma, Docker, CI)
- [x] Фаза 1 — Core-сервисы + репозитории (58 тестов)
- [x] Фаза 2 — Discord-бот (10 команд, DI-контейнер)
- [x] Фаза 2.5 — Мега-миграция, RoleMapping, права
- [x] Фаза 3 — XP / Уровни
- [x] Фаза 4 — Расширенная экономика (gambling, магазин, инвентарь)
- [x] Фаза 5 — Тикеты (полная Discord-интеграция)
- [ ] **Фаза 6** — Авто-модерация + Sentry 🔜
- [ ] Фаза 7 — Управление сервером (логи, приветствие, giveaway, starboard)
- [ ] Фаза 8 — Семья / Клан
- [ ] Фаза 9 — Redis + Admin-дашборд (Next.js + Stripe)
- [ ] Фаза 10 — Пользовательский дашборд
- [ ] Фаза 11 — Достижения
- [ ] Фаза 12 — i18n + rate limiting + полировка
- [ ] Фаза 13 — Шардинг
- [ ] Фаза 14 — Заглушка музыки

Подробный план — в [`docs/REFINED_ROADMAP.md`](docs/REFINED_ROADMAP.md).

## 📄 Лицензия

Проприетарная — все права защищены.

---
<div align="center"><sub>Сделано с ⚓ для Discord-сообществ · TypeScript, Prisma & Discord.js</sub></div>
