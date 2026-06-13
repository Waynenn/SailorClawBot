# SailorClawBot Phase 1 — File Index

**Updated:** 2026-06-13  
**Status:** Phase 0 complete → Phase 1 ready

---

## Documentation (read first)

| File | Purpose | When to read |
|------|---------|-------------|
| `docs/QUICK_START.md` | 5-step setup guide | Start here |
| `docs/SUMMARY_NEXT_STEPS.md` | Executive summary of Phase 1 | Before planning sprint |
| `docs/PHASE_1_IMPLEMENTATION_GUIDE.md` | Detailed step-by-step for 2-week execution | When starting implementation |
| `docs/TIER1_TECHNICAL_STRATEGY.md` | Architecture for 100K servers | Architecture review |
| `docs/REFINED_ROADMAP.md` | 16-week timeline to production | Project planning |
| `docs/MASTER_AUDIT_REPORT.md` | Full audit — risks, status, go/no-go | Risk management |

---

## Code files ready to copy into the repo

These files are in `docs/` and need to be copied to their destinations in `packages/`.

| File in docs/ | Copy destination | Action |
|---------------|-----------------|--------|
| `docs/00-contracts-types-extended.ts` | `packages/contracts/src/types/extended.ts` | Create new file |
| `docs/01-contracts-repositories-extended.ts` | `packages/contracts/src/repositories/extended.ts` | Create new file |
| `docs/02-events-eventnames.ts` | `packages/contracts/src/events/EventNames.ts` | **Replace** existing |
| `docs/03-WarningRepositoryImpl.ts` | Study pattern → `packages/database/src/repositories/WarningRepositoryImpl.ts` | Use as template |
| `docs/04-ModerationService.ts` | Study pattern → `packages/core/src/services/ModerationService.ts` | Use as template |

After copying: update `packages/contracts/src/index.ts` to export new files, then run `pnpm build`.

---

## Implementation order (Phase 1)

```
Day 1:
  1. Copy 00-contracts-types-extended.ts
  2. Copy 01-contracts-repositories-extended.ts
  3. Copy 02-events-eventnames.ts (replaces existing)
  4. Update packages/contracts/src/index.ts exports
  5. pnpm build → must pass

Day 2-3:
  6. Expand packages/database/prisma/schema.prisma
     (add Warning, Mute, Ban, Case, DailyStreak, RoleReward, AuditLog, ErrorLog, GuildSettings, etc.)
  7. pnpm prisma migrate dev --name initial_schema
  8. pnpm prisma generate

Day 3-7:
  9. Implement 11 repositories (follow docs/03-WarningRepositoryImpl.ts pattern)
  10. Write integration tests alongside each repository

Day 8-14:
  11. Implement 6 core services (follow docs/04-ModerationService.ts pattern)
  12. Write unit tests alongside each service

Day 14:
  13. pnpm test --coverage (must be 80%+)
  14. pnpm build (must pass)
  15. Phase 1 sign-off
```

---

## Repositories to implement (11 total)

1. GuildRepositoryImpl *(interfaces exist in contracts)*
2. ProfileRepositoryImpl
3. WalletRepositoryImpl
4. TransactionRepositoryImpl
5. FamilyRepositoryImpl
6. TicketRepositoryImpl
7. WarningRepositoryImpl *(see docs/03-WarningRepositoryImpl.ts)*
8. MuteRepositoryImpl
9. BanRepositoryImpl
10. CaseRepositoryImpl
11. GuildSettingsRepositoryImpl

## Services to implement (6 total)

1. ModerationService *(see docs/04-ModerationService.ts)*
2. EconomyService
3. TicketService
4. GuildConfigService
5. PermissionService
6. AuditService

---

## Verification checklist

### After Day 1

- [ ] `pnpm build` passes with no TypeScript errors
- [ ] New types exported from `packages/contracts/src/index.ts`

### After schema migration (Day 3)

- [ ] `pnpm prisma migrate dev` creates migration file
- [ ] `pnpm prisma generate` succeeds

### End of Phase 1

- [ ] 11 repositories implemented with integration tests
- [ ] 6 services implemented with unit tests
- [ ] `pnpm test --coverage` shows 80%+
- [ ] `pnpm build` passes
- [ ] No cyclic dependencies
