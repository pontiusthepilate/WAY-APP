-- CreateTable
CREATE TABLE "WalletFraudFlag" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "counterpartyProfileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletFraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletFraudFlag_profileId_idx" ON "WalletFraudFlag"("profileId");

-- CreateIndex
CREATE INDEX "WalletFraudFlag_status_idx" ON "WalletFraudFlag"("status");
