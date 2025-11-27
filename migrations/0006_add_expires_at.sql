-- Add expires_at column to tenants table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants'
        AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE "tenants" ADD COLUMN "expires_at" timestamp;
    END IF;
END $$;
