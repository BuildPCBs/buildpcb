/**
 * Thumbnail Generator for Project Cards
 * Generates preview images from canvas for dashboard display
 */

import Konva from "konva";
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
  stage: Konva.Stage,
  options: ThumbnailOptions = {}
): Promise<string | null> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Get current stage state
    const currentScale = stage.scale();
    const currentPos = stage.position();

    // Calculate bounds of all content
    // We can use the main layer(s)
    const layer = stage.getLayers()[0];
    if (!layer || layer.getChildren().length === 0) {
      logger.canvas("No objects on canvas to generate thumbnail");
      return null;
    }

    // Get bounding rectangle of all shapes in the layer
    const box = layer.getClientRect({
      skipTransform: false,
      relativeTo: stage,
    });

    if (!box || box.width === 0 || box.height === 0) {
      return null;
    }

    // Add padding
    const padding = 20;
    const minX = box.x - padding;
    const minY = box.y - padding;
    const width = box.width + padding * 2;
    const height = box.height + padding * 2;

    // Calculate pixel ratio to fit the target size
    const scale = Math.min(opts.width! / width, opts.height! / height);

    // Save current stage settings
    // We want to export the area defined by minX, minY, width, height
    // stage.toDataURL allows specifying x, y, width, height (of the source area)
    // and pixelRatio to control output size.

    // Create a temporary background rect if we want white background (jpeg default is black/transparent?)
    // Konva export to jpeg usually has black background if transparent.
    // If format is png, it preserves transparency.
    // Ensure we have a white background.
    let bgRect: Konva.Rect | null = null;
    if (opts.format === "jpeg") {
      // jpg requires background
      bgRect = new Konva.Rect({
        x: minX,
        y: minY,
        width: width,
        height: height,
        fill: "white",
        listening: false,
      });
      layer.add(bgRect);
      bgRect.moveToBottom();
    }

    const dataURL = stage.toDataURL({
      mimeType: opts.format === "png" ? "image/png" : "image/jpeg",
      quality: opts.quality,
      x: minX,
      y: minY,
      width: width,
      height: height,
      pixelRatio: scale,
    });

    // Cleanup background
    if (bgRect) {
      bgRect.destroy();
    }

    // Note: We didn't mess with stage viewport, so no restore needed for that
    // unless getClientRect was affected by scale?
    // getClientRect matches what is visible on screen if relativeTo stage?
    // Actually getClientRect logic is complex.
    // To be safe, we rely on Konva's toDataURL logic which takes "x, y, width, height" of the virtual canvas space.

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
  stage: Konva.Stage
): Promise<string | null> {
  try {
    // Generate thumbnail
    const dataURL = await generateThumbnail(stage);
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
  stage: Konva.Stage
): Promise<string | null> {
  logger.canvas("🖼️ Generating project thumbnail...");
  return await updateProjectThumbnail(projectId, stage);
}
