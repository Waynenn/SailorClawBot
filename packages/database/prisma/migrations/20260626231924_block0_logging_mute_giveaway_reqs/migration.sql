-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN     "boosterOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minLevel" INTEGER,
ADD COLUMN     "requiredRoleId" TEXT;

-- AlterTable
ALTER TABLE "GuildSettings" ADD COLUMN     "logChannelOverrides" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "logIgnoredChannels" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "minAccountAgeDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "muteRoleId" TEXT,
ADD COLUMN     "raidAutoLock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "raidJoinsPerMinute" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "verificationEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationMode" TEXT NOT NULL DEFAULT 'button',
ADD COLUMN     "verificationRoleId" TEXT;

-- CreateTable
CREATE TABLE "StaffNote" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffNote_guildId_userId_idx" ON "StaffNote"("guildId", "userId");
