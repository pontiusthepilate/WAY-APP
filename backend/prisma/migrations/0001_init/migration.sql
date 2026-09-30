-- WAY: initial schema
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OtpCode_identifier_idx" ON "OtpCode"("identifier");

CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wayId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayPictureUrl" TEXT,
    "bio" TEXT,
    "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "kind" TEXT NOT NULL DEFAULT 'personal',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "visibleToNearby" BOOLEAN NOT NULL DEFAULT true,
    "visibleToAddress" BOOLEAN NOT NULL DEFAULT true,
    "visibleToLocation" BOOLEAN NOT NULL DEFAULT true,
    "visibilityText" TEXT,
    "visibilityImageUrl" TEXT,
    "actualLat" DOUBLE PRECISION,
    "actualLng" DOUBLE PRECISION,
    "displayLat" DOUBLE PRECISION,
    "displayLng" DOUBLE PRECISION,
    "isLocationOverridden" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3),
    "location" geography(Point, 4326),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Profile_wayId_key" ON "Profile"("wayId");
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");
CREATE INDEX "Profile_location_gix" ON "Profile" USING GIST ("location");

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
