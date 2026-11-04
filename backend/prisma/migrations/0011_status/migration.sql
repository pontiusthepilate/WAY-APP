-- CreateTable
CREATE TABLE "Status" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "caption" TEXT,
    "backgroundColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Status_profileId_expiresAt_idx" ON "Status"("profileId", "expiresAt");
