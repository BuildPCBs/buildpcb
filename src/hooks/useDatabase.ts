import { useState, useEffect, useCallback, useRef } from "react";
import {
  DatabaseService,
  Project,
  ProjectVersion,
  Component,
  ComponentIndex,
  ComponentDetails,
} from "@/lib/database";
import { Circuit } from "@/lib/schemas/circuit";
import { ProjectService } from "@/lib/project-service"; // Add this line

/**
 * Hook for managing user projects
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DatabaseService.getUserProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (projectData: Partial<Project>) => {
    try {
      const newProject = await DatabaseService.createProject(projectData);
      setProjects((prev) => [newProject, ...prev]);
      return newProject;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      throw err;
    }
  }, []);

  const updateProject = useCallback(
    async (projectId: string, updates: Partial<Project>) => {
      try {
        const updatedProject = await DatabaseService.updateProject(
          projectId,
          updates
        );
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? updatedProject : p))
        );
        return updatedProject;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update project"
        );
        throw err;
      }
    },
    []
  );

  const deleteProject = useCallback(async (projectId: string) => {
    try {
      await DatabaseService.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}

/**
 * Hook for managing project versions
 */
export function useProjectVersions(projectId: string | null) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<ProjectVersion | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await DatabaseService.getProjectVersions(projectId);
      setVersions(data);

      // Set current version to the latest one
      if (data.length > 0) {
        setCurrentVersion(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch versions");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createVersion = useCallback(
    async (
      circuitData: Circuit,
      canvasData: Record<string, any> = {},
      versionName?: string,
      changelog?: string
    ) => {
      if (!projectId) throw new Error("No project selected");

      try {
        const newVersion = await DatabaseService.createVersion(
          projectId,
          circuitData,
          canvasData,
          versionName,
          changelog
        );
        setVersions((prev) => [newVersion, ...prev]);
        setCurrentVersion(newVersion);
        return newVersion;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create version"
        );
        throw err;
      }
    },
    [projectId]
  );

  const loadVersion = useCallback(async (versionId: string) => {
    try {
      const version = await DatabaseService.getVersion(versionId);
      if (version) {
        setCurrentVersion(version);
      }
      return version;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load version");
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return {
    versions,
    currentVersion,
    loading,
    error,
    refetch: fetchVersions,
    createVersion,
    loadVersion,
    setCurrentVersion,
  };
}

/**
 * Hook for component library
 */
export function useComponentLibrary() {
  const [components, setComponents] = useState<ComponentIndex[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [frequentComponents, setFrequentComponents] = useState<
    ComponentIndex[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchComponents = useCallback(
    async (query: string = "", category?: string, limit = 50) => {
      try {
        setLoading(true);
        setError(null);
        const data = await DatabaseService.searchComponents(
          query,
          category,
          limit
        );
        setComponents(data);
        return data;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to search components"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const searchComponentsSemantic = useCallback(
    async (
      query: string = "",
      category?: string,
      limit = 50,
      similarityThreshold = 0.7
    ) => {
      try {
        setLoading(true);
        setError(null);
        const data = await DatabaseService.searchComponentsSemantic(
          query,
          category,
          limit,
          similarityThreshold
        );
        setComponents(data);
        return data;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to search components semantically"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchCategories = useCallback(async () => {
    try {
      const data = await DatabaseService.getComponentCategories();
      setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  }, []);

  const fetchFrequentComponents = useCallback(async () => {
    try {
      const data = await DatabaseService.getFrequentComponents();
      setFrequentComponents(data);
    } catch (err) {
      console.error("Failed to fetch frequent components:", err);
    }
  }, []);

  const recordUsage = useCallback(
    async (componentId: string, projectId: string) => {
      try {
        await DatabaseService.recordComponentUsage(componentId, projectId);
        // Refresh frequent components
        fetchFrequentComponents();
      } catch (err) {
        console.error("Failed to record component usage:", err);
      }
    },
    [fetchFrequentComponents]
  );

  useEffect(() => {
    fetchCategories();
    fetchFrequentComponents();
    // Initial load with no search query
    searchComponents();
  }, [fetchCategories, fetchFrequentComponents, searchComponents]);

  return {
    components,
    categories,
    frequentComponents,
    loading,
    error,
    searchComponents,
    searchComponentsSemantic,
    recordUsage,
    refetch: () => {
      fetchCategories();
      fetchFrequentComponents();
      searchComponents();
    },
  };
}

/**
 * Hook for getting component details (SVG and full data)
 */
export function useComponentDetails(uid: string | null) {
  const [details, setDetails] = useState<ComponentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!uid) {
      setDetails(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await DatabaseService.getComponentDetails(uid);
      setDetails(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch component details"
      );
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return {
    details,
    loading,
    error,
    refetch: fetchDetails,
  };
}

/**
 * Hook for auto-saving project changes
 */
export function useAutoSave(
  projectId: string | null,
  circuitData: Circuit | null,
  canvasData: Record<string, any>,
  chatData: Record<string, any> | undefined, // Add chatData
  netlistData: any[] | undefined, // Add netlistData
  interval = 60000 // Increased to 60 seconds for better performance
) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastDataRef = useRef<string>("");

  const saveNow = useCallback(async () => {
    if (!projectId || !circuitData) return;

    // Skip save if data hasn't actually changed
    const currentDataHash = JSON.stringify({
      circuitData,
      canvasData,
      chatData,
      netlistData,
    });
    if (currentDataHash === lastDataRef.current) {
      console.log("💾 Skipping auto-save - no changes detected");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      console.log("💾 Auto-saving project changes...");

      // Use ProjectService.saveProject to ensure all data is saved
      await ProjectService.saveProject(
        projectId,
        circuitData,
        canvasData,
        chatData,
        netlistData
      );

      lastDataRef.current = currentDataHash;
      setLastSaved(new Date());
      console.log("✅ Auto-save completed successfully");
    } catch (err) {
      console.error("❌ Auto-save failed:", err);
      setError(err instanceof Error ? err.message : "Auto-save failed");
    } finally {
      setSaving(false);
    }
  }, [projectId, circuitData, canvasData, chatData, netlistData]);

  useEffect(() => {
    if (!projectId || !circuitData) return;

    const intervalId = setInterval(saveNow, interval);
    return () => clearInterval(intervalId);
  }, [saveNow, interval, projectId, circuitData]);

  return {
    lastSaved,
    saving,
    error,
    saveNow,
  };
}

/**
 * Hook for project activity feed
 */
export function useProjectActivity(projectId: string | null) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await DatabaseService.getProjectActivity(projectId);
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch activity");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivity,
  };
}
