-- CreateTable
CREATE TABLE "Store" (
    "shop" TEXT NOT NULL,
    "storeName" TEXT,
    "storeEmail" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "currentPlan" TEXT NOT NULL DEFAULT 'FREE',
    "monthlyRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shopifyShopId" TEXT,
    "ownerEmail" TEXT,
    "welcomeDismissed" BOOLEAN NOT NULL DEFAULT false,
    "prePurchaseSettings" JSONB,
    "postPurchaseSettings" JSONB,
    "thankYouSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("shop")
);

-- CreateTable
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Funnel',
    "type" TEXT NOT NULL DEFAULT 'post-purchase',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "triggerType" TEXT NOT NULL DEFAULT 'all-products',
    "triggerValue" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "abTestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "variantBSplit" INTEGER NOT NULL DEFAULT 50,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
    "dateStart" TIMESTAMP(3),
    "dateEnd" TIMESTAMP(3),
    "customerTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'upsell',
    "section" TEXT NOT NULL DEFAULT 'product-page',
    "position" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "variantId" TEXT,
    "headline" TEXT NOT NULL DEFAULT 'Special Offer!',
    "description" TEXT NOT NULL DEFAULT '',
    "buttonText" TEXT NOT NULL DEFAULT 'Add to Order',
    "declineText" TEXT NOT NULL DEFAULT 'No thanks',
    "imageUrl" TEXT,
    "price" DECIMAL(10,2),
    "compareAtPrice" DECIMAL(10,2),
    "discountType" TEXT,
    "discountValue" DECIMAL(10,2),
    "timerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "timerDuration" INTEGER NOT NULL DEFAULT 15,
    "timerMessage" TEXT NOT NULL DEFAULT 'Offer expires in:',
    "buttonColor" TEXT NOT NULL DEFAULT '#EF4444',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "badgeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "badgeText" TEXT NOT NULL DEFAULT 'Best Value',
    "badgeColor" TEXT NOT NULL DEFAULT '#10b981',
    "layout" TEXT NOT NULL DEFAULT 'vertical',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "variantBHeadline" TEXT,
    "variantBDescription" TEXT,
    "variantBButtonText" TEXT,
    "variantBImpressions" INTEGER NOT NULL DEFAULT 0,
    "variantBConversions" INTEGER NOT NULL DEFAULT 0,
    "variantBRevenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "trafficSplit" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "funnelId" TEXT,
    "offerId" TEXT,
    "variantId" TEXT,
    "orderId" TEXT,
    "customerId" TEXT,
    "revenue" DECIMAL(10,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Billing" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "chargeId" TEXT,
    "plan" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "billingOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Billing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Funnel_shop_idx" ON "Funnel"("shop");

-- CreateIndex
CREATE INDEX "Funnel_status_idx" ON "Funnel"("status");

-- CreateIndex
CREATE INDEX "Offer_funnelId_idx" ON "Offer"("funnelId");

-- CreateIndex
CREATE INDEX "Event_shop_type_createdAt_idx" ON "Event"("shop", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_funnelId_idx" ON "Event"("funnelId");

-- CreateIndex
CREATE INDEX "Event_offerId_idx" ON "Event"("offerId");

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "Billing_shop_idx" ON "Billing"("shop");

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Store"("shop") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Store"("shop") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_shop_fkey" FOREIGN KEY ("shop") REFERENCES "Store"("shop") ON DELETE CASCADE ON UPDATE CASCADE;

