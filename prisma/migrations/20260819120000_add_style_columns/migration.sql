-- Additive style/branding columns for the post-purchase offer (admin preview
-- only for now). All nullable, no defaults — existing rows are untouched.
-- AlterTable
ALTER TABLE "OfferConfig" ADD COLUMN "bannerBackgroundColor" TEXT,
ADD COLUMN "bannerIconColor" TEXT,
ADD COLUMN "bannerTextColor" TEXT,
ADD COLUMN "cardLayout" TEXT,
ADD COLUMN "previewButtonColor" TEXT;
