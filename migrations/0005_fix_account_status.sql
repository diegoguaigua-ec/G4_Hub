-- This migration fixes the account_status column if it already exists
-- and ensures all related structures are in place

-- Only add account_status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants'
        AND column_name = 'account_status'
    ) THEN
        ALTER TABLE "tenants" ADD COLUMN "account_status" varchar(20) DEFAULT 'pending';
    END IF;
END $$;

-- Ensure role column has proper default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';

-- Create admin_actions table if it doesn't exist
CREATE TABLE IF NOT EXISTS "admin_actions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_actions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"admin_user_id" integer,
	"target_tenant_id" integer,
	"action_type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);

-- Add foreign keys if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'admin_actions_admin_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_user_id_users_id_fk"
        FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'admin_actions_target_tenant_id_tenants_id_fk'
    ) THEN
        ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_tenant_id_tenants_id_fk"
        FOREIGN KEY ("target_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "idx_admin_actions_admin" ON "admin_actions" USING btree ("admin_user_id");
CREATE INDEX IF NOT EXISTS "idx_admin_actions_tenant" ON "admin_actions" USING btree ("target_tenant_id");
CREATE INDEX IF NOT EXISTS "idx_admin_actions_type" ON "admin_actions" USING btree ("action_type");
CREATE INDEX IF NOT EXISTS "idx_admin_actions_created" ON "admin_actions" USING btree ("created_at");
