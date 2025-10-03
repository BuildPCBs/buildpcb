-- Add vector embeddings support to components table
-- Run this in Supabase SQL Editor

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding vector column (1536 dimensions for text-embedding-3-small)
ALTER TABLE components_index.embeddings
ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create vector similarity search index for cosine similarity
CREATE INDEX IF NOT EXISTS components_index_embeddings_vector_idx
ON components_index.embeddings USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);

-- Optional: Create a more aggressive index for better performance (uncomment if needed)
-- CREATE INDEX IF NOT EXISTS components_index_embeddings_vector_hnsw_idx
-- ON components_index.embeddings USING hnsw (embedding_vector vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- Create a function for vector similarity search
CREATE OR REPLACE FUNCTION vector_similarity_search(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  name varchar(255),
  type varchar(100),
  category varchar(100),
  description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.uid as id,
    c.name,
    c.component_type as type,
    c.category,
    c.description,
    1 - (c.embedding_vector <=> query_embedding) as similarity
  FROM components_index.embeddings c
  WHERE c.embedding_vector IS NOT NULL
    AND 1 - (c.embedding_vector <=> query_embedding) > match_threshold
  ORDER BY c.embedding_vector <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Optional: Add a GIN index for better performance (alternative to IVFFlat)
-- CREATE INDEX IF NOT EXISTS components_embedding_gin_idx
-- ON components USING ivfflat (embedding_vector vector_cosine_ops);
