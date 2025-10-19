-- Create prompts analytics table
CREATE TABLE IF NOT EXISTS prompts_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_text TEXT NOT NULL,
  user_email TEXT,
  user_id UUID REFERENCES auth.users(id),
  prompt_type VARCHAR(50) DEFAULT 'general', -- 'component_search', 'wiring', 'general', etc.
  response_success BOOLEAN DEFAULT true,
  response_length INTEGER, -- character count of AI response
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_id TEXT, -- optional: track conversation sessions
  project_id TEXT -- optional: link to specific projects
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prompts_analytics_created_at ON prompts_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_prompts_analytics_user_email ON prompts_analytics(user_email);
CREATE INDEX IF NOT EXISTS idx_prompts_analytics_prompt_type ON prompts_analytics(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompts_analytics_user_id ON prompts_analytics(user_id);

-- Enable Row Level Security
ALTER TABLE prompts_analytics ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own prompts
CREATE POLICY "Users can view own prompts" ON prompts_analytics
  FOR SELECT USING (auth.uid() = user_id);

-- Create policy: Service role can insert all prompts (for backend logging)
CREATE POLICY "Service role can insert prompts" ON prompts_analytics
  FOR INSERT WITH CHECK (true);

-- Create policy: Service role can view all prompts (for analytics)
CREATE POLICY "Service role can view all prompts" ON prompts_analytics
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a view for daily prompt counts (useful for analytics)
CREATE OR REPLACE VIEW daily_prompt_stats AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_prompts,
  COUNT(DISTINCT user_email) as unique_users,
  AVG(response_length) as avg_response_length,
  COUNT(CASE WHEN response_success = true THEN 1 END) as successful_prompts
FROM prompts_analytics
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Create a view for prompt type distribution
CREATE OR REPLACE VIEW prompt_type_stats AS
SELECT
  prompt_type,
  COUNT(*) as count,
  COUNT(DISTINCT user_email) as unique_users
FROM prompts_analytics
GROUP BY prompt_type
ORDER BY count DESC;
