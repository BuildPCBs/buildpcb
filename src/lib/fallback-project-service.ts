"use client";

import { Project } from "@/lib/database";
import { Circuit } from "@/lib/schemas/circuit";
import { logger } from "./logger";

export interface ProjectLoadResult {
  project: Project;
  isNewProject: boolean;
  isFirstTimeUser: boolean;
}

/**
 * Fallback ProjectService that works with local storage
 * until the database schema is properly set up
 */
export class FallbackProjectService {
  private static readonly STORAGE_KEY = "buildpcb_fallback_project";
  private static readonly USER_KEY = "buildpcb_fallback_user_setup";

  /**
   * Smart project loading logic using localStorage as fallback
   */
  static async loadOrCreateProject(): Promise<ProjectLoadResult> {
    try {
      logger.api("Using fallback project service (localStorage)");

      // Check if this is the first time the user is using the app
      const isFirstTimeUser = !localStorage.getItem(this.USER_KEY);

      // Try to load existing project from localStorage
      const existingProject = this.loadFromStorage();

      if (existingProject) {
        logger.api(
          "Returning user - loading existing project:",
          existingProject.name
        );
        return {
          project: existingProject,
          isNewProject: false,
          isFirstTimeUser: false,
        };
      }

      // Create new project for first-time or returning users without saved projects
      logger.api("Creating new project for user");
      const newProject = this.createUntitledProject();
      this.saveToStorage(newProject);

      // Mark user as no longer first-time
      localStorage.setItem(this.USER_KEY, "true");

      return {
        project: newProject,
        isNewProject: true,
        isFirstTimeUser,
      };
    } catch (error) {
      console.error("❌ Error in fallback project service:", error);

      // Ultimate fallback - create a basic project
      const fallbackProject = this.createUntitledProject();
      return {
        project: fallbackProject,
        isNewProject: true,
        isFirstTimeUser: false,
      };
    }
  }

  /**
   * Create a new "Untitled" project
   */
  private static createUntitledProject(): Project {
    const now = new Date().toISOString();
    const projectId = `fallback-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      id: projectId,
      name: "Untitled",
      description: "New PCB design project",
      owner_id: "fallback-user",
      is_public: false,
      thumbnail_url: undefined,
      created_at: now,
      updated_at: now,
      last_opened_at: now,
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
      tags: [],
      category: undefined,
    };
  }

  /**
   * Save project to localStorage
   */
  static saveProject(
    projectId: string,
    circuitData: Circuit,
    canvasData: Record<string, any>
  ): Promise<void> {
    return new Promise((resolve) => {
      try {
        const project = this.loadFromStorage();
        if (project && project.id === projectId) {
          project.updated_at = new Date().toISOString();
          project.canvas_settings = {
            ...project.canvas_settings,
            ...canvasData,
          };

          // Save both project and circuit data
          localStorage.setItem(
            this.STORAGE_KEY,
            JSON.stringify({
              project,
              circuit: circuitData,
            })
          );

          logger.api("Project saved to localStorage");
        }
        resolve();
      } catch (error) {
        console.error("❌ Error saving project to localStorage:", error);
        resolve(); // Don't fail, just log the error
      }
    });
  }

  /**
   * Rename a project
   */
  static async renameProject(
    projectId: string,
    newName: string
  ): Promise<Project> {
    const project = this.loadFromStorage();
    if (project && project.id === projectId) {
      project.name = newName;
      project.updated_at = new Date().toISOString();
      this.saveToStorage(project);
      logger.api("Project renamed to:", newName);
    }
    return project!;
  }

  /**
   * Load circuit data for a project
   */
  static async loadProjectCircuit(projectId: string): Promise<Circuit | null> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.circuit || null;
      }
    } catch (error) {
      console.error("❌ Error loading circuit from localStorage:", error);
    }
    return null;
  }

  /**
   * Load project from localStorage
   */
  private static loadFromStorage(): Project | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.project || null;
      }
    } catch (error) {
      console.error("❌ Error loading project from localStorage:", error);
    }
    return null;
  }

  /**
   * Save project to localStorage
   */
  private static saveToStorage(project: Project): void {
    try {
      const existingData = localStorage.getItem(this.STORAGE_KEY);
      let circuit = null;

      if (existingData) {
        const parsed = JSON.parse(existingData);
        circuit = parsed.circuit;
      }

      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          project,
          circuit: circuit || {
            mode: "full",
            components: [],
            connections: [],
            description: project.description,
          },
        })
      );
    } catch (error) {
      console.error("❌ Error saving project to localStorage:", error);
    }
  }

  /**
   * Clear all fallback data (useful for testing)
   */
  static clearFallbackData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.USER_KEY);
    logger.api("Fallback data cleared");
  }
}

export default FallbackProjectService;
