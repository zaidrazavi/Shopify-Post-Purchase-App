-- AlterTable
ALTER TABLE "OfferConfig" ADD COLUMN     "downsellAcceptButtonText" TEXT NOT NULL DEFAULT 'Yes, Add This To My Order',
ADD COLUMN     "downsellDeclineButtonText" TEXT NOT NULL DEFAULT 'No thanks',
ADD COLUMN     "downsellDescription" TEXT NOT NULL DEFAULT 'A smaller add-on at a special price.',
ADD COLUMN     "downsellDiscountType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "downsellDiscountValue" DOUBLE PRECISION,
ADD COLUMN     "downsellEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "downsellHeadline" TEXT NOT NULL DEFAULT 'Hold on — how about this instead?',
ADD COLUMN     "downsellProductCompareAtPrice" TEXT,
ADD COLUMN     "downsellProductId" TEXT,
ADD COLUMN     "downsellProductImage" TEXT,
ADD COLUMN     "downsellProductPrice" TEXT,
ADD COLUMN     "downsellProductTitle" TEXT,
ADD COLUMN     "downsellVariantId" TEXT;

