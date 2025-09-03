"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { UserIcon, NotificationIcon, SearchIcon } from "@/components/icons";
import { ResponsiveContainer } from "@/components/layout/ResponsiveContainer";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { r, responsive, responsiveFontSize } from "@/lib/responsive";
import { DatabaseService, Project } from "@/lib/database";

const DashboardContent = () => {
  const [activeTab, setActiveTab] = useState("recently-viewed");
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Filter projects based on active tab
  const getFilteredProjects = () => {
    if (activeTab === "recently-viewed") {
      // Sort by last_opened_at for "Recently Viewed"
      return [...projects].sort((a, b) => {
        const aDate = new Date(a.last_opened_at || a.updated_at);
        const bDate = new Date(b.last_opened_at || b.updated_at);
        return bDate.getTime() - aDate.getTime();
      });
    } else if (activeTab === "shared") {
      // Filter for shared/public projects
      return projects.filter((project) => project.is_public);
    }
    // Default: sort by updated_at (most recently edited)
    return projects;
  };

  const filteredProjects = getFilteredProjects();

  // Open project
  const handleOpenProject = (projectId: string) => {
    console.log("🔀 Opening project:", projectId);
    router.push(`/project/${projectId}`);
  };

  // Format date helper - now context-aware
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return date.toLocaleDateString();
  };

  // Get the appropriate date and label based on tab
  const getProjectDateInfo = (project: Project) => {
    if (activeTab === "recently-viewed") {
      const dateToUse = project.last_opened_at || project.updated_at;
      return {
        date: dateToUse,
        label: "Viewed",
      };
    } else {
      return {
        date: project.updated_at,
        label: "Edited",
      };
    }
  };

  return (
    <ResponsiveContainer>
      <div className="min-h-full bg-white relative w-full pb-20">
        {/* Header Box */}
        <div
          className="absolute bg-[#f5f5f5] border border-[#a6a6a6]"
          style={r({
            top: 18,
            left: 19,
            width: 230,
            height: 213,
            borderRadius: 24,
            padding: 16,
          })}
        >
          {/* Inner container with 2px spacing from header box edges */}
          <div style={{ padding: responsive(2) }}>
            {/* User Icon and Name with Notification */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: responsive(16) }}
            >
              <div
                className="flex items-center"
                style={{ gap: responsive(12) }}
              >
                <UserIcon size={16} className="text-[#969696]" />
                <span
                  className="font-medium text-gray-900"
                  style={{ fontSize: responsiveFontSize(14) }}
                >
                  User Name
                </span>
              </div>
              <NotificationIcon size={16} className="text-[#969696]" />
            </div>

            {/* Search Box */}
            <div className="relative">
              <div
                className="absolute top-1/2 transform -translate-y-1/2"
                style={{ left: responsive(12) }}
              >
                <SearchIcon size={16} className="text-[#e3e3e3]" />
              </div>
              <input
                type="text"
                placeholder="Search"
                className="w-full bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{
                  paddingLeft: responsive(40),
                  paddingRight: responsive(16),
                  paddingTop: responsive(8),
                  paddingBottom: responsive(8),
                  fontSize: responsiveFontSize(14),
                  ...r({
                    borderWidth: 0.3,
                    borderRadius: 12,
                  }),
                }}
              />
            </div>
          </div>{" "}
          {/* Close inner container with 4px spacing */}
        </div>

        {/* Main Content Area */}
        <div
          className="absolute min-h-0"
          style={{
            ...r({
              top: 74,
              left: 310,
            }),
            paddingBottom: responsive(80), // Increased bottom padding to ensure full background coverage
            minHeight: "calc(100vh - 74px)", // Ensure content area fills remaining viewport
          }}
        >
          {/* Tabs */}
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: responsive(24) }}
          >
            <div className="flex" style={{ gap: responsive(8) }}>
              <button
                onClick={() => setActiveTab("recently-viewed")}
                className={`transition-colors ${
                  activeTab === "recently-viewed"
                    ? "bg-[#ebebeb] border border-[#dddddd] text-[#999999]"
                    : "text-[#c0bfbf] hover:text-[#999999]"
                }`}
                style={{
                  padding: `${responsive(8)} ${responsive(16)}`,
                  fontSize: responsiveFontSize(14),
                  borderRadius: responsive(6),
                  ...r({
                    borderWidth: activeTab === "recently-viewed" ? 0.5 : 0,
                  }),
                }}
              >
                Recently Viewed
              </button>
              <button
                onClick={() => setActiveTab("shared")}
                className={`transition-colors ${
                  activeTab === "shared"
                    ? "bg-[#ebebeb] border border-[#dddddd] text-[#999999]"
                    : "text-[#c0bfbf] hover:text-[#999999]"
                }`}
                style={{
                  padding: `${responsive(8)} ${responsive(16)}`,
                  fontSize: responsiveFontSize(14),
                  borderRadius: responsive(6),
                  ...r({
                    borderWidth: activeTab === "shared" ? 0.5 : 0,
                  }),
                }}
              >
                Shared
              </button>
            </div>

            {/* New Project Button */}
            <button
              onClick={() => router.push("/project/new")}
              className="bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center"
              style={{
                padding: `${responsive(8)} ${responsive(16)}`,
                fontSize: responsiveFontSize(14),
                borderRadius: responsive(6),
                gap: responsive(8),
              }}
            >
              <span>+</span>
              <span>New Project</span>
            </button>
          </div>{" "}
          {/* Project Cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your projects...</p>
              </div>
            </div>
          ) : error ? (
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
          ) : projects.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-gray-300 text-4xl mb-4">📁</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No projects yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Create your first PCB design project to get started
                </p>
              </div>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 xl:grid-cols-2"
              style={{
                gap: responsive(24),
                maxWidth: responsive(850), // Constrains to 2 cards max
              }}
            >
              {filteredProjects.map((project) => {
                const { date, label } = getProjectDateInfo(project);
                return (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="bg-[#f5f5f5] border border-[#a6a6a6] hover:shadow-md transition-shadow cursor-pointer"
                    style={{
                      ...r({
                        borderRadius: 24,
                        padding: 20,
                      }),
                      width: responsive(400),
                      // Remove fixed height - let content determine height naturally
                    }}
                  >
                    {/* Inner container with 2px spacing from card edges */}
                    <div style={{ padding: responsive(2) }}>
                      {/* Project Image/Thumbnail */}
                      <div
                        className="w-full bg-white border border-[#a6a6a6]"
                        style={{
                          ...r({
                            borderRadius: 20,
                            borderWidth: 0.3,
                          }),
                          height: responsive(180),
                          marginBottom: responsive(5), // Consistent 5px spacing
                        }}
                      >
                        {/* Placeholder for project preview */}
                      </div>

                      {/* Project Info - Fixed alignment */}
                      <div
                        className="flex items-center" // Changed to items-center for proper alignment
                        style={{
                          gap: responsive(12),
                          height: responsive(50), // Fixed height container
                          marginTop: responsive(5), // Positive spacing from image
                        }}
                      >
                        {/* User Icons - Fixed size container */}
                        <div
                          className="flex items-center"
                          style={{
                            marginLeft: responsive(-4), // Slight negative margin for better alignment
                            height: responsive(50), // Match text container height
                          }}
                        >
                          <div
                            className="bg-[#d0d0d0] border border-[#969696] rounded-full flex items-center justify-center"
                            style={{
                              width: responsive(24),
                              height: responsive(24),
                              ...r({ borderWidth: 0.68 }),
                            }}
                          >
                            <UserIcon size={12} className="text-[#969696]" />
                          </div>
                          {/* For now, showing single user - will add collaborators later */}
                        </div>

                        {/* Text Content - Fixed height container */}
                        <div
                          className="flex-1 flex flex-col justify-center"
                          style={{ height: responsive(50) }} // Match avatar height
                        >
                          <h3
                            className="font-medium text-[#666666] leading-tight"
                            style={{
                              fontSize: responsiveFontSize(14),
                              marginBottom: responsive(2), // Minimal spacing
                              lineHeight: 1.2,
                            }}
                          >
                            {project.name}
                          </h3>
                          <p
                            className="text-[#999999] leading-tight"
                            style={{
                              fontSize: responsiveFontSize(12),
                              lineHeight: 1.2,
                            }}
                          >
                            {label} {formatDate(date)}
                          </p>
                        </div>
                      </div>
                    </div>{" "}
                    {/* Close inner container with 4px spacing */}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ResponsiveContainer>
  );
};

const Dashboard = () => {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
};

export default Dashboard;
