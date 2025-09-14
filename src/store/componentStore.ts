"use client";

import { create } from "zustand";
import { logger } from "@/lib/logger";

interface ComponentStore {
  componentToAdd: string | null;
  addComponent: (componentType: string) => void;
  clearComponentToAdd: () => void;
}

export const useComponentStore = create<ComponentStore>((set) => ({
  componentToAdd: null,
  addComponent: (componentType: string) => {
    logger.component("Store addComponent called with:", componentType);
    set({ componentToAdd: componentType });
  },
  clearComponentToAdd: () => {
    logger.component("Store clearComponentToAdd called");
    set({ componentToAdd: null });
  },
}));
