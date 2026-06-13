# SailorClawBot: Refined Roadmap (16 weeks → Production)

**Baseline:** June 13, 2026  
**Target Launch:** Early September 2026 (200+ servers)

---

## 🎯 Phase Breakdown

### **PHASE 0: Foundation** ✅ COMPLETE
**Duration:** Week 0 (June 1-13)  
**Deliverables:**
- [x] Monorepo structure (Turbo, pnpm)
- [x] TypeScript configuration
- [x] Prisma + PostgreSQL setup
- [x] Docker infrastructure
- [x] Basic contracts (DTOs, events)
- [x] Validation pipeline (install → build → prisma)

**Completion Criteria:**
```sh
✅ pnpm install
✅ pnpm build
✅ pnpm prisma validate
✅ pnpm prisma generate
```

**Owner:** Architecture  
**Status:** ✅ MERGED

---

### **PHASE 1: Core Architecture** 🔄 CURRENT
**Duration:** Weeks 1-2 (June 13-27)  
**Sprint:** 2 weeks

**Deliverables:**

#### 1.1 Prisma Schema Expansion
- [ ] Add Moderation models (Warning, Mute, Ban, Case)
- [ ] Add Economy models (Transaction, DailyStreak, RoleReward)
- [ ] Add Ticket models (Ticket, TicketAssignment)
- [ ] Add Guild Configuration models (GuildSettings, RoleMapping)
- [ ] Add Logging models (AuditLog, ErrorLog, RateLimitLog)
- [ ] Create comprehensive indexes for production queries
- [ ] Add composite unique constraints

**Files:**
- `packages/database/prisma/schema.prisma` (EXPAND)
- `packages/database/prisma/migrations/001_initial_schema.sql`

#### 1.2 Repository Implementations
- [ ] `GuildRepositoryImpl` — Guild CRUD + settings
- [ ] `ProfileRepositoryImpl` — User profiles per guild
- [ ] `WalletRepositoryImpl` — Balance operations + transaction history
- [ ] `ModerationRepositoryImpl` — Warnings, mutes, bans, cases
- [ ] `TicketRepositoryImpl` — Ticket lifecycle
- [ ] `GuildSettingsRepositoryImpl` — Configuration storage
- [ ] `AuditLogRepositoryImpl` — Action logging

**Files:**
```
packages/database/src/repositories/
├── GuildRepositoryImpl.ts
├── ProfileRepositoryImpl.ts
├── WalletRepositoryImpl.ts
├── ModerationRepositoryImpl.ts
├── TicketRepositoryImpl.ts
├── GuildSettingsRepositoryImpl.ts
└── AuditLogRepositoryImpl.ts
```

#### 1.3 Core Service Interfaces
- [ ] `ModerationService` — Warn, mute, ban, case management
- [ ] `EconomyService` — Wallet operations, transactions, leaderboards
- [ ] `TicketService` — Ticket lifecycle management
- [ ] `GuildConfigService` — Settings persistence + retrieval
- [ ] `PermissionService` — RBAC validation
- [ ] `AuditService` — Action logging

**Files:**
```
packages/core/src/services/
├── ModerationService.ts
├── EconomyService.ts
├── TicketService.ts
├── GuildConfigService.ts
├── PermissionService.ts
└── AuditService.ts
```

#### 1.4 Domain Event Expansion
- [ ] Expand `EventNames` with all domain events
- [ ] Define event payloads (TypeScript interfaces)
- [ ] Event publishing strategy (EventBus)

**Files:**
- `packages/contracts/src/events/EventNames.ts` (EXPAND)
- `packages/contracts/src/events/EventPayloads.ts` (NEW)

#### 1.5 Error Handling & Validation
- [ ] Domain-specific errors (ValidationError, PermissionDeniedError, etc.)
- [ ] Zod schemas for all DTOs
- [ ] Input validation in services

**Files:**
- `packages/core/src/domain/errors/` (NEW)
- `packages/contracts/src/validation/schemas.ts` (NEW)

**Testing:**
- [ ] Unit tests for repositories (mocked DB)
- [ ] Unit tests for services (mocked repositories)
- [ ] Integration tests (with test DB)

**Completion Criteria:**
```sh
✅ pnpm build — no TypeScript errors
✅ pnpm test — 80%+ coverage on core services
✅ pnpm prisma generate — types generated
✅ All repositories implement their interfaces
✅ No cyclic dependencies
```

**Owner:** Backend Lead  
**Status:** 🔄 IN PROGRESS (Start immediately)

---

### **PHASE 2: Discord Bot Integration** ⏳ NEXT
**Duration:** Weeks 3-5 (June 27 — July 18)  
**Sprint:** 3 weeks

**Deliverables:**

#### 2.1 Bot Scaffolding
- [ ] Discord.js client setup
- [ ] Intents configuration (GUILDS, GUILD_MEMBERS, MESSAGE_CONTENT)
- [ ] Event listener infrastructure
- [ ] Command handler framework
- [ ] Middleware pipeline (auth, rate-limit, permissions, logging)

**Files:**
```
apps/bot/src/
├── Bot.ts — Main client class
├── handlers/
│  ├── CommandHandler.ts
│  ├── EventHandler.ts
│  └── InteractionHandler.ts
├── middleware/
│  ├── AuthMiddleware.ts
│  ├── RateLimitMiddleware.ts
│  ├── PermissionMiddleware.ts
│  └── LoggingMiddleware.ts
└── utils/
   └── ErrorHandling.ts
```

#### 2.2 Guild Lifecycle
- [ ] `guildCreate` event → Register guild + create settings
- [ ] `guildDelete` event → Archive guild data
- [ ] `guildUpdate` event → Sync guild name/icon
- [ ] Slash command registration per guild

**Files:**
- `apps/bot/src/events/GuildEvents.ts`

#### 2.3 Core Commands (20 total)

**Moderation (5 commands):**
- [ ] `/warn @user <reason>` → ModerationService.warnUser()
- [ ] `/mute @user <duration>` → ModerationService.muteUser()
- [ ] `/unmute @user` → ModerationService.unmuteUser()
- [ ] `/ban @user <reason>` → ModerationService.banUser()
- [ ] `/cases [user]` → View moderation history

**Economy (5 commands):**
- [ ] `/balance` → Show wallet balance
- [ ] `/pay @user <amount>` → Transfer currency
- [ ] `/leaderboard` → Top 10 users (cached)
- [ ] `/daily` → Claim daily reward
- [ ] `/shop` → Browse purchasable roles

**Tickets (3 commands):**
- [ ] `/ticket create <subject>` → Open support ticket
- [ ] `/ticket close` → Close ticket + archive
- [ ] `/tickets` → List my tickets

**Fun (5 commands):**
- [ ] `/8ball <question>` → Magic 8 ball
- [ ] `/coin` → Flip coin
- [ ] `/roll <sides>` → Roll dice
- [ ] `/rps <choice>` → Rock-paper-scissors
- [ ] `/meme` → Random meme

**Admin (2 commands):**
- [ ] `/config` → Guild settings (owner only)
- [ ] `/stats` → Guild statistics

**Files:**
```
apps/bot/src/commands/
├── moderation/
│  ├── warn.ts
│  ├── mute.ts
│  ├── unmute.ts
│  ├── ban.ts
│  └── cases.ts
├── economy/
│  ├── balance.ts
│  ├── pay.ts
│  ├── leaderboard.ts
│  ├── daily.ts
│  └── shop.ts
├── tickets/
│  ├── create.ts
│  ├── close.ts
│  └── list.ts
└── fun/
   ├── 8ball.ts
   ├── coin.ts
   ├── roll.ts
   ├── rps.ts
   └── meme.ts
```

#### 2.4 Error Handling & Logging
- [ ] Try-catch wrappers for all commands
- [ ] User-friendly error messages
- [ ] Admin error logs to private channel
- [ ] Structured logging (Winston)

**Testing:**
- [ ] Integration tests with mocked Discord client
- [ ] Command parsing tests
- [ ] Permission validation tests
- [ ] Rate limit tests

**Completion Criteria:**
```sh
✅ pnpm build
✅ Bot can login to Discord
✅ 20 commands registered and functional
✅ Rate limiting works (max 5 commands/10s per user)
✅ Errors logged, no crashes
✅ Response time < 500ms for all commands
```

**Owner:** Bot Lead  
**Status:** ⏳ Starts Week 3

---

### **PHASE 3: Worker Queues & Async Jobs** ⏳ NEXT
**Duration:** Weeks 6-7 (July 18 — August 1)  
**Sprint:** 2 weeks

**Deliverables:**

#### 3.1 Bull Queue Setup
- [ ] Queue initialization (Redis backend)
- [ ] Job processor architecture
- [ ] Retry logic (exponential backoff)
- [ ] Dead Letter Queue (DLQ) handling
- [ ] Circuit breaker for DB failures

**Files:**
```
packages/worker/src/
├── queues/
│  ├── QueueFactory.ts
│  ├── ModerationQueue.ts
│  ├── EconomyQueue.ts
│  └── TicketQueue.ts
├── processors/
│  ├── ModerationProcessor.ts
│  ├── EconomyProcessor.ts
│  └─ TicketProcessor.ts
└── dlq/
   └── DeadLetterHandler.ts
```

#### 3.2 Async Jobs
- [ ] `ProcessMuteExpiry` — Check every 1 minute, unmute expired users
- [ ] `ProcessBanExpiry` — Check every 1 minute, unban expired bans
- [ ] `UpdateLeaderboard` — Refresh cache every 5 minutes
- [ ] `SendTicketReminder` — Notify unassigned tickets every 30 min
- [ ] `ProcessPayday` — Daily currency payout (scheduled)
- [ ] `CleanupExpiredData` — Archive old logs (weekly)

**Files:**
- `packages/worker/src/jobs/` — One file per job

#### 3.3 Scheduled Jobs
- [ ] Cron configuration (node-cron)
- [ ] Job state persistence
- [ ] Timezone support per guild

**Testing:**
- [ ] Job processor unit tests
- [ ] Retry logic tests
- [ ] DLQ tests

**Completion Criteria:**
```sh
✅ Queue processes 1000 jobs/minute
✅ Retry policy: 4 attempts over 3 minutes
✅ DLQ captures failed jobs (manual review)
✅ No data loss on queue shutdown
✅ Monitoring: job success rate > 99%
```

**Owner:** Infrastructure Lead  
**Status:** ⏳ Starts Week 6

---

### **PHASE 4: Caching & Performance** ⏳ NEXT
**Duration:** Week 8 (August 1-8)  
**Sprint:** 1 week

**Deliverables:**

#### 4.1 Redis Integration
- [ ] Redis client setup (ioredis)
- [ ] Cache layer abstraction
- [ ] TTL policies per data type
- [ ] Cache invalidation strategy

**Files:**
```
packages/database/src/cache/
├── CacheClient.ts
├─ policies/
│  ├─ LeaderboardPolicy.ts
│  ├─ GuildConfigPolicy.ts
│  └─ PermissionPolicy.ts
└─ invalidation/
   └─ CacheInvalidator.ts
```

#### 4.2 Cached Operations
- [ ] Leaderboard queries (5min TTL)
- [ ] Guild configuration (1hr TTL)
- [ ] Permission lookups (30min TTL)
- [ ] User profiles (15min TTL)

#### 4.3 Performance Optimization
- [ ] Database query optimization (indexes, selective fields)
- [ ] N+1 query detection & fixes
- [ ] Batch operations (upsertMany, etc.)
- [ ] Connection pooling (Prisma)

**Testing:**
- [ ] Load test: 1000 concurrent users
- [ ] Cache hit rate > 85%
- [ ] Query latency: p99 < 100ms

**Completion Criteria:**
```sh
✅ Leaderboard query: < 50ms (cached)
✅ Fresh leaderboard: < 500ms (DB query)
✅ Command latency: p95 < 200ms
✅ Cache memory usage: < 2GB for 5K guilds
```

**Owner:** Performance Lead  
**Status:** ⏳ Starts Week 8

---

### **PHASE 5: Testing & Quality** ⏳ NEXT
**Duration:** Weeks 9-10 (August 8-22)  
**Sprint:** 2 weeks

**Deliverables:**

#### 5.1 Test Suite
- [ ] Unit tests: 80%+ coverage for core services
- [ ] Integration tests: All repository operations
- [ ] E2E tests: Command flows with test Discord server
- [ ] Load testing: k6 scripts for production simulation

**Files:**
```
*/tests/ (per package)
├── __tests__/
│  ├── unit/ — Service logic tests
│  ├── integration/ — Repository tests with test DB
│  └── e2e/ — Full command flows
└── fixtures/ — Test data
```

#### 5.2 Security Audit
- [ ] Input validation tests
- [ ] Permission boundary tests
- [ ] SQL injection protection (Prisma auto)
- [ ] Rate limiting tests
- [ ] Audit log completeness

#### 5.3 Documentation
- [ ] API documentation (OpenAPI)
- [ ] Architecture diagrams
- [ ] Deployment guide
- [ ] Troubleshooting runbook

**Completion Criteria:**
```sh
✅ Core services: 80%+ test coverage
✅ No security vulnerabilities (OWASP top 10)
✅ Load test: 5000 guilds, 100K users, < 500ms p99
✅ All commands tested in real Discord server
```

**Owner:** QA Lead  
**Status:** ⏳ Starts Week 9

---

### **PHASE 6: Observability & Monitoring** ⏳ NEXT
**Duration:** Week 11 (August 22-29)  
**Sprint:** 1 week

**Deliverables:**

#### 6.1 Logging
- [ ] Winston setup (JSON structured logs)
- [ ] Log aggregation (ELK or Datadog)
- [ ] Log levels per service
- [ ] Error tracking (Sentry integration)

#### 6.2 Metrics
- [ ] Prometheus client setup
- [ ] Key metrics:
  - Request rate (per second)
  - Latency (p50, p95, p99)
  - Error rate (per service)
  - Queue depth (jobs pending)
  - Cache hit rate
  - Database connection pool stats

#### 6.3 Dashboards
- [ ] Grafana dashboards (3 total)
  - Operations: latency, errors, uptime
  - Business: guilds, users, transactions
  - Infrastructure: CPU, memory, connections

#### 6.4 Alerting
- [ ] Alert rules:
  - Error rate > 1%
  - Latency p95 > 500ms
  - Queue depth > 10000
  - Uptime < 99.5%
- [ ] Alert channels: Slack, PagerDuty

**Completion Criteria:**
```sh
✅ All services emit structured logs
✅ Prometheus scraping all metrics
✅ Grafana dashboards operational
✅ Alerts firing and routable
```

**Owner:** DevOps Lead  
**Status:** ⏳ Starts Week 11

---

### **PHASE 7: Dashboard & Admin UI** ⏳ NEXT
**Duration:** Weeks 12-13 (August 29 — September 12)  
**Sprint:** 2 weeks

**Deliverables:**

#### 7.1 Backend API
- [ ] REST API (Express or Fastify)
- [ ] Authentication (Discord OAuth2)
- [ ] RBAC for admin operations
- [ ] Rate limiting (API-level)
- [ ] OpenAPI 3.0 spec

#### 7.2 Frontend (React)
- [ ] Guild overview dashboard
- [ ] Moderation case management
- [ ] Leaderboard viewer
- [ ] Settings editor (guild config)
- [ ] Real-time notifications (WebSocket)

#### 7.3 Admin Functions
- [ ] View all guilds + stats
- [ ] Manual case review
- [ ] Currency adjustments (audit trail)
- [ ] Emergency commands (disable bot, etc.)

**Files:**
```
apps/dashboard/
├── backend/ (if API separate)
│  └── api/
│     ├── guilds/
│     ├── moderation/
│     ├── economy/
│     └── auth/
└── frontend/ (if included)
   └── pages/
      ├── /dashboard
      ├─ /moderation
      ├─ /economy
      └─ /settings
```

**Completion Criteria:**
```sh
✅ Dashboard loads in < 2s
✅ Admin can view all guilds + stats
✅ Guild owner can edit settings
✅ Case management functional
```

**Owner:** Frontend Lead  
**Status:** ⏳ Starts Week 12

---

### **PHASE 8: Production Hardening** ⏳ NEXT
**Duration:** Weeks 14-15 (September 12-26)  
**Sprint:** 2 weeks

**Deliverables:**

#### 8.1 Deployment
- [ ] Docker image optimization
- [ ] Kubernetes manifests (if scaling)
- [ ] Database migration strategy (rolling updates)
- [ ] Rollback procedures
- [ ] Secrets management (env vars)

#### 8.2 High Availability
- [ ] Database replication (primary + replica)
- [ ] Redis cluster (if needed)
- [ ] Load balancing (for multiple bot instances)
- [ ] Graceful shutdown handlers

#### 8.3 Disaster Recovery
- [ ] Database backups (automated, daily)
- [ ] Backup validation (test restore)
- [ ] RTO: 15 minutes
- [ ] RPO: 1 hour

#### 8.4 Security Hardening
- [ ] HTTPS for all APIs
- [ ] WAF rules (DDoS protection)
- [ ] Rate limiting at proxy level
- [ ] Secrets rotation
- [ ] Security headers (CORS, CSP, etc.)

**Completion Criteria:**
```sh
✅ Deploy to production with zero downtime
✅ Database backed up daily
✅ RTO/RPO targets met
✅ All security checks passed
✅ Uptime monitoring active
```

**Owner:** DevOps Lead  
**Status:** ⏳ Starts Week 14

---

### **PHASE 9: Launch Prep & Validation** ⏳ FINAL
**Duration:** Week 16 (September 26 — October 3)  
**Sprint:** 1 week

**Deliverables:**

#### 9.1 Pre-Launch Checklist
```
✅ All systems operational (bot, worker, dashboard)
✅ Monitoring active (metrics, logs, alerts)
✅ Backups tested (restore validation)
✅ Performance targets met (load testing passed)
✅ Security audit completed (no critical vulnerabilities)
✅ Team trained (runbooks, incident procedures)
✅ User documentation ready
```

#### 9.2 Soft Launch
- [ ] Internal guild (team + testers)
- [ ] Monitor for 24 hours
- [ ] Fix critical issues
- [ ] Gather feedback

#### 9.3 Public Launch
- [ ] Bot token activated
- [ ] Public Discord server
- [ ] Marketing prep
- [ ] Support channel setup

**Completion Criteria:**
```sh
✅ Bot live and accessible
✅ 200+ servers onboarded (first week)
✅ Uptime > 99.5%
✅ Error rate < 0.1%
✅ User feedback positive
```

**Owner:** Product Lead  
**Status:** ⏳ Starts Week 16

---

## 📊 Timeline Summary

```
Phase 0: ■■■■■ DONE         (Week 0)
Phase 1: ■■■■  IN PROGRESS  (Weeks 1-2)
Phase 2: ■■■■■ READY        (Weeks 3-5)
Phase 3: ■■■■  READY        (Weeks 6-7)
Phase 4: ■■    READY        (Week 8)
Phase 5: ■■■■  READY        (Weeks 9-10)
Phase 6: ■■    READY        (Week 11)
Phase 7: ■■■■  READY        (Weeks 12-13)
Phase 8: ■■■■  READY        (Weeks 14-15)
Phase 9: ■■    READY        (Week 16)

Total: 16 weeks to production
Deadline: September 26, 2026
Launch: October 3, 2026
```

---

## 🎖️ Success Metrics

### By Week 8 (Early August)
- ✅ Bot fully functional with 20 commands
- ✅ 50+ servers testing
- ✅ Performance targets met

### By Week 12 (Mid-September)
- ✅ Dashboard MVP live
- ✅ Monitoring + alerting active
- ✅ 200+ servers onboarded

### By Week 16 (Early October)
- ✅ Public launch
- ✅ 500+ servers
- ✅ 99.5%+ uptime
- ✅ < 0.1% error rate

---

## 🚀 Next Immediate Actions

1. **Today (June 13):** Kick off Phase 1
   - [ ] Expand Prisma schema
   - [ ] Start repository implementations
   - [ ] Create service interfaces

2. **By June 20:**
   - [ ] All repositories implemented
   - [ ] All core services working
   - [ ] 80%+ test coverage

3. **By June 27:**
   - [ ] Phase 1 complete
   - [ ] Phase 2 kickoff (bot integration)

---

**Owner:** Principal Architect  
**Last Updated:** June 13, 2026  
**Next Review:** June 20, 2026
