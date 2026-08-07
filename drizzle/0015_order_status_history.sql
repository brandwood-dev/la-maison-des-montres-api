CREATE TABLE IF NOT EXISTS "app"."order_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "from_status" "app"."order_status",
  "to_status" "app"."order_status" NOT NULL,
  "changed_by" uuid,
  "changed_by_name" varchar(160) NOT NULL,
  "changed_by_email" varchar(320),
  "action" varchar(240) NOT NULL,
  "note" varchar(500),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_status_history_order_id_fk'
  ) THEN
    ALTER TABLE "app"."order_status_history"
      ADD CONSTRAINT "order_status_history_order_id_fk"
      FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_status_history_changed_by_fk'
  ) THEN
    ALTER TABLE "app"."order_status_history"
      ADD CONSTRAINT "order_status_history_changed_by_fk"
      FOREIGN KEY ("changed_by") REFERENCES "app"."admin_users"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_history_order_created_idx"
  ON "app"."order_status_history" ("order_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_status_history_actor_idx"
  ON "app"."order_status_history" ("changed_by");
--> statement-breakpoint
ALTER TABLE "app"."order_status_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."order_status_history" FROM anon, authenticated;
--> statement-breakpoint
INSERT INTO "app"."order_status_history"
  ("order_id", "from_status", "to_status", "changed_by_name", "action", "created_at")
SELECT
  o."id",
  NULL,
  o."status",
  'Système',
  'Commande créée',
  o."created_at"
FROM "app"."orders" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "app"."order_status_history" h
  WHERE h."order_id" = o."id"
);
