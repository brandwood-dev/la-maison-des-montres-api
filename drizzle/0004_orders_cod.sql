CREATE TYPE "app"."order_status" AS ENUM('new', 'to_confirm', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'returned');--> statement-breakpoint
CREATE TYPE "app"."payment_method" AS ENUM('cod');--> statement-breakpoint
CREATE TYPE "app"."payment_status" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
CREATE TABLE "app"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(40) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"customer_name" varchar(200) NOT NULL,
	"customer_email" varchar(320),
	"customer_phone" varchar(32) NOT NULL,
	"governorate" varchar(120) NOT NULL,
	"city" varchar(160) NOT NULL,
	"address" text NOT NULL,
	"postal_code" varchar(16),
	"notes" varchar(500),
	"subtotal" integer NOT NULL,
	"shipping_fee" integer NOT NULL,
	"total" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'TND' NOT NULL,
	"status" "app"."order_status" DEFAULT 'new' NOT NULL,
	"payment_method" "app"."payment_method" DEFAULT 'cod' NOT NULL,
	"payment_status" "app"."payment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_subtotal_nonnegative" CHECK ("app"."orders"."subtotal" >= 0),
	CONSTRAINT "orders_shipping_nonnegative" CHECK ("app"."orders"."shipping_fee" >= 0),
	CONSTRAINT "orders_total_nonnegative" CHECK ("app"."orders"."total" >= 0)
);--> statement-breakpoint
CREATE TABLE "app"."order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(240) NOT NULL,
	"reference" varchar(120) NOT NULL,
	"image_url" text,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"line_total" integer NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("app"."order_items"."quantity" >= 1),
	CONSTRAINT "order_items_unit_price_nonnegative" CHECK ("app"."order_items"."unit_price" >= 0),
	CONSTRAINT "order_items_line_total_nonnegative" CHECK ("app"."order_items"."line_total" >= 0)
);--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_unique" ON "app"."orders" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_unique" ON "app"."orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "app"."orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_phone_idx" ON "app"."orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "app"."order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_idx" ON "app"."order_items" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "app"."orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "app"."orders" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON TABLE "app"."order_items" FROM anon, authenticated;
