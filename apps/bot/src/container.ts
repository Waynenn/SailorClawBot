import { PrismaClient } from '@prisma/client';
import {
  GuildRepositoryImpl,
  GuildMemberRepositoryImpl,
  GuildSettingsRepositoryImpl,
  LevelRoleRepositoryImpl,
  NoXpTargetRepositoryImpl,
  ProfileRepositoryImpl,
  WalletRepositoryImpl,
  TransactionRepositoryImpl,
  WarningRepositoryImpl,
  MuteRepositoryImpl,
  BanRepositoryImpl,
  CaseRepositoryImpl,
  PermissionRepositoryImpl,
  RoleMappingRepositoryImpl,
  TicketRepositoryImpl,
  FamilyRepositoryImpl,
  TwitchSubscriptionRepositoryImpl,
  XpMultiplierRepositoryImpl,
  ItemRepositoryImpl,
  InventoryItemRepositoryImpl,
  AutoModRepositoryImpl,
  StaffNoteRepositoryImpl,
} from '@sailorclawbot/database';
import {
  GuildService,
  ProfileService,
  ModerationService,
  EconomyService,
  ShopService,
  InventoryService,
  TicketService,
  FamilyService,
  PermissionService,
  XpService,
  AutoModService,
} from '@sailorclawbot/core';
import { ConsoleLogger } from './lib/ConsoleLogger.js';
import { InMemoryEventBus } from './lib/InMemoryEventBus.js';

function buildContainer() {
  const prisma = new PrismaClient();
  const logger = new ConsoleLogger();
  const eventBus = new InMemoryEventBus(logger);

  const guildRepo = new GuildRepositoryImpl(prisma);
  const guildMemberRepo = new GuildMemberRepositoryImpl(prisma);
  const guildSettingsRepo = new GuildSettingsRepositoryImpl(prisma);
  const profileRepo = new ProfileRepositoryImpl(prisma);
  const walletRepo = new WalletRepositoryImpl(prisma);
  const transactionRepo = new TransactionRepositoryImpl(prisma);
  const warningRepo = new WarningRepositoryImpl(prisma);
  const muteRepo = new MuteRepositoryImpl(prisma);
  const banRepo = new BanRepositoryImpl(prisma);
  const caseRepo = new CaseRepositoryImpl(prisma);
  const permissionRepo = new PermissionRepositoryImpl(prisma);
  const roleMappingRepo = new RoleMappingRepositoryImpl(prisma);
  const ticketRepo = new TicketRepositoryImpl(prisma);
  const familyRepo = new FamilyRepositoryImpl(prisma);
  const levelRoleRepo = new LevelRoleRepositoryImpl(prisma);
  const xpMultiplierRepo = new XpMultiplierRepositoryImpl(prisma);
  const noXpTargetRepo = new NoXpTargetRepositoryImpl(prisma);
  const twitchSubRepo = new TwitchSubscriptionRepositoryImpl(prisma);
  const itemRepo = new ItemRepositoryImpl(prisma);
  const inventoryItemRepo = new InventoryItemRepositoryImpl(prisma);
  const autoModRepo = new AutoModRepositoryImpl(prisma);
  const staffNoteRepo = new StaffNoteRepositoryImpl(prisma);

  const guildService = new GuildService(guildRepo, guildMemberRepo, eventBus, logger);
  const profileService = new ProfileService(profileRepo, eventBus, logger);
  const moderationService = new ModerationService(warningRepo, muteRepo, banRepo, caseRepo, permissionRepo, eventBus, logger, staffNoteRepo);
  const economyService = new EconomyService(walletRepo, transactionRepo, eventBus, logger);
  const shopService = new ShopService(itemRepo, inventoryItemRepo, walletRepo, transactionRepo, eventBus, logger);
  const inventoryService = new InventoryService(inventoryItemRepo, logger);
  const ticketService = new TicketService(ticketRepo, eventBus, logger);
  const familyService = new FamilyService(familyRepo, logger);
  const permissionService = new PermissionService(permissionRepo, roleMappingRepo);
  const xpService = new XpService(profileRepo, eventBus, logger);
  const autoModService = new AutoModService();

  return {
    prisma,
    logger,
    eventBus,
    guildService,
    profileService,
    moderationService,
    economyService,
    shopService,
    inventoryService,
    ticketService,
    familyService,
    permissionService,
    xpService,
    guildSettingsRepo,
    levelRoleRepo,
    xpMultiplierRepo,
    noXpTargetRepo,
    twitchSubRepo,
    itemRepo,
    autoModRepo,
    autoModService,
    staffNoteRepo,
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
