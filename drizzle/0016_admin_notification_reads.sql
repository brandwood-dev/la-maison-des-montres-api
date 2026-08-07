CREATE TABLE "app"."admin_notification_reads" (
	"admin_user_id" uuid NOT NULL,
	"notification_key" varchar(255) NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_notification_reads_admin_user_id_notification_key_pk" PRIMARY KEY("admin_user_id","notification_key")
);
--> statement-breakpoint
ALTER TABLE "app"."admin_notification_reads" ADD CONSTRAINT "admin_notification_reads_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "app"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "admin_notification_reads_admin_idx" ON "app"."admin_notification_reads" USING btree ("admin_user_id");
--> statement-breakpoint
CREATE INDEX "admin_notification_reads_read_at_idx" ON "app"."admin_notification_reads" USING btree ("read_at");
--> statement-breakpoint
ALTER TABLE "app"."admin_notification_reads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."admin_notification_reads" FROM anon, authenticated;
