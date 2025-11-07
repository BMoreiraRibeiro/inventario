-- Migration: Add UNIQUE constraints to categories.key and locations.name
-- This allows upsert operations with onConflict to work properly

-- Add UNIQUE constraint on categories.key if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'categories_key_unique'
    ) THEN
        ALTER TABLE categories ADD CONSTRAINT categories_key_unique UNIQUE (key);
    END IF;
END $$;

-- Add UNIQUE constraint on locations.name if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'locations_name_unique'
    ) THEN
        ALTER TABLE locations ADD CONSTRAINT locations_name_unique UNIQUE (name);
    END IF;
END $$;

-- Verify constraints were added
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    contype AS constraint_type
FROM pg_constraint
WHERE conname IN ('categories_key_unique', 'locations_name_unique');
