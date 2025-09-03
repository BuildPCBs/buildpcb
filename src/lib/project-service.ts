"use client";

import { DatabaseService, Project } from "@/lib/database";
import { Circuit } from "@/lib/schemas/circuit";

export interface ProjectLoadResult {
  project: Project;
  isNewProject: boolean;
  isFirstTimeUser: boolean;
}

export class ProjectService {
  /**
   * Smart project loading logic for the IDE
   * Implements the three scenarios:
   * 1. Brand new user -> Create "Untitled" project
   * 2. Returning user with named projects -> Load most recent
   * 3. Returning user with only "Untitled" -> Load existing "Untitled"
   *
   * Returns project info for URL routing
   */
  static async loadOrCreateProject(): Promise<ProjectLoadResult> {
    try {
      // Get all user projects ordered by most recently updated
      const projects = await DatabaseService.getUserProjects();

      // Scenario 1: Brand new user (no projects)
      if (projects.length === 0) {
        console.log("🆕 Brand new user - creating first project");
        const newProject = await this.createUntitledProject();
        return {
          project: newProject,
          isNewProject: true,
          isFirstTimeUser: true,
        };
      }

      // Get the most recently updated project
      const mostRecentProject = projects[0];

      // Scenario 2: User has projects and the most recent one has a custom name
      if (mostRecentProject.name !== "Untitled") {
        console.log(
          "👋 Returning user - loading most recent project:",
          mostRecentProject.name
        );
        await DatabaseService.updateLastOpened(mostRecentProject.id);
        return {
          project: mostRecentProject,
          isNewProject: false,
          isFirstTimeUser: false,
        };
      }

      // Scenario 3: User's most recent project is still "Untitled"
      // (they haven't renamed their first project)
      console.log('🔄 Returning user - continuing with "Untitled" project');
      await DatabaseService.updateLastOpened(mostRecentProject.id);
      return {
        project: mostRecentProject,
        isNewProject: false,
        isFirstTimeUser: false,
      };
    } catch (error) {
      console.error("❌ Error loading project:", error);
      console.error("❌ Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
      });

      // Fallback: Create a new "Untitled" project if there's any error
      console.log('🔧 Fallback - creating new "Untitled" project due to error');
      const fallbackProject = await this.createUntitledProject();
      return {
        project: fallbackProject,
        isNewProject: true,
        isFirstTimeUser: false, // We don't know for sure, but assume not
      };
    }
  }

  /**
   * Create a new "Untitled" project with empty circuit data
   */
  private static async createUntitledProject(): Promise<Project> {
    console.log('🆕 Creating new "Untitled" project...');

    try {
      const emptyCircuit: Circuit = {
        mode: "full",
        components: [],
        connections: [],
        description: "New PCB design project",
      };

      const newProject = await DatabaseService.createProject({
        name: "Untitled",
        description: "New PCB design project",
        is_public: false,
        canvas_settings: {
          zoom: 1,
          pan: { x: 0, y: 0 },
          gridVisible: true,
          gridSize: 20,
        },
        grid_settings: {
          size: 20,
          visible: true,
          snap: true,
        },
      });

      console.log('✅ "Untitled" project created successfully:', newProject.id);
      return newProject;
    } catch (error) {
      console.error("❌ Error creating Untitled project:", error);
      console.error("❌ Create project error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
      });
      throw error;
    }
  }

  /**
   * Save project data (circuit + canvas state)
   */
  static async saveProject(
    projectId: string,
    circuitData: Circuit,
    canvasData: Record<string, any>
  ): Promise<void> {
    try {
      // Update the project's last modified time
      await DatabaseService.updateProject(projectId, {
        updated_at: new Date().toISOString(),
        canvas_settings: canvasData,
      });

      // Create a new version with the circuit data
      await DatabaseService.createVersion(
        projectId,
        circuitData,
        canvasData,
        "Auto-save"
      );

      console.log("💾 Project saved successfully");
    } catch (error) {
      console.error("❌ Error saving project:", error);
      throw error;
    }
  }

  /**
   * Rename a project (especially useful for changing from "Untitled")
   */
  static async renameProject(
    projectId: string,
    newName: string
  ): Promise<Project> {
    return await DatabaseService.updateProject(projectId, {
      name: newName,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Load the latest circuit data for a project
   */
  static async loadProjectCircuit(projectId: string): Promise<Circuit | null> {
    try {
      const latestVersion = await DatabaseService.getLatestVersion(projectId);
      return latestVersion?.circuit_data || null;
    } catch (error) {
      console.error("❌ Error loading project circuit:", error);
      return null;
    }
  }
}

export default ProjectService;
