"use client";

import { create } from "zustand";
import { Circuit } from "@/types";
import { logger } from "@/lib/logger";

interface ProjectState {
  // Current project context
  projectId: string | null;
  versionId: string | null;
  projectName: string | null;

  // Circuit data state
  circuit: Circuit | null;
  lastSaved: Date | null;
  isDirty: boolean; // Has unsaved changes

  // Actions
  setProject: (
    projectId: string,
    versionId: string,
    projectName: string
  ) => void;
  setCircuit: (circuit: Circuit) => void;
  markDirty: () => void;
  markClean: () => void;
  setLastSaved: (date: Date) => void;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projectId: null,
  versionId: null,
  projectName: null,
  circuit: null,
  lastSaved: null,
  isDirty: false,

  // Actions
  setProject: (projectId: string, versionId: string, projectName: string) => {
    logger.component("Setting project:", { projectId, versionId, projectName });
    set({
      projectId,
      versionId,
      projectName,
      circuit: null,
      lastSaved: null,
      isDirty: false,
    });
  },

  setCircuit: (circuit: Circuit) => {
    const state = get();
    logger.component("Updating circuit data, marking dirty");
    set({
      circuit,
      isDirty: true,
    });
  },

  markDirty: () => {
    logger.component("Marking project as dirty (unsaved changes)");
    set({ isDirty: true });
  },

  markClean: () => {
    logger.component("Marking project as clean (saved)");
    set({
      isDirty: false,
      lastSaved: new Date(),
    });
  },

  setLastSaved: (date: Date) => {
    set({ lastSaved: date });
  },

  clearProject: () => {
    logger.component("Clearing project context");
    set({
      projectId: null,
      versionId: null,
      projectName: null,
      circuit: null,
      lastSaved: null,
      isDirty: false,
    });
  },
}));
