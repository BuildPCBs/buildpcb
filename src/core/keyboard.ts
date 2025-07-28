/**
 * Keyboard shortcut manager for the IDE
 * Handles global keyboard shortcuts and hotkeys
 */

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  category: string;
  action: () => void;
  condition?: () => boolean;
  preventDefault?: boolean;
}

export interface KeyboardCategory {
  id: string;
  name: string;
  shortcuts: KeyboardShortcut[];
}

class KeyboardManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private pressedKeys: Set<string> = new Set();
  private isListening: boolean = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  /**
   * Start listening for keyboard events
   */
  startListening() {
    if (this.isListening) return;

    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);
    this.isListening = true;
  }

  /**
   * Stop listening for keyboard events
   */
  stopListening() {
    if (!this.isListening) return;

    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    this.isListening = false;
    this.pressedKeys.clear();
  }

  /**
   * Register a keyboard shortcut
   */
  registerShortcut(shortcut: KeyboardShortcut) {
    const key = this.getShortcutKey(shortcut.keys);
    this.shortcuts.set(key, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregisterShortcut(keys: string[]) {
    const key = this.getShortcutKey(keys);
    this.shortcuts.delete(key);
  }

  /**
   * Get all registered shortcuts grouped by category
   */
  getShortcutsByCategory(): KeyboardCategory[] {
    const categories = new Map<string, KeyboardShortcut[]>();

    this.shortcuts.forEach((shortcut) => {
      if (!categories.has(shortcut.category)) {
        categories.set(shortcut.category, []);
      }
      categories.get(shortcut.category)!.push(shortcut);
    });

    return Array.from(categories.entries()).map(([id, shortcuts]) => ({
      id,
      name: this.formatCategoryName(id),
      shortcuts: shortcuts.sort((a, b) =>
        a.description.localeCompare(b.description)
      ),
    }));
  }

  private handleKeyDown(event: KeyboardEvent) {
    const key = this.normalizeKey(event.key);
    this.pressedKeys.add(key);

    // Add modifier keys
    if (event.ctrlKey) this.pressedKeys.add("ctrl");
    if (event.metaKey) this.pressedKeys.add("cmd");
    if (event.altKey) this.pressedKeys.add("alt");
    if (event.shiftKey) this.pressedKeys.add("shift");

    // Check for matching shortcuts
    this.checkShortcuts(event);
  }

  private handleKeyUp(event: KeyboardEvent) {
    const key = this.normalizeKey(event.key);
    this.pressedKeys.delete(key);

    // Remove modifier keys
    if (!event.ctrlKey) this.pressedKeys.delete("ctrl");
    if (!event.metaKey) this.pressedKeys.delete("cmd");
    if (!event.altKey) this.pressedKeys.delete("alt");
    if (!event.shiftKey) this.pressedKeys.delete("shift");
  }

  private checkShortcuts(event: KeyboardEvent) {
    const currentKeys = Array.from(this.pressedKeys).sort();
    const shortcutKey = currentKeys.join("+");

    const shortcut = this.shortcuts.get(shortcutKey);
    if (shortcut) {
      // Check condition if provided
      if (shortcut.condition && !shortcut.condition()) {
        return;
      }

      // Prevent default if specified
      if (shortcut.preventDefault !== false) {
        event.preventDefault();
        event.stopPropagation();
      }

      // Execute action
      try {
        shortcut.action();
      } catch (error) {
        console.error(`Error executing shortcut ${shortcut.id}:`, error);
      }
    }
  }

  private getShortcutKey(keys: string[]): string {
    return keys
      .map((key) => this.normalizeKey(key))
      .sort()
      .join("+");
  }

  private normalizeKey(key: string): string {
    const keyMap: Record<string, string> = {
      Control: "ctrl",
      Meta: "cmd",
      Alt: "alt",
      Shift: "shift",
      " ": "space",
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Escape: "esc",
      Enter: "enter",
      Backspace: "backspace",
      Delete: "delete",
      Tab: "tab",
    };

    return keyMap[key] || key.toLowerCase();
  }

  private formatCategoryName(category: string): string {
    return category
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

// Create global instance
export const keyboardManager = new KeyboardManager();

// Default IDE shortcuts
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  // File operations
  {
    id: "file.new",
    keys: ["ctrl", "n"],
    description: "New file",
    category: "file",
    action: () => console.log("New file"),
  },
  {
    id: "file.open",
    keys: ["ctrl", "o"],
    description: "Open file",
    category: "file",
    action: () => console.log("Open file"),
  },
  {
    id: "file.save",
    keys: ["ctrl", "s"],
    description: "Save file",
    category: "file",
    action: () => console.log("Save file"),
  },
  {
    id: "file.save-as",
    keys: ["ctrl", "shift", "s"],
    description: "Save as",
    category: "file",
    action: () => console.log("Save as"),
  },

  // Edit operations
  {
    id: "edit.undo",
    keys: ["ctrl", "z"],
    description: "Undo",
    category: "edit",
    action: () => console.log("Undo"),
  },
  {
    id: "edit.redo",
    keys: ["ctrl", "y"],
    description: "Redo",
    category: "edit",
    action: () => console.log("Redo"),
  },
  {
    id: "edit.copy",
    keys: ["ctrl", "c"],
    description: "Copy",
    category: "edit",
    action: () => console.log("Copy"),
  },
  {
    id: "edit.paste",
    keys: ["ctrl", "v"],
    description: "Paste",
    category: "edit",
    action: () => console.log("Paste"),
  },
  {
    id: "edit.cut",
    keys: ["ctrl", "x"],
    description: "Cut",
    category: "edit",
    action: () => console.log("Cut"),
  },
  {
    id: "edit.select-all",
    keys: ["ctrl", "a"],
    description: "Select all",
    category: "edit",
    action: () => console.log("Select all"),
  },

  // View operations
  {
    id: "view.zoom-in",
    keys: ["ctrl", "="],
    description: "Zoom in",
    category: "view",
    action: () => console.log("Zoom in"),
  },
  {
    id: "view.zoom-out",
    keys: ["ctrl", "-"],
    description: "Zoom out",
    category: "view",
    action: () => console.log("Zoom out"),
  },
  {
    id: "view.zoom-reset",
    keys: ["ctrl", "0"],
    description: "Reset zoom",
    category: "view",
    action: () => console.log("Reset zoom"),
  },
  {
    id: "view.fit-to-screen",
    keys: ["ctrl", "shift", "f"],
    description: "Fit to screen",
    category: "view",
    action: () => console.log("Fit to screen"),
  },

  // Navigation
  {
    id: "nav.toggle-sidebar",
    keys: ["ctrl", "b"],
    description: "Toggle sidebar",
    category: "navigation",
    action: () => console.log("Toggle sidebar"),
  },
  {
    id: "nav.command-palette",
    keys: ["ctrl", "shift", "p"],
    description: "Command palette",
    category: "navigation",
    action: () => console.log("Command palette"),
  },
  {
    id: "nav.quick-search",
    keys: ["ctrl", "p"],
    description: "Quick search",
    category: "navigation",
    action: () => console.log("Quick search"),
  },

  // Tools
  {
    id: "tools.grid-toggle",
    keys: ["g"],
    description: "Toggle grid",
    category: "tools",
    action: () => console.log("Toggle grid"),
  },
  {
    id: "tools.snap-toggle",
    keys: ["s"],
    description: "Toggle snap",
    category: "tools",
    action: () => console.log("Toggle snap"),
  },
  {
    id: "tools.measure",
    keys: ["m"],
    description: "Measure tool",
    category: "tools",
    action: () => console.log("Measure tool"),
  },

  // Components
  {
    id: "component.add",
    keys: ["shift", "a"],
    description: "Add component",
    category: "components",
    action: () => console.log("Add component"),
  },
  {
    id: "component.rotate",
    keys: ["r"],
    description: "Rotate component",
    category: "components",
    action: () => console.log("Rotate component"),
  },
  {
    id: "component.flip",
    keys: ["f"],
    description: "Flip component",
    category: "components",
    action: () => console.log("Flip component"),
  },

  // Simulation
  {
    id: "sim.run",
    keys: ["f5"],
    description: "Run simulation",
    category: "simulation",
    action: () => console.log("Run simulation"),
  },
  {
    id: "sim.stop",
    keys: ["shift", "f5"],
    description: "Stop simulation",
    category: "simulation",
    action: () => console.log("Stop simulation"),
  },
];

// Initialize default shortcuts
export function initializeKeyboardShortcuts() {
  DEFAULT_SHORTCUTS.forEach((shortcut) => {
    keyboardManager.registerShortcut(shortcut);
  });
  keyboardManager.startListening();
}
