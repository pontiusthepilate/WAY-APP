-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "sharePhoneNumber";

-- AlterTable
ALTER TABLE "WayRequest" ADD COLUMN     "fromSharesPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "toSharesPhone" BOOLEAN NOT NULL DEFAULT false;
