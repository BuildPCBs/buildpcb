import { supabase } from "@/lib/supabase";
import { Circuit } from "@/lib/schemas/circuit";

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  is_public: boolean;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  canvas_settings: Record<string, any>;
  grid_settings: Record<string, any>;
  tags: string[];
  category?: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  version_name?: string;
  description?: string;
  created_by: string;
  created_at: string;
  circuit_data: Circuit;
  canvas_data: Record<string, any>;
  changelog?: string;
  is_major_version: boolean;
  parent_version_id?: string;
}

export interface Component {
  id: string;
  name: string;
  type: string;
  category: string;
  description?: string;
  specifications: Record<string, any>;
  pin_configuration: Record<string, any>;
  electrical_properties: Record<string, any>;
  symbol_svg?: string;
  footprint_data: Record<string, any>;
  datasheet_url?: string;
  manufacturer?: string;
  part_number?: string;
  is_verified: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  user_id: string;
  permission_level: "read" | "write" | "admin";
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
}

export class DatabaseService {
  // ==================== PROJECTS ====================

  /**
   * Get all projects for the current user
   */
  static async getUserProjects(): Promise<Project[]> {
    console.log("🔍 Getting user projects...");

    // Check if user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      console.error("❌ Auth error getting user:", userError);
      throw new Error(`Authentication error: ${userError.message}`);
    }

    if (!user) {
      console.error("❌ No authenticated user found");
      throw new Error("User not authenticated");
    }

    console.log("✅ User authenticated:", user.email);

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("❌ Database error getting projects:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("✅ Projects retrieved:", data?.length || 0, "projects");
    return data || [];
  }

  /**
   * Get a specific project by ID
   */
  static async getProject(projectId: string): Promise<Project | null> {
    console.log("🔍 Getting project by ID:", projectId);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        console.log("❌ Project not found:", projectId);
        return null;
      }
      console.error("❌ Database error getting project:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("✅ Project retrieved:", data.name);
    return data;
  }

  /**
   * Get public projects (for discovery)
   */
  static async getPublicProjects(limit = 20): Promise<Project[]> {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Create a new project
   */
  static async createProject(projectData: Partial<Project>): Promise<Project> {
    console.log("🆕 Creating new project...", { name: projectData.name });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("❌ No authenticated user for project creation");
      throw new Error("User not authenticated");
    }

    console.log("✅ User authenticated for project creation:", user.email);

    const { data, error } = await supabase
      .from("projects")
      .insert([
        {
          ...projectData,
          owner_id: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("❌ Database error creating project:", error);
      throw new Error(`Failed to create project: ${error.message}`);
    }

    console.log("✅ Project created successfully:", data.name, "ID:", data.id);

    // Log activity
    try {
      await this.logActivity(data.id, "project_created", "Project created");
    } catch (activityError) {
      console.warn(
        "⚠️ Could not log project creation activity:",
        activityError
      );
      // Don't fail the project creation if activity logging fails
    }

    return data;
  }

  /**
   * Update a project
   */
  static async updateProject(
    projectId: string,
    updates: Partial<Project>
  ): Promise<Project> {
    const { data, error } = await supabase
      .from("projects")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .select()
      .single();

    if (error) throw error;

    // Log activity (don't fail the update if activity logging fails)
    try {
      await this.logActivity(projectId, "project_updated", "Project updated");
    } catch (activityError) {
      console.warn("⚠️ Could not log project update activity:", activityError);
      // Don't fail the project update if activity logging fails
    }

    return data;
  }

  /**
   * Delete a project
   */
  static async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) throw error;
  }

  /**
   * Update last opened timestamp
   */
  static async updateLastOpened(projectId: string): Promise<void> {
    const { error } = await supabase
      .from("projects")
      .update({ last_opened_at: new Date().toISOString() })
      .eq("id", projectId);

    if (error) throw error;
  }

  // ==================== PROJECT VERSIONS ====================

  /**
   * Get all versions for a project
   */
  static async getProjectVersions(
    projectId: string
  ): Promise<ProjectVersion[]> {
    const { data, error } = await supabase
      .from("project_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get the latest version of a project
   */
  static async getLatestVersion(
    projectId: string
  ): Promise<ProjectVersion | null> {
    const { data, error } = await supabase
      .from("project_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
    return data;
  }

  /**
   * Create a new version
   */
  static async createVersion(
    projectId: string,
    circuitData: Circuit,
    canvasData: Record<string, any> = {},
    versionName?: string,
    changelog?: string
  ): Promise<ProjectVersion> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Get the next version number
    const { data: latestVersion } = await supabase
      .from("project_versions")
      .select("version_number")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

    const { data, error } = await supabase
      .from("project_versions")
      .insert([
        {
          project_id: projectId,
          version_number: nextVersionNumber,
          version_name: versionName,
          circuit_data: circuitData,
          canvas_data: canvasData,
          changelog,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Update project's updated_at timestamp
    await this.updateProject(projectId, {});

    // Log activity (don't fail the version creation if activity logging fails)
    try {
      await this.logActivity(
        projectId,
        "version_created",
        `Version ${nextVersionNumber} created`
      );
    } catch (activityError) {
      console.warn(
        "⚠️ Could not log version creation activity:",
        activityError
      );
      // Don't fail the version creation if activity logging fails
    }

    return data;
  }

  /**
   * Get a specific version
   */
  static async getVersion(versionId: string): Promise<ProjectVersion | null> {
    const { data, error } = await supabase
      .from("project_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  // ==================== COMPONENTS ====================

  /**
   * Search components in the library
   */
  static async searchComponents(
    query: string,
    category?: string,
    limit = 50
  ): Promise<Component[]> {
    let queryBuilder = supabase.from("components").select("*");

    if (query) {
      // Use full-text search
      queryBuilder = queryBuilder.textSearch("search_vector", query);
    }

    if (category) {
      queryBuilder = queryBuilder.eq("category", category);
    }

    const { data, error } = await queryBuilder
      .order("is_verified", { ascending: false })
      .order("name")
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get component categories
   */
  static async getComponentCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from("components")
      .select("category")
      .order("category");

    if (error) throw error;

    // Return unique categories
    const categories = [...new Set(data?.map((item) => item.category) || [])];
    return categories.filter(Boolean);
  }

  /**
   * Get frequently used components for a user
   */
  static async getFrequentComponents(limit = 20): Promise<Component[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("component_usage")
      .select(
        `
        component_id,
        components!inner (*)
      `
      )
      .eq("user_id", user.id)
      .order("used_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Extract components from the joined data
    return data?.map((item: any) => item.components).filter(Boolean) || [];
  }

  /**
   * Record component usage
   */
  static async recordComponentUsage(
    componentId: string,
    projectId: string
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Insert or update usage record
    const { error } = await supabase.from("component_usage").upsert([
      {
        component_id: componentId,
        project_id: projectId,
        user_id: user.id,
        used_at: new Date().toISOString(),
      },
    ]);

    if (error && error.code !== "23505") throw error; // Ignore duplicate key errors
  }

  // ==================== COLLABORATION ====================

  /**
   * Get project collaborators
   */
  static async getProjectCollaborators(
    projectId: string
  ): Promise<ProjectCollaborator[]> {
    const { data, error } = await supabase
      .from("project_collaborators")
      .select("*")
      .eq("project_id", projectId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Add a collaborator to a project
   */
  static async addCollaborator(
    projectId: string,
    userEmail: string,
    permissionLevel: "read" | "write" | "admin"
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // First, find the user by email
    const { data: targetUser, error: userError } = await supabase
      .from("auth.users")
      .select("id")
      .eq("email", userEmail)
      .single();

    if (userError) throw new Error("User not found");

    // Add collaborator
    const { error } = await supabase.from("project_collaborators").insert([
      {
        project_id: projectId,
        user_id: targetUser.id,
        permission_level: permissionLevel,
        invited_by: user.id,
      },
    ]);

    if (error) throw error;

    // Log activity (don't fail the collaborator addition if activity logging fails)
    try {
      await this.logActivity(
        projectId,
        "collaborator_added",
        `Added ${userEmail} as ${permissionLevel}`
      );
    } catch (activityError) {
      console.warn(
        "⚠️ Could not log collaborator addition activity:",
        activityError
      );
      // Don't fail the collaborator addition if activity logging fails
    }
  }

  // ==================== ACTIVITY LOGGING ====================

  /**
   * Log project activity
   */
  static async logActivity(
    projectId: string,
    activityType: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.warn("⚠️ Auth error when logging activity:", authError);
        return; // Don't fail the operation if we can't log activity
      }

      if (!user) {
        console.warn("⚠️ No user found when logging activity");
        return; // Don't fail the operation if we can't log activity
      }

      const { error } = await supabase.from("project_activity").insert([
        {
          project_id: projectId,
          user_id: user.id,
          activity_type: activityType,
          description,
          metadata,
        },
      ]);

      if (error) {
        console.warn("⚠️ Could not log activity:", error);
        // Don't throw - activity logging should not break the main operation
      }
    } catch (err) {
      console.warn("⚠️ Unexpected error logging activity:", err);
      // Don't throw - activity logging should not break the main operation
    }
  }

  /**
   * Get project activity feed
   */
  static async getProjectActivity(
    projectId: string,
    limit = 50
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from("project_activity")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ==================== USER PREFERENCES ====================

  /**
   * Get user preferences
   */
  static async getUserPreferences(): Promise<any> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  }

  /**
   * Update user preferences
   */
  static async updateUserPreferences(
    preferences: Record<string, any>
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase.from("user_preferences").upsert([
      {
        user_id: user.id,
        ...preferences,
      },
    ]);

    if (error) throw error;
  }
}
