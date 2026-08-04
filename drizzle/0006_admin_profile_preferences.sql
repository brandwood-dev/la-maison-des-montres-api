ALTER TABLE "app"."admin_users"
  ADD COLUMN "notification_preferences" jsonb
  DEFAULT '{"newOrder":true,"toConfirm":true,"lowStock":true,"reviews":false,"emailDigest":true}'::jsonb
  NOT NULL;
--> statement-breakpoint
ALTER TABLE "app"."admin_users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."admin_users" FROM anon, authenticated;
