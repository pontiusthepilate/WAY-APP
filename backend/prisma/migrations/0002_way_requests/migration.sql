CREATE TABLE "WayRequest" (
    "id" TEXT NOT NULL,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "text" TEXT,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WayRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WayRequest_fromProfileId_idx" ON "WayRequest"("fromProfileId");
CREATE INDEX "WayRequest_toProfileId_idx" ON "WayRequest"("toProfileId");
