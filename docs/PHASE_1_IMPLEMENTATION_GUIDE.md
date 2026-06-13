# Phase 1: Implementation Guide
## SailorClawBot - Core Architecture (Weeks 1-2)

**Status:** Ready to implement  
**Duration:** 2 weeks (June 13-27)  
**Team:** Backend lead + 1-2 engineers

---

## Overview

Phase 1 expands the foundation with **business logic** and **data access layers**. This transforms the project from placeholders to functional architecture.

### Deliverables ✅

1. **Prisma Schema Expansion** — Complete data model
2. **Repository Implementations** — 7 repositories with full CRUD
3. **Core Services** — 6 services with business logic
4. **Domain Errors** — Type-safe error handling
5. **Event System** — Complete event catalog
6. **Tests** — Unit + integration tests (80%+ coverage)

### Success Criteria

```sh
✅ pnpm install && pnpm build  # No errors
✅ pnpm prisma generate       # All types generated
✅ pnpm test                  # 80%+ coverage
✅ No cyclic dependencies     # ESLint verification
✅ All services have unit tests
✅ All repositories have integration tests
```

---

## Step 1: Update Prisma Schema

**File:** `packages/database/prisma/schema.prisma`

The expanded schema includes:
- **Core entities:** Guild, Profile
- **Economy:** Wallet, Transaction, DailyStreak, RoleReward
- **Moderation:** Warning, Mute, Ban, Case
- **Tickets:** Ticket, TicketAssignment
- **Logging:** AuditLog, ErrorLog, RateLimitLog
- **Configuration:** GuildSettings, RoleMapping, PermissionOverride

**Action:**
1. Replace existing schema with [expanded version](./schema.prisma)
2. Run `pnpm prisma format` (auto-format)
3. Create migration: `pnpm prisma migrate dev --name initial_schema`
4. Verify: `pnpm prisma generate`

**Expected output:**
```
✔ Created migration migration_xxx_initial_schema
✔ Generated Prisma Client to .../node_modules/@prisma/client
```

---

## Step 2: Expand Contracts

### 2.1 Add Extended Types

**File:** `packages/contracts/src/types/extended.ts`

Contains DTOs for:
- ModerationDto (Warning, Mute, Ban, Case)
- EconomyDto (DailyStreak, RoleReward, Leaderboard)
- LoggingDto (AuditLog, ErrorLog)
- ConfigDto (GuildSettings, RoleMapping, PermissionOverride)

**Action:**
1. Create file from [extended.ts](./contracts-types-extended.ts)
2. Update `packages/contracts/src/index.ts`:

```typescript
export * from './types/extended.js';
```

### 2.2 Add Repository Interfaces

**File:** `packages/contracts/src/repositories/extended.ts`

Contains 12 repository interfaces:
- `WarningRepository`
- `MuteRepository`
- `BanRepository`
- `CaseRepository`
- `DailyStreakRepository`
- `RoleRewardRepository`
- `LeaderboardRepository`
- `TicketAssignmentRepository`
- `AuditLogRepository`
- `ErrorLogRepository`
- `GuildSettingsRepository`
- `RoleMappingRepository`
- `PermissionRepository`

**Action:**
1. Create file from [extended.ts](./contracts-repositories-extended.ts)
2. Update `packages/contracts/src/repositories/index.ts`:

```typescript
export * from './extended.js';
```

### 2.3 Expand EventNames

**File:** `packages/contracts/src/events/EventNames.ts`

Add all domain events for moderation, economy, tickets, leveling, config, and logging.

**Action:**
1. Replace with [expanded EventNames](./events-eventnames.ts)

### 2.4 Verify Contracts Build

```sh
cd packages/contracts
pnpm build
# Should complete with no errors
```

---

## Step 3: Implement Repository Interfaces

**Location:** `packages/database/src/repositories/`

Each repository file implements the interface from contracts. Use Prisma client for database operations.

### Example: WarningRepositoryImpl.ts

```typescript
import { PrismaClient } from '@prisma/client';
import type { WarningRepository, WarningDto, SnowflakeId } from '@sailorclawbot/contracts';

export class WarningRepositoryImpl implements WarningRepository {
  constructor(private db: PrismaClient) {}

  async findById(id: string): Promise<WarningDto | null> {
    const warning = await this.db.warning.findUnique({ where: { id } });
    return warning ?? null;
  }

  async findByGuildAndUser(guildId: SnowflakeId, userId: SnowflakeId): Promise<WarningDto[]> {
    return this.db.warning.findMany({
      where: { guildId, userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getNextCaseNumber(guildId: SnowflakeId): Promise<number> {
    const last = await this.db.warning.findFirst({
      where: { guildId },
      orderBy: { caseNumber: 'desc' }
    });
    return (last?.caseNumber ?? 0) + 1;
  }

  async create(input: Omit<WarningDto, 'id' | 'createdAt'>): Promise<WarningDto> {
    return this.db.warning.create({
      data: input
    });
  }

  async count(guildId: SnowflakeId, userId: SnowflakeId): Promise<number> {
    return this.db.warning.count({ where: { guildId, userId } });
  }
}
```

### Repositories to Implement

| File | Interface | Complexity |
|------|-----------|-----------|
| `GuildRepositoryImpl.ts` | GuildRepository | ✅ Easy |
| `ProfileRepositoryImpl.ts` | ProfileRepository | ✅ Easy |
| `WalletRepositoryImpl.ts` | WalletRepository | ✅ Easy |
| `TransactionRepositoryImpl.ts` | TransactionRepository | ✅ Easy |
| `WarningRepositoryImpl.ts` | WarningRepository | ⚠️ Medium |
| `MuteRepositoryImpl.ts` | MuteRepository | ⚠️ Medium |
| `BanRepositoryImpl.ts` | BanRepository | ⚠️ Medium |
| `CaseRepositoryImpl.ts` | CaseRepository | ⚠️ Medium |
| `TicketRepositoryImpl.ts` | TicketRepository | ⚠️ Medium |
| `GuildSettingsRepositoryImpl.ts` | GuildSettingsRepository | ✅ Easy |
| `AuditLogRepositoryImpl.ts` | AuditLogRepository | ✅ Easy |

**Action:**
1. Create all 11 implementation files
2. Use transactions for multi-step operations (e.g., ban + case creation)
3. Add proper error handling (Prisma exceptions)

### Test Repositories

```typescript
// packages/database/tests/integration/repositories.test.ts
describe('GuildRepository', () => {
  let db: PrismaClient;
  let repo: GuildRepository;

  beforeAll(async () => {
    db = new PrismaClient();
    repo = new GuildRepositoryImpl(db);
  });

  it('should create and find guild', async () => {
    const guild = await repo.create({
      id: '123456789',
      name: 'Test Guild'
    });

    expect(guild.id).toBe('123456789');
    expect(guild.name).toBe('Test Guild');

    const found = await repo.findById('123456789');
    expect(found).toEqual(guild);
  });
});
```

---

## Step 4: Create Core Services

**Location:** `packages/core/src/services/`

Services contain business logic. They orchestrate repositories and emit events.

### Example: ModerationService

```typescript
import type {
  WarningRepository,
  CaseRepository,
  PermissionRepository,
  SnowflakeId
} from '@sailorclawbot/contracts';
import { EventBus, DomainError } from '@sailorclawbot/core';

export class ModerationService {
  constructor(
    private warnings: WarningRepository,
    private cases: CaseRepository,
    private permissions: PermissionRepository,
    private eventBus: EventBus
  ) {}

  async warnUser(
    guildId: SnowflakeId,
    userId: SnowflakeId,
    reason: string,
    moderatorId: SnowflakeId
  ) {
    // Validate permission
    const hasPermission = await this.validateModeratorPermission(guildId, moderatorId);
    if (!hasPermission) {
      throw new PermissionDeniedError('User is not a moderator');
    }

    // Get next case number
    const caseNumber = await this.warnings.getNextCaseNumber(guildId);

    // Create warning
    const warning = await this.warnings.create({
      guildId,
      userId,
      reason,
      moderatorId,
      caseNumber
    });

    // Create case record
    await this.cases.create({
      guildId,
      caseNumber,
      type: 'warning',
      userId,
      moderatorId,
      action: warning.id,
      reason
    });

    // Emit event
    await this.eventBus.publish({
      name: 'moderation.warned',
      payload: { userId, guildId, reason, caseNumber },
      occurredAt: new Date()
    });

    return warning;
  }

  private async validateModeratorPermission(
    guildId: SnowflakeId,
    userId: SnowflakeId
  ): Promise<boolean> {
    // Will implement with permission service
    return true;
  }
}
```

### Services to Create

| Service | Methods | Complexity |
|---------|---------|-----------|
| `ModerationService` | warnUser, muteUser, unmuteUser, banUser, getCases | ⚠️ Medium |
| `EconomyService` | addBalance, transferBalance, getLeaderboard, claimDaily | ⚠️ Medium |
| `TicketService` | openTicket, assignTicket, closeTicket | ✅ Easy |
| `GuildConfigService` | getSettings, updateSettings, getRoleMapping | ✅ Easy |
| `PermissionService` | hasPermission, validateRole, isModeratorRole | ✅ Easy |
| `AuditService` | logAction, logError, getHistory | ✅ Easy |

### Test Services

```typescript
// packages/core/tests/unit/ModerationService.test.ts
describe('ModerationService', () => {
  let service: ModerationService;
  let mockWarnings: jest.Mocked<WarningRepository>;
  let mockCases: jest.Mocked<CaseRepository>;

  beforeEach(() => {
    mockWarnings = {
      findById: jest.fn(),
      findByGuildAndUser: jest.fn(),
      getNextCaseNumber: jest.fn().resolves(1),
      create: jest.fn(),
      count: jest.fn()
    };

    service = new ModerationService(mockWarnings, mockCases, ...);
  });

  it('should warn user and create case', async () => {
    await service.warnUser('guild1', 'user1', 'spam', 'mod1');

    expect(mockWarnings.create).toHaveBeenCalled();
    expect(mockCases.create).toHaveBeenCalled();
  });
});
```

---

## Step 5: Add Error Handling

**Location:** `packages/core/src/domain/errors/`

Create domain-specific errors:

```typescript
// DomainError.ts
export class DomainError extends Error {
  constructor(code: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

// PermissionDeniedError.ts
export class PermissionDeniedError extends DomainError {
  constructor(message: string) {
    super('PERMISSION_DENIED', message);
    this.name = 'PermissionDeniedError';
  }
}

// ValidationError.ts
export class ValidationError extends DomainError {
  constructor(message: string, public field?: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

// NotFoundError.ts
export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}
```

Update `packages/core/src/index.ts`:
```typescript
export * from './domain/errors/DomainError.js';
export * from './domain/errors/PermissionDeniedError.js';
export * from './domain/errors/ValidationError.js';
export * from './domain/errors/NotFoundError.js';
```

---

## Step 6: Setup Testing Framework

### Install Jest

```sh
cd /root/sailorclawbot
pnpm add -D -w jest @types/jest ts-jest
```

### Create jest.config.js

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages', '<rootDir>/apps'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@sailorclawbot/(.*)$': '<rootDir>/packages/$1'
  },
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/index.ts'
  ],
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70
    }
  }
};
```

### Run Tests

```sh
pnpm test  # Run all tests
pnpm test --coverage  # With coverage report
```

---

## Step 7: Validation Checklist

Before moving to Phase 2, verify:

### Architecture ✅

- [ ] No cyclic dependencies (run `pnpm build`)
- [ ] All repositories implement their interfaces
- [ ] All services depend on repositories via DI
- [ ] EventBus is injected (not created in services)

### Code Quality ✅

- [ ] TypeScript strict mode compiles (no `any`)
- [ ] All public methods have JSDoc comments
- [ ] Error handling in all service methods
- [ ] Proper transaction boundaries for multi-step operations

### Testing ✅

- [ ] All repositories have integration tests
- [ ] All services have unit tests (with mocks)
- [ ] Test coverage > 80%
- [ ] All edge cases covered (null, empty, duplicates)

### Documentation ✅

- [ ] README.md updated with service descriptions
- [ ] API documentation (OpenAPI stubs)
- [ ] Error catalog documented
- [ ] Database schema documented

### Deployment ✅

- [ ] Migration generated and tested
- [ ] No data loss in migration
- [ ] Rollback strategy documented
- [ ] Env vars documented

---

## Timeline Breakdown

### Day 1-2: Preparation
- [ ] Expand Prisma schema
- [ ] Create migrations
- [ ] Expand contracts (types + repositories)
- [ ] Setup error hierarchy

**End-of-day test:**
```sh
pnpm build  # Should succeed
pnpm prisma generate  # Types generated
```

### Day 3-6: Repository Implementation
- [ ] Implement 11 repository classes
- [ ] Write integration tests
- [ ] Handle Prisma errors gracefully

**End-of-week test:**
```sh
pnpm test -- repositories  # All passing
```

### Day 7-10: Service Implementation
- [ ] Implement 6 core services
- [ ] Add EventBus calls
- [ ] Write unit tests (with mocks)

**End-of-week test:**
```sh
pnpm test -- services  # All passing, 80%+ coverage
```

### Day 11-14: Validation & Polish
- [ ] ESLint configuration
- [ ] Pre-commit hooks
- [ ] Documentation updates
- [ ] Code review + fixes

**Final validation:**
```sh
pnpm install && pnpm build && pnpm test --coverage
# Coverage: 80%+
# No errors
# Ready for Phase 2
```

---

## Common Pitfalls

### ❌ Mistake: Repositories call other repositories

```typescript
// WRONG
class WarningRepository {
  async warnUser() {
    this.caseRepository.createCase(...);  // ❌ Cross-repository call
  }
}
```

**Fix:** Let services orchestrate, not repositories.

```typescript
// RIGHT
class ModerationService {
  async warnUser() {
    const warning = await this.warnings.create(...);
    await this.cases.create(...);  // ✅ Service orchestrates
  }
}
```

### ❌ Mistake: Services call other services

```typescript
// WRONG
class ModerationService {
  async warnUser() {
    this.auditService.log(...);  // ❌ Service coupling
  }
}
```

**Fix:** Use EventBus instead.

```typescript
// RIGHT
class ModerationService {
  async warnUser() {
    await this.eventBus.publish({
      name: 'moderation.warned',
      payload: {...}
    });
  }
}
```

### ❌ Mistake: No error handling in repositories

```typescript
// WRONG
async create(input) {
  return this.db.warning.create({ data: input });  // ❌ Unhandled exceptions
}
```

**Fix:** Handle Prisma errors.

```typescript
// RIGHT
async create(input) {
  try {
    return this.db.warning.create({ data: input });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ValidationError('Duplicate warning');
      }
    }
    throw error;
  }
}
```

---

## Resources

- **Prisma Docs:** https://www.prisma.io/docs
- **TypeScript DI:** https://github.com/microsoft/tsyringe
- **Jest Docs:** https://jestjs.io/docs/getting-started
- **Domain-Driven Design:** https://martinfowler.com/bliki/DomainDrivenDesign.html

---

## Next Phase (Phase 2)

Once Phase 1 is complete (✅ merged):

1. **Discord.js Integration** — Bot scaffolding, event handlers
2. **Slash Commands** — 20 commands (moderation, economy, fun)
3. **Middleware** — Rate limiting, permissions, logging
4. **Error Handling** — User-friendly responses + logging

---

**Questions?** Post in #architecture channel.

**Status Check:** Meet every 2 days to verify progress against checklist.

**Deadline:** June 27, 2026 (Phase 1 complete)
