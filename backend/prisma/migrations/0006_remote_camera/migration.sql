CREATE TABLE "RemoteCameraRequest" (
    "id" TEXT NOT NULL,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "RemoteCameraRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RemoteCameraRequest_toProfileId_status_idx" ON "RemoteCameraRequest"("toProfileId", "status");
CREATE INDEX "RemoteCameraRequest_fromProfileId_idx" ON "RemoteCameraRequest"("fromProfileId");

CREATE TABLE "RemoteCameraSession" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "granterId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "RemoteCameraSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RemoteCameraSession_requestId_key" ON "RemoteCameraSession"("requestId");
CREATE INDEX "RemoteCameraSession_granterId_status_idx" ON "RemoteCameraSession"("granterId", "status");
CREATE INDEX "RemoteCameraSession_requesterId_status_idx" ON "RemoteCameraSession"("requesterId", "status");
