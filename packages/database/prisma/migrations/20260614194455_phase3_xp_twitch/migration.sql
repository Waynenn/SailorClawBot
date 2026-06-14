-- CreateTable
CREATE TABLE "TwitchSubscription" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "twitchLogin" TEXT NOT NULL,
    "notifyChannelId" TEXT NOT NULL,
    "mentionRoleId" TEXT,
    "customMessage" TEXT,
    "lastStreamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitchSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwitchSubscription_guildId_idx" ON "TwitchSubscription"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchSubscription_guildId_twitchLogin_key" ON "TwitchSubscription"("guildId", "twitchLogin");
