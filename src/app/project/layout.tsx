import type { Metadata } from "next";
import { generatePageMetadata } from "@/lib/metadata";
import { pages } from "@/lib/site-config";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AIChatProvider } from "@/contexts/AIChatContext";

export const metadata: Metadata = generatePageMetadata({
  title: "PCB Project",
  description: "Design and edit your PCB project in the browser",
  path: "/project",
  keywords: ["PCB project", "circuit design", "electronics CAD", "PCB editor"],
});

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requireAuth={true}>
      <ProjectProvider>
        <AIChatProvider>
          {children}
        </AIChatProvider>
      </ProjectProvider>
    </RouteGuard>
  );
}
