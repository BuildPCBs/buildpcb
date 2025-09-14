-- Migration: Add bbox and extends columns to components table
-- Run this in Supabase SQL Editor to add new KiCad symbol metadata fields

-- Add bbox column for symbol bounding box data
ALTER TABLE components
ADD COLUMN IF NOT EXISTS bbox JSONB DEFAULT NULL;

-- Add extends column for symbol inheritance relationships
ALTER TABLE components
ADD COLUMN IF NOT EXISTS extends TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN components.bbox IS 'Symbol bounding box coordinates from KiCad symbol definition';
COMMENT ON COLUMN components.extends IS 'Base symbol ID that this symbol extends/inherits from';

-- Create index on extends for efficient inheritance queries
CREATE INDEX IF NOT EXISTS idx_components_extends ON components(extends);

-- Optional: Update search vector to include extends relationship
-- This helps with finding related symbols
-- Note: Uncomment if you want to include extends in search
-- ALTER TABLE components DROP COLUMN IF EXISTS search_vector;
-- ALTER TABLE components ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
--   to_tsvector('english',
--     COALESCE(name, '') || ' ' ||
--     COALESCE(description, '') || ' ' ||
--     COALESCE(type, '') || ' ' ||
--     COALESCE(category, '') || ' ' ||
--     COALESCE(manufacturer, '') || ' ' ||
--     COALESCE(part_number, '') || ' ' ||
--     array_to_string(keywords, ' ') || ' ' ||
--     COALESCE(extends, '')
--   )
-- ) STORED;
