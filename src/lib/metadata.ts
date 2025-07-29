import type { Metadata } from "next";
import { siteConfig } from "./site-config";

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  images?: {
    og?: string;
    twitter?: string;
  };
}

export function generatePageMetadata({
  title,
  description,
  path,
  keywords = [],
  images = {},
}: PageMetadataOptions): Metadata {
  const fullTitle = `${title} | ${siteConfig.name}`;
  const ogImage = images.og || siteConfig.ogImage;
  const twitterImage = images.twitter || siteConfig.twitterImage;
  const allKeywords = [...siteConfig.keywords, ...keywords];

  return {
    title,
    description,
    keywords: allKeywords,
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: siteConfig.name,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [twitterImage],
      creator: siteConfig.twitterCreator,
    },
    alternates: {
      canonical: path,
    },
  };
}

// Helper function for dynamic metadata generation in page components
export function createDynamicMetadata(
  baseOptions: PageMetadataOptions,
  dynamicData?: Record<string, string>
): Metadata {
  if (!dynamicData) {
    return generatePageMetadata(baseOptions);
  }

  // Replace placeholders in title and description with dynamic data
  const title = Object.entries(dynamicData).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, value),
    baseOptions.title
  );

  const description = Object.entries(dynamicData).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, value),
    baseOptions.description
  );

  return generatePageMetadata({
    ...baseOptions,
    title,
    description,
  });
}
