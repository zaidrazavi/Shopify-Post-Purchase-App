-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferConfig" (
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT,
    "variantId" TEXT,
    "productTitle" TEXT,
    "productImage" TEXT,
    "productPrice" TEXT,
    "productCompareAtPrice" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" DOUBLE PRECISION,
    "headline" TEXT NOT NULL DEFAULT 'Wait — one more thing!',
    "description" TEXT NOT NULL DEFAULT 'Add this to your order before you go.',
    "countdownEnabled" BOOLEAN NOT NULL DEFAULT false,
    "countdownMinutes" INTEGER NOT NULL DEFAULT 10,
    "acceptButtonText" TEXT NOT NULL DEFAULT 'Add This Gift To My Order',
    "declineButtonText" TEXT NOT NULL DEFAULT 'I''d rather pay full price',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferConfig_pkey" PRIMARY KEY ("shop")
);

