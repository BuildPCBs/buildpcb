// Constants used throughout the application

export const APP_NAME = "BuildPCB.ai";
export const APP_DESCRIPTION =
  "AI-powered IDE for designing electronic circuits and PCBs";

// UI Constants
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export const TOAST_DURATION = {
  short: 3000,
  medium: 5000,
  long: 7000,
} as const;

// API Constants
export const API_ENDPOINTS = {
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    register: "/auth/register",
    refresh: "/auth/refresh",
  },
  projects: {
    list: "/projects",
    create: "/projects",
    get: (id: string) => `/projects/${id}`,
    update: (id: string) => `/projects/${id}`,
    delete: (id: string) => `/projects/${id}`,
  },
  components: {
    search: "/components/search",
    get: (id: string) => `/components/${id}`,
  },
  files: {
    upload: "/files/upload",
    delete: (id: string) => `/files/${id}`,
  },
} as const;

// PCB Design Constants
export const COMPONENT_CATEGORIES = [
  "Resistors",
  "Capacitors",
  "Inductors",
  "Diodes",
  "Transistors",
  "ICs",
  "Connectors",
  "Switches",
  "Sensors",
  "Power",
  "Other",
] as const;

export const PCB_LAYERS = [
  "Top Copper",
  "Bottom Copper",
  "Top Soldermask",
  "Bottom Soldermask",
  "Top Silkscreen",
  "Bottom Silkscreen",
  "Drill Hits",
  "Mechanical",
] as const;

export const GRID_SIZES = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100] as const;

// File Types
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "text/plain",
  "application/json",
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Status options
export const PROJECT_STATUSES = [
  "draft",
  "in-progress",
  "completed",
  "archived",
] as const;

export const SIMULATION_TYPES = ["dc", "ac", "transient", "frequency"] as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  FILE_TOO_LARGE: "File size exceeds the maximum limit.",
  INVALID_FILE_TYPE: "File type is not supported.",
  GENERIC_ERROR: "Something went wrong. Please try again.",
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: "Successfully logged in!",
  LOGOUT_SUCCESS: "Successfully logged out!",
  SAVE_SUCCESS: "Changes saved successfully!",
  DELETE_SUCCESS: "Item deleted successfully!",
  UPLOAD_SUCCESS: "File uploaded successfully!",
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  THEME: "buildpcb-theme",
  USER_PREFERENCES: "buildpcb-user-preferences",
  RECENT_PROJECTS: "buildpcb-recent-projects",
  GRID_SETTINGS: "buildpcb-grid-settings",
} as const;

// Regex patterns
export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  PROJECT_NAME: /^[a-zA-Z0-9\s-_]{1,50}$/,
} as const;
