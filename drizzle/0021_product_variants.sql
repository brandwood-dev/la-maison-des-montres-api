CREATE TABLE IF NOT EXISTS "app"."product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "label" varchar(120) NOT NULL,
  "price" integer NOT NULL,
  "old_price" integer,
  "stock" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_variants_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade,
  CONSTRAINT "product_variants_price_nonnegative" CHECK ("price" >= 0),
  CONSTRAINT "product_variants_old_price_nonnegative" CHECK ("old_price" IS NULL OR "old_price" >= 0),
  CONSTRAINT "product_variants_stock_nonnegative" CHECK ("stock" >= 0),
  CONSTRAINT "product_variants_old_price_greater" CHECK ("old_price" IS NULL OR "old_price" > "price"),
  CONSTRAINT "product_variants_order_nonnegative" CHECK ("sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_product_label_unique"
  ON "app"."product_variants" ("product_id", lower("label"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_variants_product_order_idx"
  ON "app"."product_variants" ("product_id", "active", "sort_order");
--> statement-breakpoint
ALTER TABLE "app"."product_variants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "app"."product_variants" FROM anon, authenticated;
--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD COLUMN IF NOT EXISTS "variant_id" uuid;
--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD COLUMN IF NOT EXISTS "variant_label" varchar(120);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_variant_id_product_variants_id_fk'
      AND conrelid = 'app.order_items'::regclass
  ) THEN
    ALTER TABLE "app"."order_items"
      ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk"
      FOREIGN KEY ("variant_id") REFERENCES "app"."product_variants"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_items_variant_idx"
  ON "app"."order_items" ("variant_id");
