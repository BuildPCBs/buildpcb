"use client";

import { create } from "zustand";

interface ComponentStore {
  componentToAdd: string | null;
  addComponent: (componentType: string) => void;
  clearComponentToAdd: () => void;
}

export const useComponentStore = create<ComponentStore>((set) => ({
  componentToAdd: null,
  addComponent: (componentType: string) => {
    console.log("Store addComponent called with:", componentType);
    set({ componentToAdd: componentType });
  },
  clearComponentToAdd: () => {
    console.log("Store clearComponentToAdd called");
    set({ componentToAdd: null });
  },
}));
