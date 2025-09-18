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
import { loadCanvasFromLogicalCircuit } from "@/canvas/utils/logicalSerializer";

interface ProjectContextType {
  // Current project state
  currentProject: Project | null;
  currentCircuit: Circuit | null;
  currentNetlist: any[] | null; // NEW: Current netlist state
  isLoading: boolean;
  error: string | null;

  // Project operations
  loadProject: () => Promise<void>;
  loadSpecificProject: (projectId: string) => Promise<void>;
  saveProject: (
    circuitData: Circuit,
    canvasData: Record<string, any>,
    chatData?: Record<string, any>,
    netlistData?: any[] // NEW: Netlist data parameter
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
  const [currentNetlist, setCurrentNetlist] = useState<any[] | null>(null); // NEW: Netlist state
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

        console.log("🔄 Specific project loading details:", {
          projectId: project.id,
          projectName: project.name,
          hasLatestVersion: !!latestVersion,
          latestVersionNumber: latestVersion?.version_number,
          hasVersionCanvasData: !!latestVersion?.canvas_data,
          hasProjectCanvasSettings: !!project.canvas_settings,
          versionCanvasDataKeys: latestVersion?.canvas_data
            ? Object.keys(latestVersion.canvas_data)
            : [],
          projectCanvasSettingsKeys: project.canvas_settings
            ? Object.keys(project.canvas_settings)
            : [],
        });

        // If no version data exists, create an empty circuit
        const circuit: Circuit = latestVersion?.circuit_data || {
          mode: "full",
          components: [],
          connections: [],
          description: project.description || "PCB design project",
        };

        setCurrentCircuit(circuit);

        // Load the netlist data for this project
        const netlist: any[] = latestVersion?.netlist_data || [];
        setCurrentNetlist(netlist);

        // Store canvas data for later restoration (when canvas is ready)
        // ALWAYS prioritize latest version data over project settings
        const canvasData = latestVersion?.canvas_data;

        console.log("🔄 Canvas data selection:", {
          usingLatestVersion: !!latestVersion?.canvas_data,
          hasProjectSettings: !!project.canvas_settings,
          finalCanvasDataKeys: canvasData ? Object.keys(canvasData) : [],
          hasChatData: !!canvasData?.chatData,
          chatMessageCount: canvasData?.chatData?.messages?.length || 0,
        });

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
          netlistCount: netlist.length,
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

      // Load the latest version to get both circuit and canvas data
      const latestVersion = await DatabaseService.getLatestVersion(
        result.project.id
      );

      console.log("🔄 Project loading details:", {
        projectId: result.project.id,
        projectName: result.project.name,
        hasLatestVersion: !!latestVersion,
        latestVersionNumber: latestVersion?.version_number,
        hasVersionCanvasData: !!latestVersion?.canvas_data,
        hasProjectCanvasSettings: !!result.project.canvas_settings,
        versionCanvasDataKeys: latestVersion?.canvas_data
          ? Object.keys(latestVersion.canvas_data)
          : [],
        projectCanvasSettingsKeys: result.project.canvas_settings
          ? Object.keys(result.project.canvas_settings)
          : [],
      });

      // Load the circuit data for this project
      const circuit: Circuit = latestVersion?.circuit_data || {
        mode: "full",
        components: [],
        connections: [],
        description: result.project.description || "New PCB design project",
      };

      setCurrentCircuit(circuit);

      // Load the netlist data for this project
      const netlist: any[] = latestVersion?.netlist_data || [];
      setCurrentNetlist(netlist);

      // Load canvas data - ALWAYS prioritize latest version data
      const canvasData = latestVersion?.canvas_data;

      console.log("🔄 Loading canvas data for project:", {
        projectName: result.project.name,
        hasLatestVersion: !!latestVersion,
        hasVersionCanvasData: !!latestVersion?.canvas_data,
        hasProjectCanvasSettings: !!result.project.canvas_settings,
        versionCanvasDataKeys: latestVersion?.canvas_data
          ? Object.keys(latestVersion.canvas_data)
          : [],
        projectCanvasSettingsKeys: result.project.canvas_settings
          ? Object.keys(result.project.canvas_settings)
          : [],
        finalCanvasDataKeys: canvasData ? Object.keys(canvasData) : [],
        hasChatDataInVersion: !!latestVersion?.canvas_data?.chatData,
        hasChatDataInProject: !!result.project.canvas_settings?.chatData,
        finalHasChatData: !!canvasData?.chatData,
      });

      // Only update project canvas_settings if we have latest version data
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

      console.log("✅ Project loaded successfully:", {
        projectName: result.project.name,
        isNewProject: result.isNewProject,
        isFirstTimeUser: result.isFirstTimeUser,
        componentCount: circuit.components.length,
        connectionCount: circuit.connections.length,
        netlistCount: netlist.length,
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
    async (
      circuitData: Circuit,
      canvasData: Record<string, any>,
      chatData?: Record<string, any>,
      netlistData?: any[] // NEW: Netlist data parameter
    ) => {
      if (!currentProject) {
        throw new Error("No project loaded");
      }

      try {
        // Import the circuit serializer
        const { serializeCanvasToCircuit } = await import(
          "@/canvas/utils/canvasSerializer"
        );

        // Get the current canvas from the canvas command manager
        const { canvasCommandManager } = await import(
          "@/canvas/canvas-command-manager"
        );
        const canvasInstance = canvasCommandManager.getCanvas();

        // Serialize canvas to circuit format instead of raw data
        const circuitFromCanvas = serializeCanvasToCircuit(canvasInstance);

        // Merge with provided circuit data
        const finalCircuitData = {
          ...circuitData,
          ...circuitFromCanvas,
          components: [
            ...(circuitData.components || []),
            ...(circuitFromCanvas?.components || []),
          ],
          connections: [
            ...(circuitData.connections || []),
            ...(circuitFromCanvas?.connections || []),
          ],
        } as Circuit;

        await ProjectService.saveProject(
          currentProject.id,
          finalCircuitData,
          canvasData,
          chatData,
          netlistData // NEW: Pass netlist data
        );
        setCurrentCircuit(finalCircuitData);

        // Update the project's updated_at time and canvas_settings in our local state
        // Include chat data in the canvas_settings for proper local state sync
        const extendedCanvasData = {
          ...canvasData,
          chatData: chatData || null,
        };

        setCurrentProject((prev) =>
          prev
            ? {
                ...prev,
                updated_at: new Date().toISOString(),
                canvas_settings: extendedCanvasData,
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
      console.log("🔄 restoreCanvasData called:", {
        timestamp: new Date().toISOString(),
        hasCurrentProject: !!currentProject,
        hasCanvasSettings: !!currentProject?.canvas_settings,
        canvasSettingsKeys: currentProject?.canvas_settings
          ? Object.keys(currentProject.canvas_settings)
          : [],
        hasChatDataInSettings: !!currentProject?.canvas_settings?.chatData,
        chatMessageCountInSettings:
          currentProject?.canvas_settings?.chatData?.messages?.length || 0,
      });

      if (!currentProject?.canvas_settings) {
        console.log("ℹ️ No canvas data to restore");
        return;
      }

      try {
        console.log("🔄 Restoring canvas data:", {
          hasObjects: currentProject.canvas_settings.objects?.length || 0,
          hasViewport: !!currentProject.canvas_settings.viewportTransform,
          zoom: currentProject.canvas_settings.zoom,
          hasChatData: !!currentProject.canvas_settings.chatData,
          chatDataType: typeof currentProject.canvas_settings.chatData,
          chatDataKeys: currentProject.canvas_settings.chatData
            ? Object.keys(currentProject.canvas_settings.chatData)
            : [],
        });

        // Extract chat data before loading canvas
        const chatData = currentProject.canvas_settings.chatData;
        const canvasDataWithoutChat = { ...currentProject.canvas_settings };
        delete canvasDataWithoutChat.chatData;

        // Load circuit data to recreate components
        if (currentCircuit) {
          console.log("🔄 Loading components using logical circuit loader...", {
            componentCount: currentCircuit.components?.length || 0,
            firstComponent: currentCircuit.components?.[0],
          });

          try {
            await loadCanvasFromLogicalCircuit(canvas, currentCircuit as any);
            console.log("✅ Logical circuit loading completed");

            // DEBUG: Check how many objects are actually on the canvas
            const canvasObjects = canvas.getObjects();
            console.log("🔍 Canvas objects after component loading:", {
              totalObjects: canvasObjects.length,
              components: canvasObjects.filter(
                (obj: any) => obj.data?.type === "component"
              ).length,
              groups: canvasObjects.filter((obj: any) => obj.type === "group")
                .length,
              objectTypes: canvasObjects.map((obj: any) => ({
                type: obj.type,
                dataType: obj.data?.type,
              })),
            });
          } catch (error) {
            console.error(
              "❌ Logical circuit loading failed, trying fallback:",
              error
            );

            // Fallback to basic circuit loader if logical fails
            const { loadCanvasFromCircuit } = await import(
              "@/canvas/utils/canvasSerializer"
            );
            await loadCanvasFromCircuit(canvas, currentCircuit);
            console.log("✅ Fallback circuit loading completed");
          }
        }

        // Restore netlist if available - Use currentNetlist which comes from project_versions.netlist_data
        if (
          currentNetlist &&
          Array.isArray(currentNetlist) &&
          currentNetlist.length > 0
        ) {
          console.log("🔗 Restoring netlist from netlist_data:", {
            netCount: currentNetlist.length,
            totalConnections: currentNetlist.reduce(
              (sum, net) => sum + (net.connections?.length || 0),
              0
            ),
          });

          // Dispatch custom event to notify wiring tool of restored netlist
          // Fix event structure to match what the listener expects
          // IMPORTANT: Delay netlist restoration to ensure components are fully loaded first
          setTimeout(() => {
            console.log(
              "🚀 Dispatching netlistRestored event with",
              currentNetlist.length,
              "nets (delayed to ensure components are ready)"
            );
            window.dispatchEvent(
              new CustomEvent("netlistRestored", {
                detail: { netlist: { nets: currentNetlist } },
              })
            );
          }, 1000); // Increased delay to 1 second to ensure all components are fully loaded
        }

        // Then apply any additional canvas layout data from canvasDataWithoutChat
        if (canvasDataWithoutChat.viewportTransform) {
          canvas.setViewportTransform(canvasDataWithoutChat.viewportTransform);
        }
        if (canvasDataWithoutChat.zoom) {
          canvas.setZoom(canvasDataWithoutChat.zoom);
        }

        // Restore chat data if available
        if (chatData) {
          console.log("💬 Restoring chat data:", {
            messageCount: chatData.messages?.length || 0,
            totalCharacters:
              chatData.messages?.reduce(
                (sum: number, msg: any) => sum + msg.content.length,
                0
              ) || 0,
          });

          // Dispatch custom event to notify AIChatContext of restored data
          // Add a small delay to ensure AIChatContext is ready
          setTimeout(() => {
            console.log(
              "🚀 Dispatching chatDataRestored event with",
              chatData.messages?.length || 0,
              "messages"
            );
            window.dispatchEvent(
              new CustomEvent("chatDataRestored", {
                detail: { chatData },
              })
            );
          }, 100);
        }

        console.log("✅ Canvas and chat data restored successfully");
      } catch (error) {
        console.error("❌ Failed to restore canvas data:", error);
      }
    },
    [currentProject]
  );

  // Add global test function for debugging
  useEffect(() => {
    (window as any).testChatRestoration = () => {
      console.log("🧪 Testing chat restoration...");
      console.log("Current project:", currentProject?.name);
      console.log("Canvas settings:", currentProject?.canvas_settings);
      console.log(
        "Has chat data:",
        !!currentProject?.canvas_settings?.chatData
      );
      console.log(
        "Chat messages:",
        currentProject?.canvas_settings?.chatData?.messages
      );

      if (currentProject?.canvas_settings?.chatData) {
        console.log("🚀 Dispatching test chat restoration event");
        window.dispatchEvent(
          new CustomEvent("chatDataRestored", {
            detail: { chatData: currentProject.canvas_settings.chatData },
          })
        );
      } else {
        console.log("❌ No chat data found in current project");
      }
    };
  }, [currentProject]);

  const value: ProjectContextType = {
    currentProject,
    currentCircuit,
    currentNetlist, // NEW: Add netlist to context
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
