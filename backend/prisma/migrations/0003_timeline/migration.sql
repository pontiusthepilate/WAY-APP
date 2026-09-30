CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "caption" TEXT,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Post_profileId_createdAt_idx" ON "Post"("profileId", "createdAt");
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
ALTER TABLE "Post" ADD CONSTRAINT "Post_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Like" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Like_postId_profileId_key" ON "Like"("postId", "profileId");
CREATE INDEX "Like_profileId_idx" ON "Like"("profileId");
ALTER TABLE "Like" ADD CONSTRAINT "Like_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
