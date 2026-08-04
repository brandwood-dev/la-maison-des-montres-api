ALTER TABLE "app"."categories"
  ADD COLUMN "slug_custom" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."products"
  ADD COLUMN "seo_slug_custom" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."products"
  ADD COLUMN "seo_title_custom" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."products"
  ADD COLUMN "seo_description_custom" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."orders"
  ADD COLUMN "delivered_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "app"."categories" SET "slug_custom" = true;
--> statement-breakpoint
UPDATE "app"."products"
SET "seo_slug_custom" = true,
    "seo_title_custom" = ("seo_title" IS NOT NULL),
    "seo_description_custom" = ("seo_description" IS NOT NULL);
--> statement-breakpoint
CREATE INDEX "orders_status_delivered_idx"
  ON "app"."orders" USING btree ("status", "delivered_at");
--> statement-breakpoint
CREATE SEQUENCE "app"."product_reference_seq" AS bigint START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
