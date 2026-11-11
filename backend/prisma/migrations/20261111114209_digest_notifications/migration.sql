-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "lastDigestSentAt" TIMESTAMP(3),
ADD COLUMN     "notifyDigest" BOOLEAN NOT NULL DEFAULT true;
