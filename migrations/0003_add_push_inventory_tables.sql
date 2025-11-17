CREATE TABLE "inventory_movements_queue" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_movements_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"integration_id" integer NOT NULL,
	"movement_type" varchar(20) NOT NULL,
	"sku" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"order_id" varchar(255),
	"event_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "unmapped_skus" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "unmapped_skus_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"tenant_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"sku" varchar(255) NOT NULL,
	"product_name" varchar(500),
	"last_seen_at" timestamp DEFAULT now(),
	"occurrences" integer DEFAULT 1 NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sync_locks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sync_locks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"store_id" integer NOT NULL,
	"lock_type" varchar(20) NOT NULL,
	"locked_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"process_id" varchar(100)
);
--> statement-breakpoint
ALTER TABLE "inventory_movements_queue" ADD CONSTRAINT "inventory_movements_queue_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements_queue" ADD CONSTRAINT "inventory_movements_queue_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements_queue" ADD CONSTRAINT "inventory_movements_queue_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unmapped_skus" ADD CONSTRAINT "unmapped_skus_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unmapped_skus" ADD CONSTRAINT "unmapped_skus_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_locks" ADD CONSTRAINT "sync_locks_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_tenant" ON "inventory_movements_queue" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_store" ON "inventory_movements_queue" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_status" ON "inventory_movements_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_next_attempt" ON "inventory_movements_queue" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_movements_created" ON "inventory_movements_queue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_unmapped_skus_tenant" ON "unmapped_skus" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_unmapped_skus_store" ON "unmapped_skus" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_unmapped_skus_resolved" ON "unmapped_skus" USING btree ("resolved");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_unmapped_skus_store_sku" ON "unmapped_skus" USING btree ("store_id","sku");--> statement-breakpoint
CREATE INDEX "idx_sync_locks_store" ON "sync_locks" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_sync_locks_expires" ON "sync_locks" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "sync_locks" ADD CONSTRAINT "sync_locks_store_id_unique" UNIQUE("store_id");
