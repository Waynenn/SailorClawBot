# SailorClawBot: Tier-1 Technical Strategy

**Статус:** Foundation Phase → Production Ready  
**Целевой горизонт:** Q2-Q3 2026  
**Масштабируемость:** 200 → 500 → 5K → 100K серверов

---

## I. Архитектурное видение

### A. Layered Dependency Model (Immutable)

```
┌─────────────────────────────────────────────────────────────┐
│                    dashboard (UI Layer)                      │
├─────────────────────────────────────────────────────────────┤
│                    bot (Discord.js Integration)              │
├─────────────────────────────────────────────────────────────┤
│   worker (Queue: Bull/Redis, Retry, DLQ, Scheduled Jobs)   │
├─────────────────────────────────────────────────────────────┤
│  database (Prisma ORM, Repositories, Migrations, Seeds)    │
├─────────────────────────────────────────────────────────────┤
│      core (Domain Services, Errors, EventBus, Logger)       │
├─────────────────────────────────────────────────────────────┤
│   contracts (DTOs, Interfaces, Events, Repository Specs)    │
└─────────────────────────────────────────────────────────────┘
```

**Правило:** Lower layers NEVER import from higher layers.

### B. Service Boundaries (Domain-Driven Design)

```
┌─ Moderation Service
│  ├─ Warning management
│  ├─ Mute/Unmute with expiry
│  ├─ Ban/Unban tracking
│  ├─ Case management (full audit trail)
│  └─ Permissions validation (role-based)
│
├─ Economy Service
│  ├─ Wallet operations (add, subtract, transfer)
│  ├─ Transaction history
│  ├─ Leaderboard computation
│  ├─ Currency decay/inflation logic
│  └─ Payday scheduling
│
├─ Ticket Service
│  ├─ Ticket lifecycle (open → assign → resolve → close)
│  ├─ Channel management
│  ├─ Member access control
│  ├─ Notification routing
│  └─ Rating/Feedback
│
├─ Level/XP Service
│  ├─ XP assignment & tracking
│  ├─ Level up notifications
│  ├─ Leaderboard rankings
│  └─ Role assignment on level up
│
├─ Guild Configuration Service
│  ├─ Settings persistence
│  ├─ Role mapping (muted role, moderator role, etc.)
│  ├─ Channel configuration
│  └─ Feature flags per guild
│
└─ Logging/Audit Service
   ├─ Moderation action logging
   ├─ Economy transaction logging
   ├─ Member action logging
   └─ Query audit trail
```

---

## II. Data Model (Prisma Schema)

### Core Entities

**Guild** — Discord server record
- id (Snowflake)
- name, icon, region
- prefix, locale, timezone
- createdAt, updatedAt

**Profile** — User per-guild identity
- id (CUID)
- guildId, userId (Snowflake)
- displayName, bio
- joinedAt

**Wallet** — Per-user per-guild currency
- id (CUID)
- guildId, userId
- balance (BigInt for precision)
- createdAt, updatedAt

**Moderation Models**
- **Warning**: guildId, userId, reason, moderatorId, createdAt
- **Mute**: guildId, userId, duration, moderatorId, expiresAt, createdAt
- **Ban**: guildId, userId, reason, moderatorId, createdAt
- **Case**: id, caseNumber, guildId, type, userId, actionId, createdAt

**Economy Models**
- **Transaction**: id, walletId, amount, reason, createdAt
- **DailyStreaks**: userId, guildId, currentStreak, lastClaimedAt
- **RoleRewards**: guildId, roleId, reward (amount), triggered_on_role_add

**Ticket System**
- **Ticket**: id, guildId, openerId, channelId, status (open|assigned|closed), createdAt, closedAt
- **TicketAssignment**: ticketId, assignedToUserId, assignedAt

**Logging**
- **AuditLog**: id, guildId, action, targetId, actorId, changes (JSON), timestamp
- **ErrorLog**: id, service, error, stackTrace, timestamp
- **RateLimitLog**: id, userId, action, guildId, timestamp

**Guild Configuration**
- **GuildSettings**: guildId, prefix, locale, modLogChannelId, ticketCategoryId, etc.
- **RoleMapping**: guildId, roleType (muted|mod|ticket_handler), roleId
- **PermissionOverride**: guildId, userId, permission, allowed (boolean)

---

## III. Service Layers

### 3.1 Core Services (Business Logic)

#### ModerationService
```typescript
// Responsibilities
- Validate permissions (user is moderator)
- Execute warnings, mutes, bans
- Compute mute expiry, schedule job
- Log all actions to AuditLog
- Emit events (moderation.warned, moderation.muted, moderation.banned)
- Return case number for tracking

// Example
async warnUser(guildId, userId, reason, moderatorId): Promise<Warning>
  - Validate moderator permissions
  - Create Warning record
  - Increment warning count
  - Emit moderation.warned event
  - If warnings >= 3, auto-mute
```

#### EconomyService
```typescript
// Responsibilities
- Manage wallet balance (add, subtract, transfer)
- Log transactions
- Compute leaderboards (cached)
- Handle role-based rewards
- Enforce max balance caps per guild

// Example
async transferBalance(fromUserId, toUserId, amount, guildId): Promise<Transaction>
  - Fetch both wallets
  - Validate sender balance
  - Deduct from sender, add to recipient
  - Create Transaction record
  - Emit economy.transferred event
  - Update leaderboard cache
```

#### TicketService
```typescript
// Responsibilities
- Create tickets in designated category
- Route to support team
- Track resolution time
- Handle channel cleanup
- Manage access control

// Example
async openTicket(guildId, userId, subject): Promise<Ticket>
  - Fetch guild settings
  - Create channel in ticketCategory
  - Create Ticket record
  - Emit ticket.opened event
  - Notify support team
```

### 3.2 Repository Layer

**Principle:** Hide Prisma details. Expose clean interfaces.

```typescript
// Example: ProfileRepository
async findByGuildAndUser(guildId, userId): Promise<ProfileDto | null>
async create(input): Promise<ProfileDto>
async update(id, changes): Promise<ProfileDto>
async deleteByGuildAndUser(guildId, userId): Promise<void>

// All implementations in packages/database/src/repositories
```

### 3.3 Event Bus

**Pattern:** Domain Events published by services, consumed by workers/webhooks.

```typescript
interface DomainEvent {
  id: string
  name: EventName
  aggregateId: string
  payload: unknown
  occurredAt: Date
  version: number
}

// Events
- moderation.warned
- moderation.muted
- moderation.unmuted
- moderation.banned
- economy.transferred
- economy.wallet_created
- ticket.opened
- ticket.closed
- guild.registered
- member.joined
```

---

## IV. Worker Queue Strategy

### Async Job Processing

**Queue:** Bull (Redis-backed)

```
┌─ ModerationQueue
│  ├─ ProcessMuteExpiry (scheduled every 1min)
│  ├─ NotifyModerationAction (async)
│  └─ CleanupExpiredBans
│
├─ EconomyQueue
│  ├─ ProcessDailyPayday (scheduled)
│  ├─ UpdateLeaderboard (scheduled every 5min)
│  └─ ClaimDailyReward
│
└─ TicketQueue
   ├─ SendTicketNotification
   ├─ CloseInactiveTickets (scheduled)
   └─ SendSatisfactionSurvey
```

**Retry Policy:**
- Attempt 1: immediate
- Attempt 2: 5 seconds
- Attempt 3: 30 seconds
- Attempt 4: 2 minutes
- Failure → DLQ (manual intervention required)

**Dead Letter Queue:** Manual review + alerting

---

## V. Caching Strategy

### Redis Cache Layers

```
┌─ L1: Command-level (in-memory, 30s)
│  ├─ leaderboard:{guildId}
│  ├─ guild_config:{guildId}
│  └─ user_profile:{guildId}:{userId}
│
├─ L2: Application-level (Redis, 5min)
│  ├─ moderation:cases:{guildId}
│  ├─ economy:daily_rewards:{userId}
│  └─ permissions:{guildId}:{userId}
│
└─ L3: Database layer (never cache)
   └─ Individual records (on-demand only)
```

**Cache Invalidation:**
- TTL-based for stateless data (config, leaderboards)
- Event-based for critical data (wallet balance)
- Manual for admin operations

---

## VI. Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Command latency** | < 200ms p95 | Discord interaction timeout = 3s |
| **Leaderboard query** | < 100ms | Cached, refreshed every 5min |
| **Ban/Mute execution** | < 500ms | Async notification OK |
| **Database query** | < 50ms p99 | With proper indexing |
| **Uptime** | 99.9% | 8.76 hours downtime/year max |
| **Error rate** | < 0.1% | Per million operations |
| **Guild onboarding** | < 2s | Full profile + config setup |

---

## VII. Security Model

### Authentication & Authorization

```
┌─ Discord OAuth2 (dashboard only)
│  └─ User identifies as Discord user
│
├─ Discord Bot Token (bot account)
│  └─ Authenticated via TOKEN env var
│
└─ Role-Based Access Control (RBAC)
   ├─ GuildOwner
   ├─ Moderator (configurable role)
   ├─ TicketHandler (configurable role)
   ├─ Member (everyone else)
   └─ Viewer (logged out)
```

### Audit Trail

**Every moderation action logged:**
- Actor (moderator ID)
- Action (warn, mute, ban, case reviewed)
- Target (user ID)
- Reason + metadata
- Timestamp
- IP (if admin dashboard)

**Retention:** 90 days minimum, archival after

### Input Validation

```typescript
// All user input validated before processing
- Command arguments (zod schemas)
- Webhook payloads (signature verification)
- Database writes (TypeScript strict mode)
- API requests (openapi3 schemas)
```

---

## VIII. Disaster Recovery

### Backup Strategy
- Database: Daily snapshots (7 day retention)
- Configuration: Git-tracked in version control
- Secrets: Encrypted in vault (HashiCorp/1Password)

### Incident Response
- Health checks: Prometheus + Alertmanager
- On-call rotation: If uptime < 99.5%
- Runbook: docs/RUNBOOKS/
- RTO: 15 minutes (for non-data-loss incidents)
- RPO: 1 hour (max data loss)

---

## IX. Observability Stack

### Logging
- **Structured:** Winston (JSON format)
- **Aggregation:** ELK Stack (Elasticsearch) or Datadog
- **Levels:** DEBUG, INFO, WARN, ERROR, CRITICAL

### Metrics
- **Collection:** Prometheus
- **Visualization:** Grafana
- **Dashboards:**
  - Operational (request rates, errors, latency)
  - Business (guilds, users, transactions)
  - Infrastructure (CPU, memory, connections)

### Tracing
- **Standard:** OpenTelemetry
- **Sampling:** 10% of requests in production
- **Export:** Jaeger (local) → Datadog (production)

---

## X. Scaling Roadmap

### Stage 1: Single Shard (0-2500 guilds)
- Single Discord.js bot instance
- Single worker instance
- Single Postgres instance (with replicas for HA)
- Redis single node

### Stage 2: Multiple Shards (2500-10K guilds)
- ShardingManager with 4-8 shards
- Dedicated worker clusters (4+ instances)
- Postgres: Primary + 2 read replicas
- Redis: Cluster mode or sentinel

### Stage 3: Distributed (10K-100K guilds)
- Full sharding (16+ shards)
- Worker farm (auto-scaling groups)
- Postgres: Partitioned (by guildId range)
- Redis: Full cluster
- Message queue (RabbitMQ) for inter-service communication

---

## XI. Success Metrics

### Business KPIs
- Guilds onboarded: 200 → 500 → 5K → 100K
- Daily active users: +10% MoM
- Retention: 85%+ after 30 days
- Rating: 4.8+/5 on top bot sites

### Technical SLOs
- Availability: 99.9%
- Latency (p99): < 500ms
- Error rate: < 0.1%
- Deployment frequency: 1x/week
- Lead time for changes: < 1 day

---

## XII. Phase Breakdown

| Phase | Duration | Deliverables | Status |
|-------|----------|--------------|--------|
| **Phase 0** | 1 week | Foundation, architecture | ✅ DONE |
| **Phase 1** | 2 weeks | Contracts, services, repos | 🔄 IN PROGRESS |
| **Phase 2** | 3 weeks | Bot integration, 20 commands | ⏳ NEXT |
| **Phase 3** | 2 weeks | Worker queues, scheduled jobs | ⏳ NEXT |
| **Phase 4** | 2 weeks | Caching, optimization, testing | ⏳ NEXT |
| **Phase 5** | 2 weeks | Dashboard MVP | ⏳ NEXT |
| **Phase 6** | 2 weeks | Monitoring, observability | ⏳ NEXT |
| **Phase 7** | 2 weeks | Security hardening, load test | ⏳ NEXT |
| **Phase 8** | 1 week | Production launch prep | ⏳ NEXT |

---

## XIII. Non-Negotiables

❌ **NEVER DO:**
- Cyclic dependencies (will break at runtime)
- Business logic in bot layer (untestable)
- Hardcoded configuration (use environment variables)
- Direct Prisma usage outside database package
- Synchronous I/O without timeout
- Unvalidated user input
- Secrets in code or logs

✅ **ALWAYS DO:**
- Run validation before merge: `pnpm install && pnpm build && pnpm prisma validate`
- Update docs when you change architecture
- Write tests for new services
- Log errors with context
- Use TypeScript strict mode
- Follow conventional commits
- Review code for security issues
- Test rate limiting + permission checks

---

**Next:** Phase 1 kickoff with Repository implementations.
