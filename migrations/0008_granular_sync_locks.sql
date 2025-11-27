-- Update sync_locks table to allow granular locks (pull and push can run concurrently)
DO $$
BEGIN
    -- Drop old unique constraint on store_id if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'sync_locks_store_id_unique'
    ) THEN
        ALTER TABLE "sync_locks" DROP CONSTRAINT "sync_locks_store_id_unique";
        RAISE NOTICE 'Dropped old unique constraint on store_id';
    END IF;

    -- Add new unique constraint on (store_id, lock_type) if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_sync_locks_store_type'
    ) THEN
        ALTER TABLE "sync_locks"
            ADD CONSTRAINT "uq_sync_locks_store_type"
            UNIQUE (store_id, lock_type);
        RAISE NOTICE 'Added unique constraint on (store_id, lock_type)';
    END IF;

    -- Delete any existing locks to start fresh
    DELETE FROM "sync_locks";
    RAISE NOTICE 'Cleared existing locks';
END $$;
