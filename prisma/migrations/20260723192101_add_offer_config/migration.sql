-- CreateTable
CREATE TABLE "OfferConfig" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT,
    "variantId" TEXT,
    "productTitle" TEXT,
    "productImage" TEXT,
    "productPrice" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" REAL,
    "headline" TEXT NOT NULL DEFAULT 'Wait — one more thing!',
    "description" TEXT NOT NULL DEFAULT 'Add this to your order before you go.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
