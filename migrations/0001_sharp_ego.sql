CREATE TABLE "sync_log_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_log_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sync_log_id" integer NOT NULL,
	"sku" varchar(255) NOT NULL,
	"product_id" varchar(255),
	"product_name" varchar(500),
	"status" varchar(20) NOT NULL,
	"stock_before" integer,
	"stock_after" integer,
	"error_category" varchar(50),
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sync_logs" ALTER COLUMN "sync_type" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_logs" ALTER COLUMN "status" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "sync_log_items" ADD CONSTRAINT "sync_log_items_sync_log_id_sync_logs_id_fk" FOREIGN KEY ("sync_log_id") REFERENCES "public"."sync_logs"("id") ON DELETE cascade ON UPDATE no action;