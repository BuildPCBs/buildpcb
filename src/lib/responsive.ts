/**
 * Responsive utility functions for BuildPCBs - FIXED VERSION
 *
 * KEY INSIGHT: Stop using vw/vh for EVERYTHING!
 * - Containers → max-width + center
 * - Spacing → tight bounds
 * - Icons → fixed px
 * - Text → rem
 */

export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 832;

export const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1280,
  large: 1600,
  xlarge: 1920,
};

// Basic converters
export const toRem = (px: number) => `${px / 16}rem`;
export const toVW = (value: number) => `${(value / DESIGN_WIDTH) * 100}vw`;
export const toVH = (value: number) => `${(value / DESIGN_HEIGHT) * 100}vh`;

/**
 * FIXED - things that should NEVER scale
 * Use for: icons, icon containers, small buttons
 */
export const fixed = (px: number) => `${px}px`;

/**
 * SPACING - scales slightly, tight bounds (±20% max)
 * Use for: gaps, padding, margins
 */
export const spacing = (designPx: number) => {
  const min = Math.floor(designPx * 0.8);
  const max = Math.ceil(designPx * 1.2);
  return `clamp(${min}px, ${(designPx / DESIGN_WIDTH) * 100}vw, ${max}px)`;
};

/**
 * CONTAINER - for panels, cards (±15% max, absolute cap)
 * Use for: SchemaPanel, PromptPanel, etc.
 */
export const container = (designPx: number, absoluteMaxPx?: number) => {
  const min = Math.floor(designPx * 0.85);
  const max = absoluteMaxPx || Math.ceil(designPx * 1.15);
  return `clamp(${min}px, ${(designPx / DESIGN_WIDTH) * 100}vw, ${max}px)`;
};

/**
 * FONT SIZE - minimal scaling (±10%)
 */
export const fontSize = (designPx: number) => {
  const min = Math.max(12, Math.floor(designPx * 0.9));
  const max = Math.ceil(designPx * 1.1);
  return `clamp(${min}px, ${(designPx / DESIGN_WIDTH) * 100}vw, ${max}px)`;
};

/**
 * RADIUS - same as spacing
 */
export const radius = (designPx: number) => spacing(designPx);

/**
 * LEGACY responsive() - kept for backward compat
 * BUT you should migrate to specific functions above!
 */
export const responsive = (value: number) => {
  if (value <= 2) return fixed(value);
  if (value <= 64) return spacing(value);
  return container(value);
};

export const responsiveSize = (
  value: number,
  _minRem?: number,
  maxPx?: number
) => {
  return container(value, maxPx);
};

export const responsiveFontSize = fontSize;

export const responsiveSquare = (size: number) => {
  const val = size <= 48 ? fixed(size) : spacing(size);
  return { width: val, height: val };
};

export const createResponsiveStyles = (
  styles: Record<string, number | string>
) => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(styles)) {
    if (typeof value === "number") {
      if (
        key.includes("Width") ||
        key === "width" ||
        key.includes("Height") ||
        key === "height"
      ) {
        result[key] = container(value);
      } else if (
        key.includes("padding") ||
        key.includes("margin") ||
        key.includes("gap")
      ) {
        result[key] = spacing(value);
      } else if (key.includes("borderRadius")) {
        result[key] = radius(value);
      } else if (key.includes("borderWidth")) {
        result[key] = fixed(value);
      } else if (key.includes("fontSize")) {
        result[key] = fontSize(value);
      } else {
        result[key] = spacing(value);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
};

export interface ResponsiveStyleConfig {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
  borderRadius?: number;
  padding?: number;
  margin?: number;
  borderWidth?: number;
}

export const r = (config: ResponsiveStyleConfig) =>
  createResponsiveStyles(config as Record<string, number | string>);

export const spacingScale = {
  xxs: spacing(2),
  xs: spacing(4),
  sm: spacing(8),
  md: spacing(16),
  lg: spacing(24),
  xl: spacing(32),
  "2xl": spacing(48),
  "3xl": spacing(64),
};

export const breakpoints = BREAKPOINTS;

export const calculateResponsiveValue = (
  designValue: number,
  viewportWidth: number = typeof window !== "undefined"
    ? window.innerWidth
    : DESIGN_WIDTH
): number => {
  const clampedViewport = Math.min(
    Math.max(viewportWidth, BREAKPOINTS.tablet),
    BREAKPOINTS.xlarge
  );
  const scaleFactor = clampedViewport / DESIGN_WIDTH;
  const boundedScale = Math.max(0.85, Math.min(1.15, scaleFactor));
  return Math.round(designValue * boundedScale);
};

export const containerRelative = (value: number) => {
  const min = Math.floor(value * 0.85);
  const max = Math.ceil(value * 1.15);
  return `clamp(${min}px, ${(value / DESIGN_WIDTH) * 100}cqw, ${max}px)`;
};

/**
 * MAX WIDTH WRAPPER - wrap panels in this!
 * Prevents growing forever on huge screens
 */
export const maxWidthWrapper = (maxPx: number = BREAKPOINTS.desktop) => ({
  maxWidth: `${maxPx}px`,
  marginLeft: "auto",
  marginRight: "auto",
  width: "100%",
});
