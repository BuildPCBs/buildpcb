/**
 * Thumbnail Generator for Project Cards
 * Generates preview images from canvas for dashboard display
 */

import * as fabric from "fabric";
import { supabase } from "./supabase";
import { logger } from "./logger";

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number; // 0-1 for JPEG quality
  format?: "png" | "jpeg";
}

const DEFAULT_OPTIONS: ThumbnailOptions = {
  width: 400,
  height: 300,
  quality: 0.8,
  format: "jpeg",
};

/**
 * Generate thumbnail from canvas
 */
export async function generateThumbnail(
  canvas: fabric.Canvas,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get current canvas dimensions
    const currentZoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];

    // Calculate bounds of all objects
    const objects = canvas.getObjects();
    if (objects.length === 0) {
      logger.canvas("No objects on canvas to generate thumbnail");
      return null;
    }

    // Find bounding box of all content
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    objects.forEach((obj) => {
      const bounds = obj.getBoundingRect();
      minX = Math.min(minX, bounds.left);
      minY = Math.min(minY, bounds.top);
      maxX = Math.max(maxX, bounds.left + bounds.width);
      maxY = Math.max(maxY, bounds.top + bounds.height);
    });

    // Add padding
    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate scale to fit thumbnail size
    const scale = Math.min(
      opts.width! / contentWidth,
      opts.height! / contentHeight
    );

    // Temporarily reset viewport and zoom to capture clean image
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1);

    // Set white background temporarily for thumbnail
    const originalBg = canvas.backgroundColor;
    canvas.backgroundColor = "#FFFFFF";
    canvas.renderAll();

    // Generate data URL with specific region
    const dataURL = canvas.toDataURL({
      format: opts.format,
      quality: opts.quality,
      left: minX,
      top: minY,
      width: contentWidth,
      height: contentHeight,
      multiplier: scale,
    });

    // Restore original background
    canvas.backgroundColor = originalBg;
    canvas.renderAll();

    // Restore original viewport
    canvas.setViewportTransform(vpt);
    canvas.setZoom(currentZoom);
    canvas.renderAll();

    return dataURL;
  } catch (error) {
    logger.canvas("Error generating thumbnail:", error);
    return null;
  }
}

/**
 * Upload thumbnail to Supabase Storage
 */
export async function uploadThumbnail(
  projectId: string,
  dataURL: string
): Promise<string | null> {
  try {
    // Convert data URL to blob
    const response = await fetch(dataURL);
    const blob = await response.blob();

    // Generate filename
    const filename = `${projectId}_${Date.now()}.jpg`;
    const filePath = `thumbnails/${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("project-assets")
      .upload(filePath, blob, {
        contentType: "image/jpeg",
        upsert: true, // Replace if exists
      });

    if (error) {
      logger.canvas("Error uploading thumbnail:", error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("project-assets")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error) {
    logger.canvas("Error uploading thumbnail:", error);
    return null;
  }
}

/**
 * Generate and upload thumbnail, then update project record
 */
export async function updateProjectThumbnail(
  projectId: string,
  canvas: fabric.Canvas
): Promise<string | null> {
  try {
    // Generate thumbnail
    const dataURL = await generateThumbnail(canvas);
    if (!dataURL) return null;

    // Upload to storage
    const thumbnailUrl = await uploadThumbnail(projectId, dataURL);
    if (!thumbnailUrl) return null;

    // Update project record
    const { error } = await supabase
      .from("projects")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", projectId);

    if (error) {
      logger.canvas("Error updating project thumbnail:", error);
      return null;
    }

    logger.canvas(`✅ Thumbnail updated for project ${projectId}`);
    return thumbnailUrl;
  } catch (error) {
    logger.canvas("Error in updateProjectThumbnail:", error);
    return null;
  }
}

/**
 * Generate thumbnail immediately (for manual trigger or on-demand)
 */
export async function generateProjectThumbnailNow(
  projectId: string,
  canvas: fabric.Canvas
): Promise<string | null> {
  logger.canvas("🖼️ Generating project thumbnail...");
  return await updateProjectThumbnail(projectId, canvas);
}
