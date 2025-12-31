// Base types for the application

// Export KiCad component types
export * from "./kicad";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  is_public?: boolean;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  canvas_settings?: any;
  grid_settings?: any;
  tags?: string[];
  category?: string;
}

export interface Component {
  id: string;
  name: string;
  library: string;
  description?: string;
  datasheet?: string;
  keywords?: string;
  pin_count: number;
  symbol_data: SymbolData;
  footprint_filter: string[];
}

export interface SymbolData {
  pins: PinData[];
  graphics: GraphicsData;
}

export interface PinData {
  type: string;
  shape: string;
  name: string;
  number: string;
  position: {
    x: number;
    y: number;
    angle: number;
  };
  length: number;
}

export interface GraphicsData {
  rectangles: RectangleData[];
  circles: CircleData[];
  polylines: PolylineData[];
  arcs: ArcData[];
  text: TextData[];
}

export interface RectangleData {
  start: { x: number; y: number };
  end: { x: number; y: number };
  stroke: { width: number; type: string };
  fill: { type: string };
}

export interface CircleData {
  center: { x: number; y: number };
  radius: number;
  stroke: { width: number; type: string };
  fill: { type: string };
}

export interface PolylineData {
  points: { x: number; y: number }[];
  stroke: { width: number; type: string };
  fill: { type: string };
}

export interface ArcData {
  center: { x: number; y: number };
  radius: number;
  startAngle: number;
  endAngle: number;
  stroke: { width: number; type: string };
  fill: { type: string };
}

export interface TextData {
  text: string;
  position: { x: number; y: number };
  size: number;
  rotation: number;
  font: string;
}

export interface Schema {
  id: string;
  name: string;
  description?: string;
  components: Component[];
  connections: Connection[];
  thumbnail?: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Circuit {
  id: string;
  name: string;
  projectId: string;
  components: Component[];
  connections: Connection[];
  layout: LayoutData;
  simulations: Simulation[];
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  id: string;
  from: {
    componentId: string;
    pin: string;
  };
  to: {
    componentId: string;
    pin: string;
  };
  type: "wire" | "trace" | "via";
  properties: Record<string, any>;
}

export interface LayoutData {
  layers: Layer[];
  dimensions: {
    width: number;
    height: number;
  };
  grid: {
    size: number;
    visible: boolean;
  };
  zoom: number;
  viewBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Layer {
  id: string;
  name: string;
  type:
    | "signal"
    | "power"
    | "ground"
    | "mechanical"
    | "solder-mask"
    | "silk-screen";
  visible: boolean;
  locked: boolean;
  opacity: number;
  color: string;
  elements: LayerElement[];
}

export interface LayerElement {
  id: string;
  type: "trace" | "pad" | "via" | "text" | "polygon";
  position: { x: number; y: number };
  properties: Record<string, any>;
}

export interface Simulation {
  id: string;
  name: string;
  type: "dc" | "ac" | "transient" | "frequency";
  parameters: Record<string, any>;
  results?: SimulationResult[];
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
}

export interface SimulationResult {
  timestamp: number;
  data: Record<string, number>;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// UI State types
export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  error?: Error;
  message?: string;
}

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  description?: string;
  duration?: number;
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "password"
    | "number"
    | "select"
    | "textarea"
    | "checkbox";
  placeholder?: string;
  required?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    custom?: (value: any) => boolean | string;
  };
  options?: { label: string; value: string }[]; // for select fields
}

export interface FormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Theme and UI types
export interface Theme {
  mode: "light" | "dark";
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    border: string;
  };
  fonts: {
    sans: string;
    mono: string;
  };
  spacing: Record<string, string>;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  action?: () => void;
  children?: MenuItem[];
  disabled?: boolean;
  separator?: boolean;
}

// File and media types
export interface FileUpload {
  file: File;
  preview?: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export interface MediaFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
  uploadedAt: string;
}
