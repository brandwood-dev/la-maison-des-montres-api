CREATE TABLE "app"."hero_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tagline" varchar(80),
	"title" varchar(160) NOT NULL,
	"subtitle" varchar(300),
	"cta_primary_label" varchar(80) NOT NULL,
	"cta_primary_href" varchar(500) NOT NULL,
	"cta_secondary_label" varchar(80) NOT NULL,
	"cta_secondary_href" varchar(500) NOT NULL,
	"image_url" text NOT NULL,
	"image_key" varchar(512),
	"image_alt" varchar(255),
	"sort_order" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_slides_order_positive" CHECK ("app"."hero_slides"."sort_order" >= 1)
);
--> statement-breakpoint
INSERT INTO "app"."hero_slides" (
	"id", "tagline", "title", "subtitle", "cta_primary_label", "cta_primary_href",
	"cta_secondary_label", "cta_secondary_href", "image_url", "image_alt", "sort_order", "active"
) VALUES (
	'00000000-0000-4000-8000-000000000008',
	'La Maison des Montres',
	'Le temps, avec élégance.',
	'Découvrez une sélection de montres pour chaque style et chaque occasion.',
	'Découvrir la collection', '/montres',
	'Voir les promotions', '/promotions',
	'https://res.cloudinary.com/dxkxiy900/image/upload/f_auto,q_auto,c_fill,g_auto/v1785813483/laurenz-heymann-al6s6JpnZis-unsplash_eemoes.jpg',
	'Montre-bracelet élégante', 1, true
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE INDEX "hero_slides_active_order_idx" ON "app"."hero_slides" USING btree ("active","sort_order");
--> statement-breakpoint
CREATE INDEX "hero_slides_updated_idx" ON "app"."hero_slides" USING btree ("updated_at");
--> statement-breakpoint
ALTER TABLE "app"."hero_slides" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."hero_slides" FROM anon, authenticated;
