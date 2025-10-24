"use client";

import { RouteGuard } from "@/components/auth/RouteGuard";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AIChatProvider } from "@/contexts/AIChatContext";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard requireAuth={true}>
      <AIChatProvider>
        <ProjectProvider>{children}</ProjectProvider>
      </AIChatProvider>
    </RouteGuard>
  );
}
