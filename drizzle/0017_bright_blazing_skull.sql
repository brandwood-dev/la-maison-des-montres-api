ALTER TABLE "app"."orders" ADD COLUMN "customer_phone_normalized" varchar(16);--> statement-breakpoint
WITH normalized AS (
	SELECT
		"id",
		regexp_replace("customer_phone", '[^0-9+]', '', 'g') AS "phone"
	FROM "app"."orders"
)
UPDATE "app"."orders" AS orders
SET "customer_phone_normalized" = CASE
	WHEN normalized."phone" ~ '^[+]216[234579][0-9]{7}$' THEN normalized."phone"
	WHEN normalized."phone" ~ '^00216[234579][0-9]{7}$' THEN '+216' || substr(normalized."phone", 6)
	WHEN normalized."phone" ~ '^[234579][0-9]{7}$' THEN '+216' || normalized."phone"
	ELSE NULL
END
FROM normalized
WHERE orders."id" = normalized."id";--> statement-breakpoint
CREATE INDEX "orders_phone_normalized_idx" ON "app"."orders" USING btree ("customer_phone_normalized");
