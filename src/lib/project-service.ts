"use client";

import { DatabaseService, Project } from "@/lib/database";
import { Circuit } from "@/lib/schemas/circuit";
import { logger } from "./logger";

export interface ProjectLoadResult {
  project: Project;
  isNewProject: boolean;
  isFirstTimeUser: boolean;
}

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

/**
 * Rebuild netlist from circuit connections using connected components algorithm
 */
function rebuildNetlistFromConnections(circuitData: Circuit): any[] {
  logger.api("🔄 Rebuilding netlist from circuit connections");

  const connections = circuitData.connections || [];
  if (connections.length === 0) {
    logger.api("ℹ️ No connections found, returning empty netlist");
    return [];
  }

  // Create adjacency list: pin -> connected pins
  const adjacencyList = new Map<string, Set<string>>();

  // Helper to get unique pin identifier
  const getPinKey = (componentId: string, pin: string) =>
    `${componentId}:${pin}`;

  // Build adjacency list from connections
  for (const conn of connections) {
    const fromKey = getPinKey(conn.from.componentId, conn.from.pin);
    const toKey = getPinKey(conn.to.componentId, conn.to.pin);

    if (!adjacencyList.has(fromKey)) adjacencyList.set(fromKey, new Set());
    if (!adjacencyList.has(toKey)) adjacencyList.set(toKey, new Set());

    adjacencyList.get(fromKey)!.add(toKey);
    adjacencyList.get(toKey)!.add(fromKey);
  }

  // Find connected components using DFS
  const visited = new Set<string>();
  const nets: any[] = [];
  let netCounter = 1;

  const dfs = (pinKey: string, componentPins: Set<string>) => {
    if (visited.has(pinKey)) return;
    visited.add(pinKey);
    componentPins.add(pinKey);

    const neighbors = adjacencyList.get(pinKey);
    if (neighbors) {
      for (const neighbor of neighbors) {
        dfs(neighbor, componentPins);
      }
    }
  };

  // Process each pin to find connected components
  for (const pinKey of adjacencyList.keys()) {
    if (!visited.has(pinKey)) {
      const componentPins = new Set<string>();
      dfs(pinKey, componentPins);

      // Convert pin keys back to NetConnection format
      const netConnections = Array.from(componentPins).map((pinKey) => {
        const [componentId, pinNumber] = pinKey.split(":");
        return { componentId, pinNumber };
      });

      // Create net
      const netId = `net_${netCounter.toString().padStart(3, "0")}`;
      const net = {
        netId,
        connections: netConnections,
        name: undefined, // No name available from connections
      };

      nets.push(net);
      netCounter++;
    }
  }

  logger.api(
    `✅ Rebuilt netlist with ${nets.length} nets from ${connections.length} connections`
  );
  return nets;
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
        logger.api("Brand new user - creating first project");
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
        logger.api(
          "Returning user - loading most recent project:",
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
      logger.api('Returning user - continuing with "Untitled" project');
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
      logger.api('Fallback - creating new "Untitled" project due to error');
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
    logger.api('Creating new "Untitled" project...');

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

      logger.api('"Untitled" project created successfully:', newProject.id);
      return newProject;
    } catch (error) {
      logger.api("Error creating Untitled project:", error);
      logger.api("Create project error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
      });
      throw error;
    }
  }

  /**
   * Save project data (circuit + canvas state + chat data + netlist)
   */
  static async saveProject(
    projectId: string,
    circuitData: Circuit,
    canvasData: Record<string, any>,
    chatData?: Record<string, any>,
    netlistData?: any[] // NEW: Netlist data parameter
  ): Promise<void> {
    try {
      // Validate netlist data if provided
      if (netlistData !== undefined) {
        if (!validateNetlist(netlistData)) {
          throw new Error("Invalid netlist data provided for save operation");
        }
      }

      // Merge chat data into canvas data for storage
      const extendedCanvasData = {
        ...canvasData,
        chatData: chatData || null,
      };

      logger.api("Saving project with data:", {
        projectId,
        hasCircuitData: !!circuitData,
        hasCanvasData: !!canvasData,
        hasChatData: !!chatData,
        hasNetlistData: !!netlistData,
        netCount: netlistData?.length || 0,
        chatMessageCount: chatData?.messages?.length || 0,
        extendedCanvasDataKeys: Object.keys(extendedCanvasData),
        extendedCanvasDataSize: JSON.stringify(extendedCanvasData).length,
        chatDataPreview: chatData
          ? JSON.stringify(chatData).substring(0, 200) + "..."
          : "No chat data",
      });

      // Update the project's last modified time and canvas settings
      await DatabaseService.updateProject(projectId, {
        updated_at: new Date().toISOString(),
        canvas_settings: extendedCanvasData,
      });

      // Create a new version with the circuit data, extended canvas data, and netlist
      await DatabaseService.createVersion(
        projectId,
        circuitData,
        extendedCanvasData,
        "Auto-save",
        undefined, // changelog
        netlistData // NEW: Pass netlist data
      );

      logger.api("Project saved successfully");
    } catch (error) {
      logger.api("Error saving project:", error);
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
   * Load the latest netlist data for a project
   */
  static async loadProjectNetlist(projectId: string): Promise<any[] | null> {
    try {
      const latestVersion = await DatabaseService.getLatestVersion(projectId);
      let netlistData = latestVersion?.netlist_data || null;

      if (netlistData && Array.isArray(netlistData) && netlistData.length > 0) {
        if (!validateNetlist(netlistData)) {
          logger.api(
            "❌ Loaded netlist data is invalid, attempting recovery from circuit connections"
          );
          netlistData = null;
        } else {
          logger.api(`✅ Loaded valid netlist with ${netlistData.length} nets`);
          return netlistData;
        }
      }

      // If no valid netlist data, try to rebuild from circuit connections
      if (!netlistData && latestVersion?.circuit_data) {
        logger.api("🔄 Attempting to rebuild netlist from circuit connections");
        const rebuiltNetlist = rebuildNetlistFromConnections(
          latestVersion.circuit_data
        );

        if (rebuiltNetlist.length > 0) {
          logger.api(
            `✅ Successfully rebuilt netlist with ${rebuiltNetlist.length} nets`
          );

          // Optionally save the rebuilt netlist back to the database
          try {
            await DatabaseService.updateProject(projectId, {
              netlist_data: rebuiltNetlist,
              updated_at: new Date().toISOString(),
            });
            logger.api("💾 Saved rebuilt netlist to database");
          } catch (saveError) {
            logger.api("⚠️ Failed to save rebuilt netlist:", saveError);
          }

          return rebuiltNetlist;
        } else {
          logger.api(
            "ℹ️ No connections found in circuit, returning empty netlist"
          );
          return [];
        }
      }

      logger.api(
        "ℹ️ No netlist data available and no circuit data for recovery"
      );
      return null;
    } catch (error) {
      console.error("❌ Error loading project netlist:", error);
      return null;
    }
  }
}

export default ProjectService;
