-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "messagePrivacy" TEXT NOT NULL DEFAULT 'everyone',
ADD COLUMN     "notifyCalls" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyCameraRequests" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyFollows" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLikes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyLive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWayRequests" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);
