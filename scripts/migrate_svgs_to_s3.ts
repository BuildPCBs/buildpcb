#!/usr/bin/env node

/**
 * SVG Migration Script
 * Migrates component SVGs from database storage to AWS S3
 * Updates database records with S3 URLs for better performance
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import { supabaseAdmin } from "../src/lib/supabase";
import { logger } from "../src/lib/logger";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "buildpcb-components";
const CLOUDFRONT_URL = process.env.AWS_S3_CLOUDFRONT_URL;

interface ComponentRecord {
  id: string;
  name: string;
  svg_data: string;
  category: string;
  subcategory?: string;
}

/**
 * Upload SVG to S3 and return the URL
 */
async function uploadSvgToS3(
  componentId: string,
  svgData: string,
  componentName: string
): Promise<string> {
  const key = `components/${componentId}/${componentName.replace(
    /[^a-zA-Z0-9]/g,
    "_"
  )}.svg`;

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: svgData,
      ContentType: "image/svg+xml",
      CacheControl: "max-age=31536000", // 1 year cache
      Metadata: {
        componentId,
        componentName,
      },
    });

    await s3Client.send(command);

    // Return CloudFront URL if available, otherwise S3 URL
    const baseUrl =
      CLOUDFRONT_URL ||
      `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
    return `${baseUrl}/${key}`;
  } catch (error) {
    logger.error(`Failed to upload SVG for component ${componentId}:`, error);
    throw error;
  }
}

/**
 * Update component record with S3 URL
 */
async function updateComponentUrl(
  supabase: any,
  componentId: string,
  s3Url: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("components")
      .update({
        svg_url: s3Url,
        svg_data: null, // Remove the inline SVG data
        updated_at: new Date().toISOString(),
      })
      .eq("id", componentId);

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to update component ${componentId}:`, error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateSvgs() {
  const supabase = supabaseAdmin;

  try {
    logger.info("Starting SVG migration to S3...");

    // Get all components with SVG data
    const { data: components, error } = await supabase
      .from("components")
      .select("id, name, svg_data, category, subcategory")
      .not("svg_data", "is", null)
      .order("id");

    if (error) {
      throw error;
    }

    if (!components || components.length === 0) {
      logger.info("No components with SVG data found.");
      return;
    }

    logger.info(`Found ${components.length} components to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (const component of components) {
      try {
        logger.info(`Migrating component: ${component.name} (${component.id})`);

        // Upload to S3
        const s3Url = await uploadSvgToS3(
          component.id,
          component.svg_data,
          component.name
        );

        // Update database
        await updateComponentUrl(supabase, component.id, s3Url);

        successCount++;
        logger.info(`✓ Migrated ${component.name} to ${s3Url}`);

        // Small delay to avoid overwhelming S3
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        errorCount++;
        logger.error(`✗ Failed to migrate ${component.name}:`, error);
        // Continue with next component
      }
    }

    logger.info(
      `Migration completed: ${successCount} successful, ${errorCount} failed`
    );
  } catch (error) {
    logger.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateSvgs().catch((error) => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});
