/**
 * Responsive utility functions for BuildPCB.ai
 * All values should be relative to the design dimensions (1280x832)
 * These utilities convert design values to truly responsive CSS units
 */

// Design constants
export const DESIGN_WIDTH = 1280;
export const DESIGN_HEIGHT = 832;

/**
 * Convert design pixel values to responsive units
 */
export const toVW = (value: number) => `${(value / DESIGN_WIDTH) * 100}vw`;
export const toVH = (value: number) => `${(value / DESIGN_HEIGHT) * 100}vh`;
export const toRem = (value: number) => `${value / 16}rem`;

/**
 * Smart responsive conversion based on value size and context
 * Small values (borders, small spacing) -> rem for accessibility
 * Medium values (spacing, small dimensions) -> clamp() for fluid scaling
 * Large values (widths, heights) -> vw/vh with sensible limits
 */
export const responsive = (value: number) => {
  if (value <= 2) return toRem(value); // Very small values (borders) stay in rem
  if (value <= 8)
    return `clamp(${toRem(value * 0.8)}, ${toVW(value)}, ${toRem(
      value * 1.2
    )})`; // Small spacing
  if (value <= 32)
    return `clamp(${toRem(value * 0.75)}, ${toVW(value)}, ${toRem(
      value * 1.5
    )})`; // Medium spacing
  return `clamp(${toRem(value * 0.6)}, ${toVW(value)}, ${toVW(value * 1.3)})`; // Large dimensions
};

/**
 * Responsive size conversion with min/max constraints
 */
export const responsiveSize = (
  value: number,
  minRem?: number,
  maxVw?: number
) => {
  const vwValue = toVW(value);
  const remValue = toRem(value);

  if (minRem && maxVw) {
    return `clamp(${toRem(minRem)}, ${vwValue}, ${toVW(maxVw)})`;
  }
  if (minRem) {
    return `max(${toRem(minRem)}, ${vwValue})`;
  }
  return vwValue;
};

/**
 * Creates responsive style objects with fluid scaling
 */
export const createResponsiveStyles = (
  styles: Record<string, number | string>
) => {
  const responsiveStyles: Record<string, string> = {};

  for (const [key, value] of Object.entries(styles)) {
    if (typeof value === "number") {
      // Handle different CSS properties appropriately
      if (key.includes("Width") || key === "width") {
        responsiveStyles[key] = responsiveSize(value, 2); // Min 2rem width
      } else if (key.includes("Height") || key === "height") {
        responsiveStyles[key] =
          key === "height"
            ? responsiveSize(value, 2) // Use same scaling as width for proportional elements
            : responsive(value);
      } else if (key.includes("padding") || key.includes("margin")) {
        responsiveStyles[key] = responsive(value);
      } else if (key.includes("border") && key.includes("Radius")) {
        responsiveStyles[key] = `max(${toRem(value)}, ${toVW(value)})`;
      } else if (key.includes("border") && key.includes("Width")) {
        responsiveStyles[key] = toRem(value); // Border widths stay in rem
      } else if (key === "top" || key === "bottom") {
        responsiveStyles[key] = `max(${toRem(value)}, ${toVH(value)})`;
      } else if (key === "left" || key === "right") {
        responsiveStyles[key] = `max(${toRem(value)}, ${toVW(value)})`;
      } else {
        responsiveStyles[key] = responsive(value);
      }
    } else {
      responsiveStyles[key] = value;
    }
  }

  return responsiveStyles;
};

/**
 * Type-safe responsive style builder
 */
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

/**
 * Font size responsive utilities with better scaling
 */
export const responsiveFontSize = (designPx: number) => {
  return `clamp(${toRem(designPx * 0.85)}, ${toVW(designPx)}, ${toRem(
    designPx * 1.15
  )})`;
};

/**
 * Square/circular element responsive utility
 * Ensures width and height scale proportionally to maintain aspect ratio
 */
export const responsiveSquare = (size: number) => {
  const responsiveValue = responsiveSize(size, 2);
  return {
    width: responsiveValue,
    height: responsiveValue,
  };
};

/**
 * Responsive spacing system based on design values
 */
export const spacing = {
  xs: responsive(4),
  sm: responsive(8),
  md: responsive(16),
  lg: responsive(24),
  xl: responsive(32),
  "2xl": responsive(48),
  "3xl": responsive(64),
};
