-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "commentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "likesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sharesCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "episodeId" TEXT;

-- CreateTable
CREATE TABLE "EpisodeLike" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeComment" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpisodeLike_profileId_idx" ON "EpisodeLike"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeLike_episodeId_profileId_key" ON "EpisodeLike"("episodeId", "profileId");

-- CreateIndex
CREATE INDEX "EpisodeComment_episodeId_createdAt_idx" ON "EpisodeComment"("episodeId", "createdAt");

-- AddForeignKey
ALTER TABLE "EpisodeLike" ADD CONSTRAINT "EpisodeLike_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeComment" ADD CONSTRAINT "EpisodeComment_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
