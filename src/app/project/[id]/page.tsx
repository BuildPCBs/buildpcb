"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ideCore } from "@/core";
import { IDECanvas } from "@/components/layout/IDECanvas";
import { useProject } from "@/contexts/ProjectContext";
import { AgentServiceInit } from "@/agent/AgentServiceInit";

interface ProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const {
    currentProject,
    currentCircuit,
    isLoading,
    error,
    loadSpecificProject,
  } = useProject();
  const router = useRouter();
  const resolvedParams = use(params);

  // Update page title with project name when project loads
  useEffect(() => {
    if (currentProject?.name) {
      document.title = `${currentProject.name} - BuildPCB`;
    } else {
      document.title = "BuildPCB";
    }
  }, [currentProject?.name]);

  // Show loading state while project is being loaded
  useEffect(() => {
    if (resolvedParams.id && loadSpecificProject) {
      // Only load if we don't already have this project loaded
      if (!currentProject || currentProject.id !== resolvedParams.id) {
        loadSpecificProject(resolvedParams.id);
      }
    }
  }, [resolvedParams.id, loadSpecificProject, currentProject]);

  // Show loading state while project is being loaded
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">
            Loading project...
          </h2>
          <p className="text-gray-600 mt-2">ID: {resolvedParams.id}</p>
        </div>
      </div>
    );
  }

  // Show error state if project loading failed
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Project Not Found
          </h2>
          <p className="text-gray-600 mb-2">Project ID: {resolvedParams.id}</p>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-4">
            <button
              onClick={() => router.push("/")}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure we have the right project loaded
  if (currentProject && currentProject.id !== resolvedParams.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">
            Switching projects...
          </h2>
        </div>
      </div>
    );
  }

  // Render the IDE with the loaded project
  return (
    <>
      <AgentServiceInit />
      <IDECanvas />
    </>
  );
}
