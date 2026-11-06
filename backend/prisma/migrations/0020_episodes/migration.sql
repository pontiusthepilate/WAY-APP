-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "playsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Episode_profileId_createdAt_idx" ON "Episode"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "Episode_createdAt_idx" ON "Episode"("createdAt");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

