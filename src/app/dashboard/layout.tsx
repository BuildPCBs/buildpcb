import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { pages } from "@/lib/site-config";

export const metadata: Metadata = generatePageMetadata({
  title: pages.dashboard.title,
  description: pages.dashboard.description,
  path: pages.dashboard.path,
  keywords: [
    "PCB dashboard",
    "circuit design projects",
    "electronics collaboration",
    "PCB management",
  ],
  images: {
    og: "/dashboard-preview.png",
    twitter: "/dashboard-twitter-preview.png",
  },
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
