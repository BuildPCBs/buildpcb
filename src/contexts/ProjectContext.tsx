"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Project, DatabaseService } from "@/lib/database";
import { Circuit } from "@/lib/schemas/circuit";
import { ProjectService, ProjectLoadResult } from "@/lib/project-service";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface ProjectContextType {
  // Current project state
  currentProject: Project | null;
  currentCircuit: Circuit | null;
  isLoading: boolean;
  error: string | null;

  // Project operations
  loadProject: () => Promise<void>;
  loadSpecificProject: (projectId: string) => Promise<void>;
  saveProject: (
    circuitData: Circuit,
    canvasData: Record<string, any>
  ) => Promise<void>;
  renameProject: (newName: string) => Promise<void>;
  restoreCanvasData: (canvas: any) => Promise<void>;

  // Project info
  isNewProject: boolean;
  isFirstTimeUser: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [currentCircuit, setCurrentCircuit] = useState<Circuit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewProject, setIsNewProject] = useState(false);
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);

  // Load project when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log("🔄 User authenticated, loading project...");
      loadProject();
    } else if (!isAuthenticated) {
      // Clear project state when not authenticated
      console.log("🚪 User not authenticated, clearing project state");
      setCurrentProject(null);
      setCurrentCircuit(null);
      setIsLoading(false);
      setError(null);
    } else if (authLoading) {
      console.log("⏳ Still loading auth state...");
    }
  }, [isAuthenticated, authLoading]);

  const loadSpecificProject = useCallback(
    async (projectId: string) => {
      if (!isAuthenticated) {
        setError("User not authenticated");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        console.log("🔄 Loading specific project:", projectId);

        // Load the specific project from database
        const project = await DatabaseService.getProject(projectId);
        if (!project) {
          throw new Error("Project not found");
        }

        setCurrentProject(project);
        setIsNewProject(false);
        setIsFirstTimeUser(false);

        // Load the circuit data for this project
        const latestVersion = await DatabaseService.getLatestVersion(
          project.id
        );

        // If no version data exists, create an empty circuit
        const circuit: Circuit = latestVersion?.circuit_data || {
          mode: "full",
          components: [],
          connections: [],
          description: project.description || "PCB design project",
        };

        setCurrentCircuit(circuit);

        // Store canvas data for later restoration (when canvas is ready)
        // Prioritize project-level canvas_settings if available, otherwise use version data
        const canvasData =
          project.canvas_settings || latestVersion?.canvas_data;
        if (canvasData) {
          setCurrentProject((prev) =>
            prev
              ? {
                  ...prev,
                  canvas_settings: canvasData,
                }
              : null
          );
        }

        // Update last opened timestamp
        await DatabaseService.updateLastOpened(project.id);

        console.log("✅ Specific project loaded successfully:", {
          projectName: project.name,
          projectId: project.id,
          componentCount: circuit.components.length,
          connectionCount: circuit.connections.length,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load project";
        setError(errorMessage);
        console.error("❌ Error loading specific project:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated]
  );

  const loadProject = useCallback(async () => {
    if (!isAuthenticated) {
      setError("User not authenticated");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log("🔄 Loading project for authenticated user...");

      // Small delay to ensure auth state is propagated to Supabase
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Use the smart project loading logic
      const result: ProjectLoadResult =
        await ProjectService.loadOrCreateProject();

      setCurrentProject(result.project);
      setIsNewProject(result.isNewProject);
      setIsFirstTimeUser(result.isFirstTimeUser);

      // Load the circuit data for this project
      const circuitData = await ProjectService.loadProjectCircuit(
        result.project.id
      );

      // If no circuit data exists, create an empty one
      const circuit: Circuit = circuitData || {
        mode: "full",
        components: [],
        connections: [],
        description: result.project.description || "New PCB design project",
      };

      setCurrentCircuit(circuit);

      console.log("✅ Project loaded successfully:", {
        projectName: result.project.name,
        isNewProject: result.isNewProject,
        isFirstTimeUser: result.isFirstTimeUser,
        componentCount: circuit.components.length,
        connectionCount: circuit.connections.length,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load project";
      setError(errorMessage);
      console.error("❌ Error loading project:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const saveProject = useCallback(
    async (circuitData: Circuit, canvasData: Record<string, any>) => {
      if (!currentProject) {
        throw new Error("No project loaded");
      }

      try {
        await ProjectService.saveProject(
          currentProject.id,
          circuitData,
          canvasData
        );
        setCurrentCircuit(circuitData);

        // Update the project's updated_at time in our local state
        setCurrentProject((prev) =>
          prev
            ? {
                ...prev,
                updated_at: new Date().toISOString(),
              }
            : null
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save project";
        throw new Error(errorMessage);
      }
    },
    [currentProject]
  );

  const renameProject = useCallback(
    async (newName: string) => {
      if (!currentProject) {
        throw new Error("No project loaded");
      }

      try {
        await DatabaseService.updateProject(currentProject.id, {
          name: newName,
        });
        setCurrentProject((prev) => (prev ? { ...prev, name: newName } : null));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to rename project";
        throw new Error(errorMessage);
      }
    },
    [currentProject]
  );

  const restoreCanvasData = useCallback(
    async (canvas: any) => {
      if (!currentProject?.canvas_settings) {
        console.log("ℹ️ No canvas data to restore");
        return;
      }

      try {
        console.log("🔄 Restoring canvas data:", {
          hasObjects: currentProject.canvas_settings.objects?.length || 0,
          hasViewport: !!currentProject.canvas_settings.viewportTransform,
          zoom: currentProject.canvas_settings.zoom,
        });

        // Import the canvas restoration function
        const { loadCanvasFromData } = await import(
          "@/canvas/utils/canvasSerializer"
        );

        await loadCanvasFromData(canvas, currentProject.canvas_settings);

        console.log("✅ Canvas data restored successfully");
      } catch (error) {
        console.error("❌ Failed to restore canvas data:", error);
      }
    },
    [currentProject]
  );

  const value: ProjectContextType = {
    currentProject,
    currentCircuit,
    isLoading,
    error,
    loadProject,
    loadSpecificProject,
    saveProject,
    renameProject,
    restoreCanvasData,
    isNewProject,
    isFirstTimeUser,
  };

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

export default ProjectProvider;
