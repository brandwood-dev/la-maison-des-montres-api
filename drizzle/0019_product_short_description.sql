ALTER TABLE "app"."products"
  ADD COLUMN "short_description" text;
--> statement-breakpoint
UPDATE "app"."products"
SET "short_description" = "description"
WHERE "short_description" IS NULL;
