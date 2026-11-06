-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "sharedFromPostId" TEXT;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_sharedFromPostId_fkey" FOREIGN KEY ("sharedFromPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

