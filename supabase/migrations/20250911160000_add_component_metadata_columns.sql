-- Add enhanced metadata columns to components table
-- Migration: 20250911160000_add_component_metadata_columns

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

-- Add comments for documentation
COMMENT ON COLUMN components.keywords IS 'Search keywords from KiCad ki_keywords property';
COMMENT ON COLUMN components.footprint_filters IS 'Footprint compatibility filters from KiCad ki_fp_filters property';
COMMENT ON COLUMN components.default_footprint IS 'Default footprint suggestion from KiCad symbol';
COMMENT ON COLUMN components.reference_designator IS 'Standard reference designator from KiCad symbol';
