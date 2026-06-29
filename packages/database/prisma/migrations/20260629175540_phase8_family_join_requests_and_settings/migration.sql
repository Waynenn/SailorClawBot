-- CreateTable
CREATE TABLE "BlackjackSession" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "bet" BIGINT NOT NULL,
    "playerCards" JSONB NOT NULL,
    "dealerCards" JSONB NOT NULL,
    "deck" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackjackSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyJoinRequest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlackjackSession_guildId_userId_idx" ON "BlackjackSession"("guildId", "userId");

-- CreateIndex
CREATE INDEX "FamilyJoinRequest_guildId_userId_idx" ON "FamilyJoinRequest"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyJoinRequest_familyId_userId_key" ON "FamilyJoinRequest"("familyId", "userId");

-- AddForeignKey
ALTER TABLE "FamilyJoinRequest" ADD CONSTRAINT "FamilyJoinRequest_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
