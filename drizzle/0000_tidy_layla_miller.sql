CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TYPE "app"."admin_role" AS ENUM('super_admin', 'admin', 'operateur', 'lecture_seule');--> statement-breakpoint
CREATE TYPE "app"."admin_status" AS ENUM('active', 'pending', 'disabled');--> statement-breakpoint
CREATE TYPE "app"."attribute_type" AS ENUM('select', 'multiselect', 'color', 'boolean', 'text', 'number');--> statement-breakpoint
CREATE TYPE "app"."product_status" AS ENUM('draft', 'published', 'hidden');--> statement-breakpoint
CREATE TABLE "app"."admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(32),
	"avatar_url" text,
	"role" "app"."admin_role" NOT NULL,
	"status" "app"."admin_status" DEFAULT 'pending' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"label" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"swatch" varchar(32),
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"type" "app"."attribute_type" NOT NULL,
	"filterable" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"logo_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" varchar(160) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_not_self_parent" CHECK ("app"."categories"."parent_id" <> "app"."categories"."id")
);
--> statement-breakpoint
CREATE TABLE "app"."product_attribute_values" (
	"product_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"value_id" uuid NOT NULL,
	CONSTRAINT "product_attribute_values_product_id_attribute_id_value_id_pk" PRIMARY KEY("product_id","attribute_id","value_id")
);
--> statement-breakpoint
CREATE TABLE "app"."product_categories" (
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "product_categories_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "app"."product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"media_provider" varchar(64),
	"media_key" varchar(512),
	"url" text NOT NULL,
	"alt" varchar(255),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" varchar(240) NOT NULL,
	"reference" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"old_price" integer,
	"status" "app"."product_status" DEFAULT 'draft' NOT NULL,
	"seo_slug" varchar(240) NOT NULL,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_nonnegative" CHECK ("app"."products"."price" >= 0),
	CONSTRAINT "products_old_price_nonnegative" CHECK ("app"."products"."old_price" is null or "app"."products"."old_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "app"."admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "app"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."attribute_values" ADD CONSTRAINT "attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "app"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "app"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "app"."attributes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_values_attribute_id_id_unique" ON "app"."attribute_values" USING btree ("attribute_id","id");--> statement-breakpoint
ALTER TABLE "app"."product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_value_fk" FOREIGN KEY ("attribute_id","value_id") REFERENCES "app"."attribute_values"("attribute_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_categories" ADD CONSTRAINT "product_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_categories" ADD CONSTRAINT "product_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "app"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "app"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_unique" ON "app"."admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_user_idx" ON "app"."admin_sessions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_idx" ON "app"."admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "app"."admin_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "admin_users_role_idx" ON "app"."admin_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "admin_users_status_idx" ON "app"."admin_users" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_values_attribute_slug_unique" ON "app"."attribute_values" USING btree ("attribute_id","slug");--> statement-breakpoint
CREATE INDEX "attribute_values_attribute_order_idx" ON "app"."attribute_values" USING btree ("attribute_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "attributes_slug_unique" ON "app"."attributes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "attributes_active_order_idx" ON "app"."attributes" USING btree ("active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_name_unique" ON "app"."brands" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_unique" ON "app"."brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "brands_active_idx" ON "app"."brands" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "app"."categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "app"."categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_active_order_idx" ON "app"."categories" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "product_attribute_values_attribute_idx" ON "app"."product_attribute_values" USING btree ("attribute_id");--> statement-breakpoint
CREATE INDEX "product_attribute_values_value_idx" ON "app"."product_attribute_values" USING btree ("value_id");--> statement-breakpoint
CREATE INDEX "product_categories_category_idx" ON "app"."product_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_images_product_order_idx" ON "app"."product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "products_reference_unique" ON "app"."products" USING btree (lower("reference"));--> statement-breakpoint
CREATE UNIQUE INDEX "products_seo_slug_unique" ON "app"."products" USING btree ("seo_slug");--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "app"."products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_status_created_idx" ON "app"."products" USING btree ("status","created_at");
--> statement-breakpoint
REVOKE ALL ON SCHEMA "app" FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
		REVOKE ALL ON SCHEMA "app" FROM anon;
	END IF;
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
		REVOKE ALL ON SCHEMA "app" FROM authenticated;
	END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "app"."admin_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."admin_users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."attribute_values" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."attributes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."brands" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."product_attribute_values" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."product_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."product_images" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "app"."products" ENABLE ROW LEVEL SECURITY;
