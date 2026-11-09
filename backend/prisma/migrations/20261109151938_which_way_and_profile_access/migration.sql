-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "profileAccessRequestId" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "autoGrantAccessToBusiness" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoGrantAccessToPersonal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoGrantAccessToPodcast" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoGrantAccessViaAddress" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoGrantAccessViaLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoGrantAccessViaNearby" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyProfileAccessRequests" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whichWay" TEXT;

-- AlterTable
ALTER TABLE "WayRequest" ADD COLUMN     "discoveredVia" TEXT;

-- CreateTable
CREATE TABLE "ProfileAccessRequest" (
    "id" TEXT NOT NULL,
    "fromProfileId" TEXT NOT NULL,
    "toProfileId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileAccessRequest_fromProfileId_idx" ON "ProfileAccessRequest"("fromProfileId");

-- CreateIndex
CREATE INDEX "ProfileAccessRequest_toProfileId_status_idx" ON "ProfileAccessRequest"("toProfileId", "status");
