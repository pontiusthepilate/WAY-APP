-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "eventCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "eventLocation" TEXT,
ADD COLUMN     "eventStartsAt" TIMESTAMP(3),
ADD COLUMN     "eventTitle" TEXT;

-- CreateIndex
CREATE INDEX "Post_type_eventStartsAt_idx" ON "Post"("type", "eventStartsAt");
