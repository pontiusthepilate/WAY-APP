-- AlterTable
ALTER TABLE "Follow" ADD COLUMN     "isAutoFollow" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "defaultLabel" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;
