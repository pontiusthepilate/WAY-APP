CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Wallet_profileId_key" ON "Wallet"("profileId");
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WalletBalance" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WalletBalance_walletId_currency_key" ON "WalletBalance"("walletId", "currency");
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "counterpartyProfileId" TEXT,
    "method" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Transaction_walletId_createdAt_idx" ON "Transaction"("walletId", "createdAt");
CREATE INDEX "Transaction_walletId_counterpartyProfileId_idx" ON "Transaction"("walletId", "counterpartyProfileId");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
