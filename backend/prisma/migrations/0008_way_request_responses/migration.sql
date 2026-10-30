-- Add respondedAt (set when a WayRequest is accepted/declined) and swap the
-- plain toProfileId index for a compound (toProfileId, status) index, matching
-- RemoteCameraRequest's shape now that the incoming-inbox query filters on both.
ALTER TABLE "WayRequest" ADD COLUMN "respondedAt" TIMESTAMP(3);

DROP INDEX "WayRequest_toProfileId_idx";

CREATE INDEX "WayRequest_toProfileId_status_idx" ON "WayRequest"("toProfileId", "status");
