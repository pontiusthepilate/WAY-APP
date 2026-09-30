CREATE TABLE "PaystackPayment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    CONSTRAINT "PaystackPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaystackPayment_reference_key" ON "PaystackPayment"("reference");
CREATE INDEX "PaystackPayment_profileId_idx" ON "PaystackPayment"("profileId");
