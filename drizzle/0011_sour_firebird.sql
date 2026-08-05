CREATE TABLE "app"."store_settings" (
	"id" varchar(32) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"identity_name" varchar(160) NOT NULL,
	"identity_tagline" varchar(200),
	"identity_logo_url" text,
	"currency" varchar(3) DEFAULT 'TND' NOT NULL,
	"support_email" varchar(320),
	"support_phone" varchar(32),
	"support_whatsapp" varchar(32),
	"support_address" text,
	"seo_default_title" varchar(255) NOT NULL,
	"seo_default_description" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "app"."store_settings" (
	"id", "identity_name", "identity_tagline", "currency",
	"seo_default_title", "seo_default_description"
) VALUES (
	'default',
	'La Maison des Montres',
	U&'L''horlogerie de caract\00E8re',
	'TND',
	U&'La Maison des Montres | Montres \00E9l\00E9gantes en Tunisie',
	U&'D\00E9couvrez notre s\00E9lection de montres pour homme, femme, enfant et couple : marques soigneusement choisies, prix en TND, paiement \00E0 la livraison et livraison partout en Tunisie.'
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "app"."store_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."store_settings" FROM anon, authenticated;
