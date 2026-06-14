import { PrismaClient } from '@prisma/client';
import {
  GuildRepositoryImpl,
  GuildMemberRepositoryImpl,
  ProfileRepositoryImpl,
  WalletRepositoryImpl,
  TransactionRepositoryImpl,
  WarningRepositoryImpl,
  MuteRepositoryImpl,
  BanRepositoryImpl,
  CaseRepositoryImpl,
  PermissionRepositoryImpl,
  TicketRepositoryImpl,
  FamilyRepositoryImpl,
} from '@sailorclawbot/database';
import {
  GuildService,
  ProfileService,
  ModerationService,
  EconomyService,
  TicketService,
  FamilyService,
  PermissionService,
} from '@sailorclawbot/core';
import { ConsoleLogger } from './lib/ConsoleLogger.js';
import { InMemoryEventBus } from './lib/InMemoryEventBus.js';

function buildContainer() {
  const prisma = new PrismaClient();
  const logger = new ConsoleLogger();
  const eventBus = new InMemoryEventBus(logger);

  const guildRepo = new GuildRepositoryImpl(prisma);
  const guildMemberRepo = new GuildMemberRepositoryImpl(prisma);
  const profileRepo = new ProfileRepositoryImpl(prisma);
  const walletRepo = new WalletRepositoryImpl(prisma);
  const transactionRepo = new TransactionRepositoryImpl(prisma);
  const warningRepo = new WarningRepositoryImpl(prisma);
  const muteRepo = new MuteRepositoryImpl(prisma);
  const banRepo = new BanRepositoryImpl(prisma);
  const caseRepo = new CaseRepositoryImpl(prisma);
  const permissionRepo = new PermissionRepositoryImpl(prisma);
  const ticketRepo = new TicketRepositoryImpl(prisma);
  const familyRepo = new FamilyRepositoryImpl(prisma);

  const guildService = new GuildService(guildRepo, guildMemberRepo, eventBus, logger);
  const profileService = new ProfileService(profileRepo, eventBus, logger);
  const moderationService = new ModerationService(warningRepo, muteRepo, banRepo, caseRepo, permissionRepo, eventBus, logger);
  const economyService = new EconomyService(walletRepo, transactionRepo, eventBus, logger);
  const ticketService = new TicketService(ticketRepo, eventBus, logger);
  const familyService = new FamilyService(familyRepo, logger);
  const permissionService = new PermissionService(permissionRepo);

  return {
    prisma,
    logger,
    eventBus,
    guildService,
    profileService,
    moderationService,
    economyService,
    ticketService,
    familyService,
    permissionService,
  };
}

export type Container = ReturnType<typeof buildContainer>;

let _container: Container | null = null;

export function getContainer(): Container {
  if (!_container) {
    _container = buildContainer();
  }
  return _container;
}
