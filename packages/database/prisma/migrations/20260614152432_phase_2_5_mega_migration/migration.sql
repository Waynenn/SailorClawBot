-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'OFFICER', 'MEMBER');

-- AlterEnum
ALTER TYPE "TicketStatus" ADD VALUE 'claimed';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalXp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedById" TEXT,
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "rating" INTEGER,
ADD COLUMN     "subject" TEXT;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "activeBoosts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "crimeUsesToday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyLimitReset" TIMESTAMP(3),
ADD COLUMN     "lastCrimeAt" TIMESTAMP(3),
ADD COLUMN     "lastDailyAt" TIMESTAMP(3),
ADD COLUMN     "lastRobAt" TIMESTAMP(3),
ADD COLUMN     "lastWorkAt" TIMESTAMP(3),
ADD COLUMN     "workUsesToday" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" TEXT NOT NULL,
    "ticketCategoryId" TEXT,
    "ticketChannelId" TEXT,
    "ticketStatsMessageId" TEXT,
    "ticketLogChannelId" TEXT,
    "welcomeChannelId" TEXT,
    "welcomeMessage" TEXT,
    "leaveChannelId" TEXT,
    "leaveMessage" TEXT,
    "welcomeDm" BOOLEAN NOT NULL DEFAULT false,
    "xpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "xpMin" INTEGER NOT NULL DEFAULT 15,
    "xpMax" INTEGER NOT NULL DEFAULT 25,
    "xpCooldown" INTEGER NOT NULL DEFAULT 60,
    "levelUpChannelId" TEXT,
    "levelUpDm" BOOLEAN NOT NULL DEFAULT false,
    "levelUpMessage" TEXT,
    "starboardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "starboardChannelId" TEXT,
    "starboardThreshold" INTEGER NOT NULL DEFAULT 3,
    "logChannelId" TEXT,
    "logEvents" JSONB NOT NULL DEFAULT '[]',
    "embedColors" JSONB NOT NULL DEFAULT '{}',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "currencyName" TEXT NOT NULL DEFAULT 'coins',
    "currencyEmoji" TEXT NOT NULL DEFAULT '🪙',
    "dailyAmount" BIGINT NOT NULL DEFAULT 100,
    "startingBalance" BIGINT NOT NULL DEFAULT 0,
    "workMin" BIGINT NOT NULL DEFAULT 50,
    "workMax" BIGINT NOT NULL DEFAULT 200,
    "crimeMin" BIGINT NOT NULL DEFAULT 100,
    "crimeMax" BIGINT NOT NULL DEFAULT 500,
    "gamblingMinBet" BIGINT NOT NULL DEFAULT 10,
    "gamblingMaxBet" BIGINT NOT NULL DEFAULT 10000,
    "robMinTargetBalance" BIGINT NOT NULL DEFAULT 100,
    "treasuryBalance" BIGINT NOT NULL DEFAULT 0,
    "transferTaxPercent" INTEGER NOT NULL DEFAULT 5,
    "shopTaxPercent" INTEGER NOT NULL DEFAULT 0,
    "dailyWorkLimit" INTEGER NOT NULL DEFAULT 3,
    "dailyCrimeLimit" INTEGER NOT NULL DEFAULT 2,
    "workDiminishingFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "crimeDiminishingFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "familyCreationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxFamilies" INTEGER,
    "maxFamilyMembers" INTEGER NOT NULL DEFAULT 20,
    "familyRequireApproval" BOOLEAN NOT NULL DEFAULT false,
    "familyCreationMode" TEXT NOT NULL DEFAULT 'coins',
    "familyCreationCost" BIGINT NOT NULL DEFAULT 5000,
    "familyNameChangeCost" BIGINT NOT NULL DEFAULT 2000,

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "RoleMapping" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "RoleMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "LevelRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpMultiplier" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "XpMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoXpTarget" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,

    CONSTRAINT "NoXpTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" BIGINT NOT NULL,
    "emoji" TEXT,
    "type" TEXT NOT NULL,
    "effect" JSONB,
    "stock" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoModRule" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,

    CONSTRAINT "AutoModRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "ReactionRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "prize" TEXT NOT NULL,
    "winnersCount" INTEGER NOT NULL DEFAULT 1,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "hostId" TEXT NOT NULL,
    "participants" JSONB NOT NULL DEFAULT '[]',
    "winners" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarboardEntry" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "originalMsgId" TEXT NOT NULL,
    "starboardMsgId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "starCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StarboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleMapping_guildId_roleId_idx" ON "RoleMapping"("guildId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleMapping_guildId_roleId_permission_key" ON "RoleMapping"("guildId", "roleId", "permission");

-- CreateIndex
CREATE INDEX "LevelRole_guildId_idx" ON "LevelRole"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "LevelRole_guildId_level_key" ON "LevelRole"("guildId", "level");

-- CreateIndex
CREATE INDEX "XpMultiplier_guildId_idx" ON "XpMultiplier"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "XpMultiplier_guildId_targetId_targetType_key" ON "XpMultiplier"("guildId", "targetId", "targetType");

-- CreateIndex
CREATE INDEX "NoXpTarget_guildId_idx" ON "NoXpTarget"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "NoXpTarget_guildId_targetId_key" ON "NoXpTarget"("guildId", "targetId");

-- CreateIndex
CREATE INDEX "Item_guildId_idx" ON "Item"("guildId");

-- CreateIndex
CREATE INDEX "InventoryItem_guildId_userId_idx" ON "InventoryItem"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_guildId_userId_itemId_key" ON "InventoryItem"("guildId", "userId", "itemId");

-- CreateIndex
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_guildId_userId_key" ON "FamilyMember"("guildId", "userId");

-- CreateIndex
CREATE INDEX "AutoModRule_guildId_idx" ON "AutoModRule"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoModRule_guildId_type_key" ON "AutoModRule"("guildId", "type");

-- CreateIndex
CREATE INDEX "ReactionRole_guildId_messageId_idx" ON "ReactionRole"("guildId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ReactionRole_guildId_messageId_emoji_key" ON "ReactionRole"("guildId", "messageId", "emoji");

-- CreateIndex
CREATE INDEX "Giveaway_guildId_idx" ON "Giveaway"("guildId");

-- CreateIndex
CREATE INDEX "Giveaway_endsAt_idx" ON "Giveaway"("endsAt");

-- CreateIndex
CREATE INDEX "StarboardEntry_guildId_idx" ON "StarboardEntry"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "StarboardEntry_guildId_originalMsgId_key" ON "StarboardEntry"("guildId", "originalMsgId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE INDEX "UserAchievement_guildId_userId_idx" ON "UserAchievement"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_guildId_userId_achievementId_key" ON "UserAchievement"("guildId", "userId", "achievementId");

-- CreateIndex
CREATE INDEX "Family_guildId_idx" ON "Family"("guildId");

-- CreateIndex
CREATE INDEX "Profile_guildId_totalXp_idx" ON "Profile"("guildId", "totalXp");

-- CreateIndex
CREATE INDEX "Ticket_guildId_status_idx" ON "Ticket"("guildId", "status");

-- CreateIndex
CREATE INDEX "Ticket_guildId_openedByUserId_idx" ON "Ticket"("guildId", "openedByUserId");

-- AddForeignKey
ALTER TABLE "GuildSettings" ADD CONSTRAINT "GuildSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
