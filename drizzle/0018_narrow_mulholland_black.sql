CREATE TYPE "app"."email_delivery_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "app"."order_notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"recipient_email" varchar(320) NOT NULL,
	"status" "app"."email_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."order_notification_deliveries" ADD CONSTRAINT "order_notification_deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "app"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_notification_deliveries_order_recipient_unique" ON "app"."order_notification_deliveries" USING btree ("order_id",lower("recipient_email"));--> statement-breakpoint
CREATE INDEX "order_notification_deliveries_order_idx" ON "app"."order_notification_deliveries" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_notification_deliveries_status_idx" ON "app"."order_notification_deliveries" USING btree ("status");
--> statement-breakpoint
ALTER TABLE "app"."order_notification_deliveries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "app"."order_notification_deliveries" FROM anon, authenticated;
