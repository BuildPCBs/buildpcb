import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { pages } from "@/lib/site-config";

export const metadata: Metadata = generatePageMetadata({
  title: pages.home.title,
  description: pages.home.description,
  path: pages.home.path,
  keywords: [
    "PCB IDE",
    "circuit design studio",
    "electronics CAD",
    "AI circuit design",
    "PCB editor",
  ],
  images: {
    og: "/ide-preview.png",
    twitter: "/ide-twitter-preview.png",
  },
});

export default function IDELayout({ children }: { children: React.ReactNode }) {
  return children;
}
