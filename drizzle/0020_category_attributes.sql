CREATE TABLE IF NOT EXISTS "app"."category_attributes" (
	"category_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_attributes_pkey" PRIMARY KEY("category_id", "attribute_id")
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'category_attributes_category_id_categories_id_fk'
		  AND conrelid = 'app.category_attributes'::regclass
	) THEN
		ALTER TABLE "app"."category_attributes"
			ADD CONSTRAINT "category_attributes_category_id_categories_id_fk"
			FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE cascade;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'category_attributes_attribute_id_attributes_id_fk'
		  AND conrelid = 'app.category_attributes'::regclass
	) THEN
		ALTER TABLE "app"."category_attributes"
			ADD CONSTRAINT "category_attributes_attribute_id_attributes_id_fk"
			FOREIGN KEY ("attribute_id") REFERENCES "app"."attributes"("id") ON DELETE cascade;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_attributes_attribute_idx"
	ON "app"."category_attributes" ("attribute_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "category_attributes_category_order_idx"
	ON "app"."category_attributes" ("category_id", "sort_order");
--> statement-breakpoint
ALTER TABLE "app"."category_attributes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "app"."category_attributes" FROM anon, authenticated;
--> statement-breakpoint

-- Keep the existing watch catalogue behaviour while scoping the new
-- perfume/accessory attributes to their dedicated categories.  Attributes
-- without any link remain global by design.
INSERT INTO "app"."category_attributes" ("category_id", "attribute_id", "sort_order")
SELECT c."id", a."id", a."sort_order"
FROM "app"."categories" c
CROSS JOIN "app"."attributes" a
WHERE c."slug" IN ('homme', 'femme', 'enfant')
  AND a."slug" NOT IN (
    'famille_olfactive',
    'concentration',
    'contenance',
    'notes_principales',
    'type_de_produit',
    'type_accessoire',
    'matiere_accessoire',
    'couleur_accessoire',
    'genre',
    'taille_accessoire'
  )
ON CONFLICT ("category_id", "attribute_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app"."category_attributes" ("category_id", "attribute_id", "sort_order")
SELECT c."id", a."id", a."sort_order"
FROM "app"."categories" c
CROSS JOIN "app"."attributes" a
WHERE c."slug" IN ('parfum-homme', 'parfum-femme')
  AND a."slug" IN (
    'famille_olfactive',
    'concentration',
    'contenance',
    'notes_principales',
    'type_de_produit',
    'genre'
  )
ON CONFLICT ("category_id", "attribute_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app"."category_attributes" ("category_id", "attribute_id", "sort_order")
SELECT c."id", a."id", a."sort_order"
FROM "app"."categories" c
CROSS JOIN "app"."attributes" a
WHERE c."slug" = 'accessoires'
  AND a."slug" IN (
    'type_accessoire',
    'matiere_accessoire',
    'couleur_accessoire',
    'genre',
    'taille_accessoire'
  )
ON CONFLICT ("category_id", "attribute_id") DO NOTHING;
