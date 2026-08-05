CREATE TABLE "app"."promo_banner_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" varchar(160) NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promo_banner_messages_order_positive" CHECK ("app"."promo_banner_messages"."sort_order" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "promo_banner_messages_message_unique" ON "app"."promo_banner_messages" USING btree (lower("message"));--> statement-breakpoint
CREATE INDEX "promo_banner_messages_active_order_idx" ON "app"."promo_banner_messages" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "promo_banner_messages_updated_idx" ON "app"."promo_banner_messages" USING btree ("updated_at");
--> statement-breakpoint
INSERT INTO "app"."promo_banner_messages" ("id", "message", "sort_order", "active") VALUES
	('00000000-0000-4000-8000-000000000009', U&'Livraison rapide partout en Tunisie sous 2 \\00E0 3 jours', 1, true),
	('00000000-0000-4000-8000-00000000000A', U&'Paiement \\00E0 la livraison', 2, true),
	('00000000-0000-4000-8000-00000000000B', U&'Une s\\00E9lection pens\\00E9e pour durer', 3, true)
ON CONFLICT ("id") DO NOTHING;
