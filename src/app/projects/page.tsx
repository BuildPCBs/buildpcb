"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { UserIcon, SearchIcon, PlusIcon } from "@/components/icons";
import { ResponsiveContainer } from "@/components/layout/ResponsiveContainer";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DatabaseService, Project } from "@/lib/database";
import { Folder, Clock, Users } from "lucide-react";
import { responsive as r } from "@/lib/responsive";

const databaseService = new DatabaseService();

const ProjectsContent = () => {
  const [activeTab, setActiveTab] = useState("all-projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { user } = useAuth();

  // Load user's projects
  useEffect(() => {
    const loadProjects = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        console.log("📂 Loading projects for user:", user.id);

        const userProjects = await DatabaseService.getUserProjects();
        console.log("📂 Loaded projects:", userProjects);

        setProjects(userProjects);
      } catch (err) {
        console.error("❌ Failed to load projects:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load projects"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadProjects();
  }, [user]);

  // Create new project
  const handleCreateProject = async () => {
    if (!user) return;

    try {
      console.log("➕ Creating new project for user:", user.id);

      const newProject = await DatabaseService.createProject({
        name: `Untitled Project ${new Date().toLocaleDateString()}`,
        description: "New PCB design project",
        owner_id: user.id,
      });

      console.log("✅ Created new project:", newProject);

      // Navigate to the new project
      router.push(`/project/${newProject.id}`);
    } catch (err) {
      console.error("❌ Failed to create project:", err);
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  };

  // Open existing project
  const handleOpenProject = (projectId: string) => {
    console.log("🔀 Opening project:", projectId);
    router.push(`/project/${projectId}`);
  };

  // Filter projects based on search query
  const filteredProjects = projects.filter(
    (project) =>
      project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <ResponsiveContainer>
      <div className="min-h-full bg-white relative w-full pb-20">
        {/* Header */}
        <div
          className="absolute bg-[#f5f5f5] border border-[#a6a6a6]"
          style={{
            top: r(24),
            left: r(24),
            right: r(24),
            height: r(64),
            borderRadius: r(8),
          }}
        >
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-800">
                BuildPCB Projects
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ width: r(320) }}
                />
              </div>

              {/* User Icon */}
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          className="absolute bg-white border border-[#a6a6a6] overflow-hidden"
          style={{
            top: r(112),
            left: r(24),
            right: r(24),
            bottom: r(24),
            borderRadius: r(8),
          }}
        >
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("all-projects")}
                className={`pb-2 border-b-2 transition-colors ${
                  activeTab === "all-projects"
                    ? "border-blue-600 text-blue-600 font-medium"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                All Projects
              </button>
              <button
                onClick={() => setActiveTab("recent")}
                className={`pb-2 border-b-2 transition-colors ${
                  activeTab === "recent"
                    ? "border-blue-600 text-blue-600 font-medium"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                Recently Modified
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {/* Create New Project Button */}
            <div className="mb-6">
              <button
                onClick={handleCreateProject}
                className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                Create New Project
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your projects...</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-red-500 text-4xl mb-4">⚠️</div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Failed to load projects
                  </h3>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Projects Grid */}
            {!isLoading && !error && (
              <>
                {filteredProjects.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">
                        {searchQuery ? "No projects found" : "No projects yet"}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {searchQuery
                          ? "Try adjusting your search terms"
                          : "Create your first PCB design project to get started"}
                      </p>
                      {!searchQuery && (
                        <button
                          onClick={handleCreateProject}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Create Project
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => handleOpenProject(project.id)}
                        className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <Folder className="w-8 h-8 text-blue-600 group-hover:text-blue-700 transition-colors" />
                          <div className="text-xs text-gray-500">
                            {formatDate(project.last_opened_at)}
                          </div>
                        </div>

                        <h3 className="font-semibold text-gray-800 mb-2 group-hover:text-blue-700 transition-colors">
                          {project.name}
                        </h3>

                        {project.description && (
                          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                            {project.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Modified {formatDate(project.last_opened_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ResponsiveContainer>
  );
};

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsContent />
    </ProtectedRoute>
  );
}
