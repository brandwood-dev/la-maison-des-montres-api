ALTER TABLE "app"."products" ADD COLUMN "stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "promotion_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "promotion_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "promotion_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_stock_nonnegative" CHECK ("app"."products"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_promotion_prices_valid" CHECK (not "app"."products"."promotion_active" or (
        "app"."products"."old_price" is not null
        and "app"."products"."old_price" > "app"."products"."price"
        and "app"."products"."promotion_ends_at" is not null
      ));--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_promotion_dates_valid" CHECK ("app"."products"."promotion_starts_at" is null
        or "app"."products"."promotion_ends_at" is null
        or "app"."products"."promotion_starts_at" < "app"."products"."promotion_ends_at");