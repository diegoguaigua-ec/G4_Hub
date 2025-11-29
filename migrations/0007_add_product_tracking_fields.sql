-- Add tracking fields to store_products table
DO $$
BEGIN
    -- Add last_modified_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'store_products'
        AND column_name = 'last_modified_at'
    ) THEN
        ALTER TABLE "store_products" ADD COLUMN "last_modified_at" timestamp DEFAULT NOW();
    END IF;

    -- Add last_modified_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'store_products'
        AND column_name = 'last_modified_by'
    ) THEN
        ALTER TABLE "store_products" ADD COLUMN "last_modified_by" varchar(20);
    END IF;
END $$;
