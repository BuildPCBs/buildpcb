import { supabase, supabaseAdmin } from "@/lib/supabase";
import { Circuit } from "@/lib/schemas/circuit";
import { logger } from "./logger";

/**
 * Validate netlist data structure
 */
function validateNetlist(netlist: any[]): boolean {
  if (!Array.isArray(netlist)) {
    logger.api("❌ Netlist validation failed: not an array");
    return false;
  }

  const netIds = new Set<string>();

  for (let i = 0; i < netlist.length; i++) {
    const net = netlist[i];

    // Check net structure
    if (!net || typeof net !== "object") {
      logger.api(`❌ Netlist validation failed: net ${i} is not an object`);
      return false;
    }

    if (!net.netId || typeof net.netId !== "string") {
      logger.api(`❌ Netlist validation failed: net ${i} missing valid netId`);
      return false;
    }

    if (netIds.has(net.netId)) {
      logger.api(`❌ Netlist validation failed: duplicate netId ${net.netId}`);
      return false;
    }
    netIds.add(net.netId);

    if (!Array.isArray(net.connections)) {
      logger.api(
        `❌ Netlist validation failed: net ${net.netId} connections not an array`
      );
      return false;
    }

    // Check connections
    for (let j = 0; j < net.connections.length; j++) {
      const conn = net.connections[j];

      if (!conn || typeof conn !== "object") {
        logger.api(
          `❌ Netlist validation failed: net ${net.netId} connection ${j} is not an object`
        );
        return false;
      }

      if (!conn.componentId || typeof conn.componentId !== "string") {
        logger.api(
          `❌ Netlist validation failed: net ${net.netId} connection ${j} missing valid componentId`
        );
        return false;
      }

      if (!conn.pinNumber || typeof conn.pinNumber !== "string") {
        logger.api(
          `❌ Netlist validation failed: net ${net.netId} connection ${j} missing valid pinNumber`
        );
        return false;
      }
    }

    // Optional name field
    if (net.name !== undefined && typeof net.name !== "string") {
      logger.api(
        `❌ Netlist validation failed: net ${net.netId} name is not a string`
      );
      return false;
    }
  }

  logger.api(`✅ Netlist validation passed: ${netlist.length} nets validated`);
  return true;
}

export interface Project {
  id: string;
  name?: string;
  description?: string;
  owner_id: string;
  is_public: boolean;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  canvas_settings: Record<string, any>;
  grid_settings: Record<string, any>;
  netlist_data?: any[]; // NEW: Netlist data for the project
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
  netlist_data?: any[]; // NEW: Netlist data for this version
  changelog?: string;
  is_major_version: boolean;
  parent_version_id?: string;
}

// Component from components_index (for search and AI)
export interface ComponentIndex {
  uid: string;
  name: string;
  embedding_vector?: number[];
  category: string;
  subcategory?: string;
  pin_count: number;
  component_type: string;
  description: string;
  keywords: string;
  footprint: string;
  datasheet: string;
  search_text: string;
  created_at: string;
  updated_at: string;
  old_uid?: string;
}

// Component from components_v2 (full details with SVG)
export interface ComponentDetails {
  uid: string;
  name: string;
  package_id: string;
  unit_id: string;
  symbol_svg: string;
  symbol_data: string; // JSON string containing pins, bbox, etc.
  created_at: string;
  updated_at: string;
  is_graphical_symbol: boolean;
  category?: string;
  subcategory?: string;
  pin_count?: number;
  component_type?: string;
  is_power_symbol: boolean;
}

// Legacy Component interface (keeping for compatibility)
export interface Component {
  uid?: string;
  id?: string;
  name: string;
  type?: string;
  category: string;
  description?: string;
  specifications?: Record<string, any>;
  pin_configuration?: Record<string, any>;
  electrical_properties?: Record<string, any>;
  symbol_svg?: string;
  footprint_data?: Record<string, any>;
  datasheet_url?: string;
  manufacturer?: string;
  part_number?: string;
  is_verified?: boolean;
  created_by?: string;
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
    logger.api("Getting user projects...");

    // Check if user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      logger.api("Auth error getting user:", userError);
      throw new Error(`Authentication error: ${userError.message}`);
    }

    if (!user) {
      logger.api("No authenticated user found");
      throw new Error("User not authenticated");
    }

    logger.api("User authenticated:", user.email);

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      logger.api("Database error getting projects:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    logger.api("Projects retrieved:", data?.length || 0, "projects");
    return data || [];
  }

  /**
   * Get a specific project by ID
   */
  static async getProject(projectId: string): Promise<Project | null> {
    logger.api("Getting project by ID:", projectId);

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
        logger.api("Project not found:", projectId);
        return null;
      }
      logger.api("Database error getting project:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    logger.api("Project retrieved:", {
      name: data.name,
      hasCanvasSettings: !!data.canvas_settings,
      canvasSettingsKeys: data.canvas_settings
        ? Object.keys(data.canvas_settings)
        : [],
      hasChatDataInSettings: !!data.canvas_settings?.chatData,
      chatMessageCountInSettings:
        data.canvas_settings?.chatData?.messages?.length || 0,
      canvasSettingsSize: data.canvas_settings
        ? JSON.stringify(data.canvas_settings).length
        : 0,
    });
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
    logger.api("Creating new project...", {
      name: projectData.name || "unnamed",
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("❌ No authenticated user for project creation");
      throw new Error("User not authenticated");
    }

    logger.api("User authenticated for project creation:", user.email);

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

    logger.api("Project created successfully:", data.name, "ID:", data.id);

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
    logger.api("Getting latest version for project:", projectId);

    const { data, error } = await supabase
      .from("project_versions")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    // Validate netlist data if present
    if (
      data?.netlist_data &&
      Array.isArray(data.netlist_data) &&
      data.netlist_data.length > 0
    ) {
      if (!validateNetlist(data.netlist_data)) {
        logger.api("❌ Loaded netlist data is invalid, setting to null");
        data.netlist_data = null;
      } else {
        logger.api(
          `✅ Loaded valid netlist with ${data.netlist_data.length} nets`
        );
      }
    }

    logger.api("Latest version data:", {
      hasData: !!data,
      versionNumber: data?.version_number,
      hasCanvasData: !!data?.canvas_data,
      canvasDataKeys: data?.canvas_data ? Object.keys(data.canvas_data) : [],
      hasChatDataInCanvas: !!data?.canvas_data?.chatData,
      chatMessageCount: data?.canvas_data?.chatData?.messages?.length || 0,
      canvasDataSize: data?.canvas_data
        ? JSON.stringify(data.canvas_data).length
        : 0,
      hasNetlistData: !!data?.netlist_data,
      netlistNetCount: data?.netlist_data?.length || 0,
    });

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
    changelog?: string,
    netlistData?: any[] // NEW: Netlist data parameter
  ): Promise<ProjectVersion> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // Validate netlist data if provided
    if (netlistData !== undefined && netlistData.length > 0) {
      if (!validateNetlist(netlistData)) {
        throw new Error("Invalid netlist data provided for version creation");
      }
    }

    // Use a retry mechanism to handle concurrent version creation
    let retries = 3;
    while (retries > 0) {
      try {
        // Get the next version number
        const { data: latestVersion } = await supabase
          .from("project_versions")
          .select("version_number")
          .eq("project_id", projectId)
          .order("version_number", { ascending: false })
          .limit(1)
          .single();

        const nextVersionNumber = (latestVersion?.version_number || 0) + 1;

        logger.api(
          "Creating version",
          nextVersionNumber,
          "for project",
          projectId,
          "with netlist:",
          netlistData?.length || 0,
          "nets"
        );

        const { data, error } = await supabase
          .from("project_versions")
          .insert([
            {
              project_id: projectId,
              version_number: nextVersionNumber,
              version_name: versionName,
              circuit_data: circuitData,
              canvas_data: canvasData,
              netlist_data: netlistData || [], // NEW: Store netlist data
              changelog,
              created_by: user.id,
            },
          ])
          .select()
          .single();

        if (error) {
          if (error.code === "23505" && retries > 1) {
            // Duplicate key violation, retry with delay
            console.warn(
              "⚠️ Version number collision, retrying...",
              retries - 1,
              "attempts left"
            );
            retries--;
            await new Promise((resolve) =>
              setTimeout(resolve, Math.random() * 1000)
            ); // Random delay
            continue;
          }
          throw error;
        }

        // Update project's updated_at timestamp AND netlist_data cache
        await this.updateProject(projectId, {
          netlist_data: netlistData || [], // NEW: Update projects cache
        });

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
        }

        return data;
      } catch (error: any) {
        if (retries === 1) {
          // Last attempt failed
          console.error("❌ Version creation failed after all retries:", error);
          throw error;
        }

        // Check if it's a timeout error
        const isTimeout =
          error?.code === "57014" || error?.message?.includes("timeout");

        if (isTimeout) {
          console.warn("⏱️ Database timeout, retrying with longer delay...", {
            retriesLeft: retries - 1,
            errorCode: error?.code,
          });
          retries--;
          // Longer delay for timeout errors
          await new Promise((resolve) =>
            setTimeout(resolve, 2000 + Math.random() * 1000)
          );
        } else {
          retries--;
          console.warn("⚠️ Version creation failed, retrying...", error);
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 1000)
          );
        }
      }
    }

    throw new Error("Failed to create version after multiple attempts");
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
  ): Promise<ComponentIndex[]> {
    let queryBuilder = supabaseAdmin.from("components_index").select("*");

    if (query) {
      // Use text search on search_text field
      queryBuilder = queryBuilder.ilike("search_text", `%${query}%`);
    }

    if (category) {
      queryBuilder = queryBuilder.eq("category", category);
    }

    const { data, error } = await queryBuilder.order("name").limit(limit);

    if (error) {
      console.error("Search components error:", error);
      throw error;
    }
    return data || [];
  }

  /**
   * Search components using semantic vector similarity
   */
  static async searchComponentsSemantic(
    query: string,
    category?: string,
    limit = 50,
    similarityThreshold = 0.7 // Increase to 0.8-0.9 for more relevant but fewer results
  ): Promise<ComponentIndex[]> {
    if (!query.trim()) {
      // Fallback to regular search if no query
      return this.searchComponents(query, category, limit);
    }

    try {
      // Call the semantic search API route
      const searchStart = Date.now();
      const response = await fetch("/api/semantic-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          category,
          limit,
          similarityThreshold,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(
          "Semantic search API failed, falling back to text search:",
          errorText
        );
        return this.searchComponents(query, category, limit);
      }

      const result = await response.json();
      console.log(
        `Semantic search took ${Date.now() - searchStart}ms, found ${
          result.components?.length || 0
        } results`
      );

      return result.components || [];
    } catch (error) {
      console.warn(
        "Semantic search failed, falling back to text search:",
        error
      );
      return this.searchComponents(query, category, limit);
    }
  }

  /**
   * Get component categories
   */
  static async getComponentCategories(): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from("components_index")
      .select("category")
      .order("category");

    if (error) {
      console.error("Get categories error:", error);
      throw error;
    }

    // Return unique categories
    const categories = [...new Set(data?.map((item) => item.category) || [])];
    return categories.filter(Boolean);
  }

  /**
   * Get frequently used components for a user
   */
  static async getFrequentComponents(limit = 20): Promise<ComponentIndex[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Return some popular components if no user
        const { data, error } = await supabaseAdmin
          .from("components_index")
          .select("*")
          .limit(limit);

        if (error) {
          console.error("Get frequent components (fallback) error:", error);
          return [];
        }
        return data || [];
      }

      // First, get the component IDs from usage table
      const { data: usageData, error: usageError } = await supabase
        .from("component_usage")
        .select("component_id")
        .eq("user_id", user.id)
        .order("used_at", { ascending: false })
        .limit(limit);

      if (usageError) {
        console.error("Get component usage error:", usageError);
        // Fallback to popular components using admin client
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from("components_index")
          .select("*")
          .limit(limit);

        if (fallbackError) {
          console.error(
            "Get frequent components (fallback) error:",
            fallbackError
          );
          return [];
        }
        return fallbackData || [];
      }

      if (!usageData || usageData.length === 0) {
        // No usage data, return popular components
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from("components_index")
          .select("*")
          .limit(limit);

        if (fallbackError) {
          console.error(
            "Get frequent components (no usage) error:",
            fallbackError
          );
          return [];
        }
        return fallbackData || [];
      }

      // Get component details for the used component IDs
      const componentIds = usageData.map((item) => item.component_id);
      const { data: componentsData, error: componentsError } =
        await supabaseAdmin
          .from("components_index")
          .select("*")
          .in("uid", componentIds);

      if (componentsError) {
        console.error("Get components by IDs error:", componentsError);
        // Final fallback to popular components
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from("components_index")
          .select("*")
          .limit(limit);

        if (fallbackError) {
          console.error(
            "Get frequent components (final fallback) error:",
            fallbackError
          );
          return [];
        }
        return fallbackData || [];
      }

      // Return components in the order they were used (preserve usage order)
      const orderedComponents = componentIds
        .map((id) => componentsData?.find((comp) => comp.uid === id))
        .filter(Boolean);

      return orderedComponents;
    } catch (error) {
      console.error("Get frequent components error:", error);

      // Final fallback - always return some components
      try {
        const { data, error } = await supabaseAdmin
          .from("components_index")
          .select("*")
          .limit(limit);

        if (!error && data) {
          return data;
        }
      } catch (fallbackError) {
        console.error("Final fallback error:", fallbackError);
      }

      return [];
    }
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

  /**
   * Get full component details including SVG from components_v2
   */
  static async getComponentDetails(
    uid: string
  ): Promise<ComponentDetails | null> {
    const { data, error } = await supabaseAdmin
      .from("components_v2")
      .select("*")
      .eq("uid", uid)
      .single();

    if (error) {
      console.error("Get component details error:", error);
      return null;
    }

    return data;
  }

  /**
   * Get component details by name (fallback method)
   */
  static async getComponentDetailsByName(
    name: string
  ): Promise<ComponentDetails | null> {
    const { data, error } = await supabaseAdmin
      .from("components_v2")
      .select("*")
      .eq("name", name)
      .single();

    if (error) {
      console.error("Get component details by name error:", error);
      return null;
    }

    return data;
  }

  /**
   * Get both search metadata and full details for a component
   */
  static async getFullComponentInfo(uid: string): Promise<{
    index: ComponentIndex | null;
    details: ComponentDetails | null;
  }> {
    const [indexResult, detailsResult] = await Promise.allSettled([
      supabaseAdmin
        .from("components_index")
        .select("*")
        .eq("uid", uid)
        .single(),
      supabaseAdmin.from("components_v2").select("*").eq("uid", uid).single(),
    ]);

    return {
      index:
        indexResult.status === "fulfilled" && !indexResult.value.error
          ? indexResult.value.data
          : null,
      details:
        detailsResult.status === "fulfilled" && !detailsResult.value.error
          ? detailsResult.value.data
          : null,
    };
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
