-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "buttonsPosition" TEXT,
ADD COLUMN     "contentBlocks" JSONB,
ADD COLUMN     "showMoneySummary" BOOLEAN,
ADD COLUMN     "trustBadgeImages" JSONB,
ADD COLUMN     "trustBadgesEnabled" BOOLEAN,
ADD COLUMN     "uspEnabled" BOOLEAN,
ADD COLUMN     "uspItems" JSONB,
ADD COLUMN     "videoEnabled" BOOLEAN,
ADD COLUMN     "videoLinkUrl" TEXT,
ADD COLUMN     "videoThumbnailUrl" TEXT;

