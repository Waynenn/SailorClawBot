# 🌙 Block 0 — Стабилизация (редакция «Market Leader»)

**Создан:** 2026-06-27 · **Переписан:** 2026-06-27 (v2, после само-аудита E1–E7)
**Контекст:** SaaS-конкурент MEE6. Цель — в каждом домене **не хуже лидера категории**, а не «работающая заглушка».
**Статус:** ⏳ На ревью — реализацию начинать после апрува.

---

## Эталон-лидер по доменам Блока 0

| Домен | Лидер(ы) | Чем берут | Наша планка |
|-------|----------|-----------|-------------|
| Temp-бан / mute | **Wick**, Dyno | durable-действия, аудит, переживают рестарт, >28д | авто-снятие ≤60c, роль-fallback для >28д, аудит+DM |
| Логирование | **Carl-bot** | свой кэш сообщений → дифф удалённых/правок, полное покрытие, ignore-каналы | контент удалённых даже вне API-кэша, 15+ типов событий |
| Giveaways | **GiveawayBot**, MEE6 | авто-энд, requirements (роль/буст/уровень), reroll | точный энд, требования к входу, DM победителю |
| Anti-abuse | (инфра) | невидимый троттлинг, режет спам | глобальные per-user лимиты кросс-шардово |

---

## Архитектурные решения (зафиксированы по итогам аудита)

1. **Redis оправдан как ДВИЖОК, не «про запас»** (снимает E6):
   - **Кэш сообщений** для Carl-bot-грейд логов (дифф удалённых/правленых сообщений вне Discord-кэша).
   - **Глобальные кросс-шардовые** per-user rate-лимиты.
2. **XP-cooldown ОСТАЁТСЯ in-memory per-shard** (E1). Discord шардит по `guildId` → все события гильдии на одном шарде → Map консистентна. Redis тут = лишний round-trip на каждое сообщение = **хуже** топов по латентности.
3. **Слои не нарушаем** (E3): интерфейсы (`RateLimiter`, `MessageCache`) — в `contracts`; реализации на `ioredis` — в новом `packages/cache`; инъекция в bot/worker. `core` остаётся без инфра-зависимостей.
4. **Идемпотентность — состоянием БД** (E5): `isActive`/`deactivate` и `endedAt: null`. Redis-лок НЕ вводим — он нужен только при нескольких worker-инстансах (Блок 2+).

---

## Изменения схемы (Prisma) — нужны до реализации

```prisma
// GuildSettings — добавить:
muteRoleId           String?   // роль-мьют для длительностей > 28 дней
logIgnoredChannels   Json   @default("[]")   // каналы, исключённые из логов
logChannelOverrides  Json   @default("{}")   // { "messageDelete": "channelId", ... } — маршрутизация события в свой канал

// Giveaway — добавить requirements (планка GiveawayBot):
requiredRoleId       String?   // вход только с этой ролью
boosterOnly          Boolean @default(false)
minLevel             Int?      // мин. XP-уровень для входа
```

Поля Mute/Ban уже есть: `expiresAt` (`Ban.expiresAt` nullable = вечный), `isActive`, `duration Int /*минуты*/`.

---

## Задача 0.1 — Инфраструктура: `packages/cache` (Redis)

**Новый пакет** `packages/cache` (между `database` и `bot` по порядку зависимостей):
- `RedisClientFactory` — обёртка `ioredis`, graceful degradation (нет Redis → no-op + warn, бот живёт)
- `RedisMessageCache implements MessageCache` (интерфейс из contracts): `set(msg, ttl)`, `get(msgId)`, `bulkGet(ids)`. TTL ~7 дней. Хранит author/content/attachments.
- `RedisRateLimiter implements RateLimiter` (интерфейс из contracts): `consume(key, limit, windowSec)` атомарно через Lua.

**Прочее:** `infrastructure/docker-compose.yml` (+`redis:7-alpine`, persistence AOF), `.env.example` (+`REDIS_URL`).

**Приёмка:** `docker compose up redis` поднимает; bot/worker коннектятся; Redis down → деградация без падений.

---

## Задача 0.2 — Worker: durable-действия (Wick/GiveawayBot grade)

**Контракты (E4-корректно):**
- `MuteRepository.findExpired(): Promise<MuteDto[]>` → `where: { expiresAt: { lte: now }, isActive: true }`
- `BanRepository.findExpired(): Promise<BanDto[]>` → `where: { expiresAt: { not: null, lte: now }, isActive: true }` — **исключить null (вечные)**
- Реализации в `packages/database`.

**Worker-инфра:** `apps/worker` — deps (`contracts`, `database`, `cache`, `discord.js` REST, `node-cron`, `@sentry/node`); `container.ts` (Prisma + репо + REST + cache); `main.ts` (Sentry, cron, graceful shutdown).

**Job `ProcessBanExpiry` (🔴 истинно критичный — у temp-бана нет нативного авто-снятия):**
- `findExpired()` → `REST DELETE guildBan` → `deactivate(id)`
- Аудит в mod-log: «Бан истёк, кейс #N»; идемпотентно если разбанен вручную (404 → просто `deactivate`)

**Job `ProcessMuteExpiry` (E2 — корректная роль обработки):**
- Таймаут-мьюты Discord снимает сам → здесь чистим `isActive` + (если `member` имеет mute-роль) снимаем роль
- **>28 дней:** при выдаче мьюта таймаут капается; worker до-снимает mute-роль по `expiresAt`. Без worker длинный мьют завис бы — вот реальная польза job
- Аудит «Мьют истёк, кейс #N»

**Job `ProcessGiveawayEnd` (GiveawayBot grade):**
- `findExpired()` (уже идемпотентно, `endedAt: null`) → `pickWinners()` → `end(id, winners)`
- Правка сообщения: «🎉 Завершён», список победителей; пинг + DM победителям
- `pickWinners` вынести в общий `core` util (используется и сервисом, и worker — снимает дублирование)

**Приёмка:** temp-бан снят ≤60c; длинный мьют (>28д) снят по сроку; гив завершён точно, победители выбраны/упомянуты/получили DM; повтор не дублирует; падение одной гильдии не роняет worker (per-item try/catch).

---

## Задача 0.3 — Логирование уровня Carl-bot

**Кэш сообщений (ключевое отличие от черновика, решает E7):**
- `messageCreate` (уже есть) дополнительно пишет сообщение в `MessageCache` (Redis)
- На `messageDelete`/`messageUpdate` тянем «до»-версию из кэша → лог показывает **контент и дифф**, даже если сообщения нет в Discord-кэше. Это и есть Carl-bot-грейд.

**Покрытие событий (планка — полный аудит, не 4 штуки):**
| Событие Discord | LogEvent | Деталь |
|---|---|---|
| messageDelete | messageDelete | автор, канал, контент из кэша |
| messageDeleteBulk | messageBulkDelete | кол-во, канал |
| messageUpdate | messageEdit | before→after дифф |
| guildMemberAdd | join | + возраст аккаунта (анти-рейд сигнал) |
| guildMemberRemove | leave | + список ролей на момент выхода |
| guildMemberUpdate | nick/roles | смена ника/ролей |
| guildBanAdd / Remove | ban / unban | внешние (не через бота) |
| channelCreate/Delete/Update | channel* | имя, тип |
| roleCreate/Delete/Update | role* | имя, права |
| voiceStateUpdate | voiceJoin/Leave/Move | канал |

**Маршрутизация:** `logChannelOverrides` (событие → свой канал) с fallback на `logChannelId`; `logIgnoredChannels` исключает каналы (напр. спам-канал). Каждое событие гейтится `logEvents`.

**Партиалы/кэш (E7-точно):** `Partials.Message` (есть ✅) даёт событию сработать; контент берём из **нашего** Redis-кэша, не из Discord. Нет в кэше → «контент недоступен».

**Приёмка:** удаление/правка показывают контент из кэша; bulk-delete, role/channel/voice/member-update логируются; ignore-каналы исключены; маршрутизация в свой канал работает; не хуже набора событий Carl-bot.

---

## Задача 0.4 — Anti-abuse (rate-limiting)

**Слои (E3):** интерфейс `RateLimiter` в `contracts`; `RedisRateLimiter` в `packages/cache`; конфиг `apps/bot/src/lib/rateLimitConfig.ts`.

**Двухуровнево:**
- **Per-guild действия** (большинство) — допустимо in-memory per-shard (одна гильдия = один шард)
- **Глобальные per-user** (кросс-гильдийный абьюз, напр. спам команд с одного аккаунта по многим серверам) — **Redis** (кросс-шардово)

**Лимиты (черновик):**
| Категория | Лимит | Окно | Уровень |
|---|---|---|---|
| Модерация (staff) | без лимита | — | — |
| Азартные | 1 | 3 c | per-guild |
| Кнопки (giveaway_join и т.п.) | 3 | 10 c | per-guild |
| Общие команды | 1 | 2 c | per-guild |
| Глобальный анти-спам | 20 | 60 c | **global (Redis)** |
| daily/work/crime/rob | persisted cooldown в БД | — | — |

**Внедрение:** `interactionCreate.ts` — перед `execute()` и обработкой кнопок: `consume()` → отказ = ephemeral «⏳ Слишком часто, подожди Ns». **XP-cooldown не трогаем** (остаётся in-memory, E1).

**Приёмка:** превышение → ephemeral с `retryAfter`, команда не выполняется; глобальный лимит делится между шардами; Redis down → fallback in-memory + warn.

---

## Файловый манифест

- **Contracts:** `RateLimiter`, `MessageCache` (интерфейсы); `MuteRepository`/`BanRepository` (+`findExpired`); `GiveawayDto` (+requirements-поля)
- **Database:** `MuteRepositoryImpl`/`BanRepositoryImpl` (+`findExpired`); миграция схемы (GuildSettings + Giveaway поля)
- **packages/cache (НОВЫЙ):** `RedisClientFactory`, `RedisMessageCache`, `RedisRateLimiter`
- **Core:** `common/giveaway/pickWinners.ts` (вынос из сервиса)
- **Worker:** `package.json`, `container.ts`, `main.ts`, `jobs/ProcessBanExpiry.ts`, `jobs/ProcessMuteExpiry.ts`, `jobs/ProcessGiveawayEnd.ts`
- **Bot:** `events/messageDelete.ts`, `messageUpdate.ts`, `messageDeleteBulk.ts`, `guildMemberUpdate.ts`, `channelLog.ts`, `roleLog.ts`, `voiceLog.ts`, `guildBanLog.ts`; `lib/rateLimitConfig.ts`; обновить `messageCreate.ts` (запись в кэш), `main.ts`, `interactionCreate.ts`
- **Infra:** `docker-compose.yml` (+redis), `.env.example` (+REDIS_URL)

## Тесты (цель 80%+ нового кода)
- `pickWinners` — распределение, N победителей, пустой пул
- `RedisRateLimiter` — окно/лимит/fallback (фейковый Redis)
- `findExpired` Mute/Ban — фильтр `isActive` + nullable `expiresAt`
- Логика выбора лог-канала (override → fallback, ignore)
- Giveaway requirements — отказ входа без роли/буста/уровня

## Открытые вопросы (сокращено)
1. Лимиты 0.4 — числа ОК или правим?
2. DM победителям/при истечении наказания — включаем по умолчанию или опцией в GuildSettings?
3. TTL кэша сообщений — 7 дней ОК? (память Redis vs глубина истории логов)

## Порядок
0.1 cache-пакет + Redis → 0.2 worker → 0.3 логи (зависят от MessageCache) → 0.4 rate-limit.
Миграцию схемы — первым шагом 0.1.
