ALTER TABLE "app"."products"
ADD COLUMN IF NOT EXISTS "is_best_seller" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."products"
ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_best_seller_idx"
  ON "app"."products" ("status", "is_best_seller", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_featured_idx"
  ON "app"."products" ("status", "is_featured", "created_at");
