-- OCU-parity additions for the pre-purchase popup. All nullable, no defaults —
-- existing rows/data are untouched.
-- AlterTable
ALTER TABLE "PrePurchasePopupConfig"
  ADD COLUMN "selectorsColor" TEXT,
  ADD COLUMN "elementsColor" TEXT,
  ADD COLUMN "inheritStoreFont" BOOLEAN,
  ADD COLUMN "layout" TEXT,
  ADD COLUMN "allowSubscription" BOOLEAN,
  ADD COLUMN "hideIfCartHasSubscription" BOOLEAN,
  ADD COLUMN "imageBorder" BOOLEAN,
  ADD COLUMN "autoselectVariant" BOOLEAN,
  ADD COLUMN "hideQuantitySelector" BOOLEAN,
  ADD COLUMN "predefinedQuantity" INTEGER,
  ADD COLUMN "discountType" TEXT,
  ADD COLUMN "discountValue" DOUBLE PRECISION,
  ADD COLUMN "acceptButtonHoverColor" TEXT,
  ADD COLUMN "declineButtonHoverColor" TEXT;
