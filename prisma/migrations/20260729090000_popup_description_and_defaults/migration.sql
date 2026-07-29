-- AlterTable
ALTER TABLE "PrePurchasePopupConfig" ADD COLUMN     "descriptionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "descriptionText" TEXT NOT NULL DEFAULT 'This limited-time add-on is the perfect finishing touch for your order — grab it now before you check out.',
ALTER COLUMN "fontColor" SET DEFAULT '#1A1A2E',
ALTER COLUMN "cornerRadius" SET DEFAULT 14,
ALTER COLUMN "countdownEnabled" SET DEFAULT true,
ALTER COLUMN "timerBackgroundColor" SET DEFAULT '#F8C9C9',
ALTER COLUMN "acceptButtonColor" SET DEFAULT '#EF6E7B';

