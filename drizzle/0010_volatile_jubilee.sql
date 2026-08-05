CREATE TABLE "app"."testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"message" varchar(1000) NOT NULL,
	"rating" integer NOT NULL,
	"governorate" varchar(120) NOT NULL,
	"product_id" uuid,
	"product_title_snapshot" varchar(240),
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testimonials_rating_range" CHECK ("app"."testimonials"."rating" between 1 and 5),
	CONSTRAINT "testimonials_sort_order_nonnegative" CHECK ("app"."testimonials"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."testimonials" ADD CONSTRAINT "testimonials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "testimonials_published_order_idx" ON "app"."testimonials" USING btree ("published","sort_order","created_at");--> statement-breakpoint
CREATE INDEX "testimonials_product_idx" ON "app"."testimonials" USING btree ("product_id");
--> statement-breakpoint
ALTER TABLE "app"."testimonials" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."testimonials" FROM anon, authenticated;
