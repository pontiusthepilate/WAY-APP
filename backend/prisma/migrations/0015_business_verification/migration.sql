-- CreateTable
CREATE TABLE "BusinessVerificationRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "rcNumber" TEXT NOT NULL,
    "companyType" TEXT NOT NULL,
    "documentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lookupSource" TEXT,
    "lookupResult" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "escalatedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessVerificationRequest_profileId_submittedAt_idx" ON "BusinessVerificationRequest"("profileId", "submittedAt");

-- CreateIndex
CREATE INDEX "BusinessVerificationRequest_status_submittedAt_idx" ON "BusinessVerificationRequest"("status", "submittedAt");
