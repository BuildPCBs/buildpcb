-- BuildPCBs Database Schema
-- This schema supports PCB projects, components, collaboration, and version control

-- Drop existing tables if they exist (for development/testing)
DROP TABLE IF EXISTS component_usage CASCADE;
DROP TABLE IF EXISTS project_activity CASCADE;
DROP TABLE IF EXISTS project_collaborators CASCADE;
DROP TABLE IF EXISTS project_versions CASCADE;
DROP TABLE IF EXISTS components CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- 1. PROJECTS TABLE
-- Stores PCB project metadata
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Project settings
  canvas_settings JSONB DEFAULT '{}',
  grid_settings JSONB DEFAULT '{}',

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  category VARCHAR(100),

  CONSTRAINT projects_name_length CHECK (char_length(name) >= 1)
);

-- 2. PROJECT_VERSIONS TABLE
-- Version control for PCB designs
CREATE TABLE project_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_name VARCHAR(255),
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Circuit data (using existing Circuit schema)
  circuit_data JSONB NOT NULL,
  canvas_data JSONB DEFAULT '{}',

  -- Version metadata
  changelog TEXT,
  is_major_version BOOLEAN DEFAULT false,
  parent_version_id UUID REFERENCES project_versions(id),

  UNIQUE(project_id, version_number)
);

-- 3. COMPONENTS TABLE
-- Reusable component library
CREATE TABLE components (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,

  -- Component specifications
  specifications JSONB DEFAULT '{}',
  pin_configuration JSONB DEFAULT '{}',
  electrical_properties JSONB DEFAULT '{}',

  -- Visual representation
  symbol_svg TEXT,
  footprint_data JSONB DEFAULT '{}',

  -- Documentation
  datasheet_url TEXT,
  manufacturer VARCHAR(255),
  part_number VARCHAR(255),

  -- Component library metadata
  is_verified BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Search optimization
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english',
      COALESCE(name, '') || ' ' ||
      COALESCE(description, '') || ' ' ||
      COALESCE(type, '') || ' ' ||
      COALESCE(category, '') || ' ' ||
      COALESCE(manufacturer, '') || ' ' ||
      COALESCE(part_number, '')
    )
  ) STORED
);

-- 4. PROJECT_COLLABORATORS TABLE
-- Team collaboration and permissions
CREATE TABLE project_collaborators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level VARCHAR(20) NOT NULL CHECK (permission_level IN ('read', 'write', 'admin')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(project_id, user_id)
);

-- 5. PROJECT_ACTIVITY TABLE
-- Activity log for projects (version history, edits, collaborations)
CREATE TABLE project_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  activity_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. USER_PREFERENCES TABLE
-- User-specific settings and preferences
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- UI Preferences
  theme VARCHAR(20) DEFAULT 'light',
  canvas_preferences JSONB DEFAULT '{}',
  hotkey_preferences JSONB DEFAULT '{}',

  -- Editor preferences
  auto_save_enabled BOOLEAN DEFAULT true,
  auto_save_interval INTEGER DEFAULT 30, -- seconds
  show_grid BOOLEAN DEFAULT true,
  snap_to_grid BOOLEAN DEFAULT true,

  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  browser_notifications BOOLEAN DEFAULT true,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. COMPONENT_USAGE TABLE
-- Track component usage for recommendations
CREATE TABLE component_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  component_id UUID REFERENCES components(id),
  project_id UUID REFERENCES projects(id),
  user_id UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(component_id, project_id)
);

-- INDEXES for performance
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX idx_projects_tags ON projects USING gin(tags);

CREATE INDEX idx_project_versions_project_id ON project_versions(project_id);
CREATE INDEX idx_project_versions_created_at ON project_versions(created_at DESC);

CREATE INDEX idx_components_category ON components(category);
CREATE INDEX idx_components_type ON components(type);
CREATE INDEX idx_components_search ON components USING gin(search_vector);

CREATE INDEX idx_project_collaborators_user_id ON project_collaborators(user_id);
CREATE INDEX idx_project_activity_project_id ON project_activity(project_id);
CREATE INDEX idx_project_activity_created_at ON project_activity(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Projects: Users can see their own projects and public projects
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can view public projects" ON projects
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert their own projects" ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (owner_id = auth.uid());

-- Project versions: Based on project access
CREATE POLICY "Users can view versions of accessible projects" ON project_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_versions.project_id
      AND (projects.owner_id = auth.uid() OR projects.is_public = true)
    )
  );

CREATE POLICY "Users can insert versions for their projects" ON project_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_versions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update versions of their projects" ON project_versions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_versions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete versions of their projects" ON project_versions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_versions.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Project collaborators: Users can manage collaborators for their projects
CREATE POLICY "Users can view collaborators of accessible projects" ON project_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND (projects.owner_id = auth.uid() OR projects.is_public = true)
    )
  );

CREATE POLICY "Users can manage collaborators for their projects" ON project_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Components: Public read access, authenticated users can contribute
CREATE POLICY "Anyone can view components" ON components
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create components" ON components
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own components" ON components
  FOR UPDATE USING (created_by = auth.uid());

-- Component usage: Track usage for all authenticated users
CREATE POLICY "Authenticated users can track component usage" ON component_usage
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Project activity: Users can view activity for projects they have access to
CREATE POLICY "Users can view activity for accessible projects" ON project_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_activity.project_id
      AND (projects.owner_id = auth.uid() OR projects.is_public = true)
    )
  );

CREATE POLICY "Users can insert activity for their projects" ON project_activity
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_activity.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
