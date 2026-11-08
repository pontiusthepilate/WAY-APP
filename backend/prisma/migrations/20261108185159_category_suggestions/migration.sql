-- CreateTable
CREATE TABLE "CategorySuggestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "suggestedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "CategorySuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategorySuggestion_status_createdAt_idx" ON "CategorySuggestion"("status", "createdAt");
