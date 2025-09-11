-- Add missing columns to components table for enhanced KiCad metadata
-- Run this in Supabase SQL Editor

-- Add keywords array column
ALTER TABLE components
ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';

-- Add footprint filters array column
ALTER TABLE components
ADD COLUMN IF NOT EXISTS footprint_filters TEXT[] DEFAULT '{}';

-- Add default footprint column
ALTER TABLE components
ADD COLUMN IF NOT EXISTS default_footprint TEXT;

-- Add reference designator column
ALTER TABLE components
ADD COLUMN IF NOT EXISTS reference_designator TEXT;

-- Update search vector to include keywords
-- Note: This will require dropping and recreating the generated column
-- ALTER TABLE components DROP COLUMN IF EXISTS search_vector;
-- ALTER TABLE components ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
--   to_tsvector('english',
--     COALESCE(name, '') || ' ' ||
--     COALESCE(description, '') || ' ' ||
--     COALESCE(type, '') || ' ' ||
--     COALESCE(category, '') || ' ' ||
--     COALESCE(manufacturer, '') || ' ' ||
--     COALESCE(part_number, '') || ' ' ||
--     array_to_string(keywords, ' ')
--   )
-- ) STORED;

-- Add comments for documentation
COMMENT ON COLUMN components.keywords IS 'Search keywords from KiCad ki_keywords property';
COMMENT ON COLUMN components.footprint_filters IS 'Footprint compatibility filters from KiCad ki_fp_filters property';
COMMENT ON COLUMN components.default_footprint IS 'Default footprint suggestion from KiCad symbol';
COMMENT ON COLUMN components.reference_designator IS 'Standard reference designator from KiCad symbol';
