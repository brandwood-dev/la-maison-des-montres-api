ALTER TABLE "app"."store_settings"
ADD COLUMN IF NOT EXISTS "shipping_fee_millimes" integer DEFAULT 8000 NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."store_settings"
ADD COLUMN IF NOT EXISTS "free_shipping_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."store_settings"
ADD COLUMN IF NOT EXISTS "free_shipping_threshold_millimes" integer DEFAULT 500000;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_settings_shipping_fee_nonnegative'
  ) THEN
    ALTER TABLE "app"."store_settings"
      ADD CONSTRAINT "store_settings_shipping_fee_nonnegative"
      CHECK ("shipping_fee_millimes" >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_settings_shipping_threshold_positive'
  ) THEN
    ALTER TABLE "app"."store_settings"
      ADD CONSTRAINT "store_settings_shipping_threshold_positive"
      CHECK ("free_shipping_threshold_millimes" IS NULL OR "free_shipping_threshold_millimes" > 0);
  END IF;
END $$;
