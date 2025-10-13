-- Add thumbnail_url column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Create storage bucket for project assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for project-assets bucket
CREATE POLICY "Anyone can view project thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-assets');

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-assets'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own project thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-assets'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own project thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-assets'
  AND auth.role() = 'authenticated'
);
