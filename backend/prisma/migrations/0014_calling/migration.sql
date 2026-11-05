-- DropIndex
DROP INDEX "PushToken_profileId_token_key";

-- AlterTable
ALTER TABLE "PushToken" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'expo';

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "callerProfileId" TEXT NOT NULL,
    "calleeProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ringing',
    "roomName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_conversationId_createdAt_idx" ON "Call"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Call_calleeProfileId_status_idx" ON "Call"("calleeProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_profileId_token_type_key" ON "PushToken"("profileId", "token", "type");
