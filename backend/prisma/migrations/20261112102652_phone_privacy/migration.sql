-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "discoverableByPhone" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sharePhoneNumber" BOOLEAN NOT NULL DEFAULT false;
