import { siteConfig } from "@/lib/site-config";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    url: siteConfig.url,
    ogImage: siteConfig.ogImage,
    twitterImage: siteConfig.twitterImage,
    absoluteOgImage: `${siteConfig.url}${siteConfig.ogImage}`,
    absoluteTwitterImage: `${siteConfig.url}${siteConfig.twitterImage}`,
  });
}
