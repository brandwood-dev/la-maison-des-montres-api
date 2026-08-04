CREATE TABLE "app"."admin_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(320) NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "phone" varchar(32),
  "role" "app"."admin_role" NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."admin_invitations"
  ADD CONSTRAINT "admin_invitations_created_by_admin_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "app"."admin_users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_token_hash_unique"
  ON "app"."admin_invitations" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "admin_invitations_email_idx"
  ON "app"."admin_invitations" USING btree (lower("email"));
--> statement-breakpoint
CREATE INDEX "admin_invitations_expires_idx"
  ON "app"."admin_invitations" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "admin_invitations_creator_idx"
  ON "app"."admin_invitations" USING btree ("created_by");
--> statement-breakpoint
ALTER TABLE "app"."admin_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."admin_invitations" FROM anon, authenticated;
