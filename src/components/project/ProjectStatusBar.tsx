"use client";

import { useProject } from "@/contexts/ProjectContext";
import { useAuth } from "@/hooks/useAuth";

export function ProjectStatusBar() {
  const { currentProject, isLoading, isNewProject, isFirstTimeUser } =
    useProject();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-sm">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-blue-700">Loading project workspace...</span>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="bg-gray-50 border-l-4 border-gray-400 p-4 text-sm">
        <span className="text-gray-600">No project loaded</span>
      </div>
    );
  }

  const getStatusMessage = () => {
    if (isFirstTimeUser) {
      return "🎉 Welcome to BuildPCB! Your first project has been created.";
    }
    if (isNewProject) {
      return "📝 New project created. Start designing your circuit!";
    }
    if (currentProject.name === "Untitled") {
      return "🔄 Continuing with your Untitled project. You can rename it anytime.";
    }
    return `💼 Working on "${currentProject.name}"`;
  };

  const getStatusColor = () => {
    if (isFirstTimeUser) return "bg-green-50 border-green-400 text-green-700";
    if (isNewProject) return "bg-blue-50 border-blue-400 text-blue-700";
    return "bg-gray-50 border-gray-400 text-gray-700";
  };

  return (
    <div className={`border-l-4 p-4 text-sm ${getStatusColor()}`}>
      <div className="flex items-center justify-between">
        <span>{getStatusMessage()}</span>
        <div className="flex items-center space-x-4 text-xs opacity-75">
          <span>User: {user?.email}</span>
          <span>Project ID: {currentProject.id.slice(0, 8)}...</span>
          <span>
            Last updated: {new Date(currentProject.updated_at).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ProjectStatusBar;
