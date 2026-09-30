CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushToken_profileId_token_key" ON "PushToken"("profileId", "token");
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiveSession_status_idx" ON "LiveSession"("status");
CREATE INDEX "LiveSession_profileId_createdAt_idx" ON "LiveSession"("profileId", "createdAt");
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LiveChatMessage" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiveChatMessage_liveSessionId_createdAt_idx" ON "LiveChatMessage"("liveSessionId", "createdAt");
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_liveSessionId_fkey"
    FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
