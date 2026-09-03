-- Additive, nullable. OCU post-purchase editor cosmetics stored as one JSON blob.
-- null = use defaults. Safe to apply on prod boot (no data rewrite, no NOT NULL).
ALTER TABLE "Offer" ADD COLUMN "editorSettings" JSONB;
