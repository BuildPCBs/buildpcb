"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { UserIcon, NotificationIcon, SearchIcon } from "@/components/icons";
import { ResponsiveContainer } from "@/components/layout/ResponsiveContainer";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  r,
  responsive,
  responsiveFontSize,
  spacing,
  container,
  fontSize,
  fixed,
} from "@/lib/responsive";
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

  // Format date helper - now context-aware with granular time units
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInMinutes < 60)
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
    if (diffInHours < 24)
      return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
    if (diffInDays < 7)
      return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
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
      {/* Center wrapper for entire dashboard at small zoom levels */}
      <div className="min-h-screen bg-white flex justify-center">
        <div
          className="min-h-full bg-white relative w-full pb-20"
          style={{ maxWidth: "1920px" }}
        >
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
            <div style={{ padding: spacing(2) }}>
              {/* User Icon and Name with Notification */}
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: spacing(12) }}
              >
                <div className="flex items-center" style={{ gap: spacing(8) }}>
                  <UserIcon size={14} className="text-[#969696]" />
                  <span
                    className="font-medium text-gray-900"
                    style={{ fontSize: fontSize(12) }} // Smaller text
                  >
                    User Name
                  </span>
                </div>
                <NotificationIcon size={14} className="text-[#969696]" />
              </div>

              {/* Search Box */}
              <div className="relative">
                <div
                  className="absolute top-1/2 transform -translate-y-1/2"
                  style={{ left: spacing(10) }}
                >
                  <SearchIcon size={14} className="text-[#e3e3e3]" />
                </div>
                <input
                  type="text"
                  placeholder="Search"
                  className="w-full bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{
                    paddingLeft: spacing(32),
                    paddingRight: spacing(12),
                    paddingTop: spacing(6),
                    paddingBottom: spacing(6),
                    fontSize: fontSize(11), // Smaller text
                    borderWidth: "1px",
                    borderRadius: spacing(10),
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
              right: "32px", // Add right margin
              paddingBottom: responsive(80),
              minHeight: "calc(100vh - 74px)",
              maxWidth: "1600px", // Max width for content
            }}
          >
            {/* Header row with tabs and button */}
            <div
              className="flex items-center justify-between"
              style={{
                marginBottom: spacing(20),
                width: "1080px", // Exact width of 3-card grid
                minWidth: "1080px", // Force the width
              }}
            >
              {/* Tabs on left - pill style (shadcn-like) */}
              <div
                className="inline-flex items-center"
                style={{
                  backgroundColor: "#f5f5f5",
                  padding: spacing(4),
                  borderRadius: spacing(8),
                  gap: spacing(4),
                }}
              >
                <button
                  onClick={() => setActiveTab("recently-viewed")}
                  className="transition-all"
                  style={{
                    padding: `${spacing(6)} ${spacing(14)}`,
                    fontSize: fontSize(12),
                    fontWeight: 500,
                    borderRadius: spacing(6),
                    backgroundColor:
                      activeTab === "recently-viewed"
                        ? "#ffffff"
                        : "transparent",
                    color:
                      activeTab === "recently-viewed" ? "#1a1a1a" : "#737373",
                    border: "none",
                    cursor: "pointer",
                    boxShadow:
                      activeTab === "recently-viewed"
                        ? "0 1px 3px rgba(0,0,0,0.1)"
                        : "none",
                  }}
                >
                  Recently Viewed
                </button>
                <button
                  onClick={() => setActiveTab("shared")}
                  className="transition-all"
                  style={{
                    padding: `${spacing(6)} ${spacing(14)}`,
                    fontSize: fontSize(12),
                    fontWeight: 500,
                    borderRadius: spacing(6),
                    backgroundColor:
                      activeTab === "shared" ? "#ffffff" : "transparent",
                    color: activeTab === "shared" ? "#1a1a1a" : "#737373",
                    border: "none",
                    cursor: "pointer",
                    boxShadow:
                      activeTab === "shared"
                        ? "0 1px 3px rgba(0,0,0,0.1)"
                        : "none",
                  }}
                >
                  Shared
                </button>
              </div>

              {/* New Project Button on far right */}
              <button
                onClick={() => router.push("/project/new")}
                className="bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center"
                style={{
                  padding: `${spacing(6)} ${spacing(12)}`,
                  fontSize: fontSize(12),
                  borderRadius: spacing(6),
                  gap: spacing(6),
                }}
              >
                <span>+</span>
                <span>New Project</span>
              </button>
            </div>
            {/* Project Cards */}
            {isLoading ? (
              <div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                style={{
                  gap: spacing(24),
                  width: "fit-content",
                  justifyItems: "start",
                }}
              >
                {/* Shimmer skeleton cards */}
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-[#f5f5f5] border border-[#a6a6a6] relative overflow-hidden"
                    style={{
                      ...r({
                        borderRadius: 24,
                        padding: 12,
                      }),
                      width: "340px",
                      flexShrink: 0,
                    }}
                  >
                    <div>
                      {/* Shimmer thumbnail */}
                      <div
                        className="w-full bg-white border border-[#a6a6a6] relative overflow-hidden"
                        style={{
                          ...r({
                            borderRadius: 20,
                            borderWidth: 0.3,
                          }),
                          height: container(180, 200),
                          marginBottom: spacing(5),
                        }}
                      >
                        {/* Shimmer animation */}
                        <div
                          className="absolute inset-0 animate-shimmer"
                          style={{
                            background:
                              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                            backgroundSize: "200% 100%",
                            animation: "shimmer 1.5s infinite",
                          }}
                        />
                      </div>

                      {/* Shimmer project info */}
                      <div
                        className="flex items-center"
                        style={{
                          gap: spacing(12),
                          height: container(46, 50),
                          marginTop: spacing(5),
                        }}
                      >
                        {/* Avatar skeleton */}
                        <div
                          className="bg-[#e0e0e0] rounded-full relative overflow-hidden"
                          style={{
                            width: "24px",
                            height: "24px",
                          }}
                        >
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                              backgroundSize: "200% 100%",
                              animation: "shimmer 1.5s infinite",
                            }}
                          />
                        </div>

                        {/* Text skeletons */}
                        <div
                          className="flex-1 flex flex-col justify-center"
                          style={{ gap: spacing(4) }}
                        >
                          {/* Project name skeleton */}
                          <div
                            className="bg-[#e0e0e0] relative overflow-hidden"
                            style={{
                              height: "12px",
                              width: "60%",
                              borderRadius: "4px",
                            }}
                          >
                            <div
                              className="absolute inset-0"
                              style={{
                                background:
                                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                                backgroundSize: "200% 100%",
                                animation: "shimmer 1.5s infinite",
                              }}
                            />
                          </div>
                          {/* Date skeleton */}
                          <div
                            className="bg-[#e0e0e0] relative overflow-hidden"
                            style={{
                              height: "10px",
                              width: "40%",
                              borderRadius: "4px",
                            }}
                          >
                            <div
                              className="absolute inset-0"
                              style={{
                                background:
                                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                                backgroundSize: "200% 100%",
                                animation: "shimmer 1.5s infinite",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
            ) : filteredProjects.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-gray-300 text-4xl mb-4">
                    {activeTab === "shared" ? "🤝" : "📁"}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {activeTab === "shared"
                      ? "No shared projects yet"
                      : "No projects yet"}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {activeTab === "shared"
                      ? "Projects you share with others will appear here"
                      : "Create your first PCB design project to get started"}
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                style={{
                  gap: spacing(24),
                  width: "fit-content", // Only take up space needed for cards
                  justifyItems: "start", // Align cards to left, space stays on right
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
                          padding: 10,
                        }),
                        // Fixed card width - doesn't stretch to fill grid
                        width: "340px", // Fixed width for consistency
                        flexShrink: 0, // Prevent shrinking
                      }}
                    >
                      {/* Inner container - removed extra padding for tighter spacing */}
                      <div>
                        {/* Project Image/Thumbnail */}
                        <div
                          className="w-full bg-white border border-[#a6a6a6] overflow-hidden relative"
                          style={{
                            ...r({
                              borderRadius: 20,
                              borderWidth: 0.3,
                            }),
                            height: container(180, 200), // Bounded height
                            marginBottom: spacing(5),
                          }}
                        >
                          {project.thumbnail_url ? (
                            <img
                              src={project.thumbnail_url}
                              alt={`${project.name} preview`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback if image fails to load
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                              <div className="text-center">
                                <div className="text-4xl mb-2">📐</div>
                                <p className="text-xs text-gray-400">
                                  No preview
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Project Info - Fixed alignment */}
                        <div
                          className="flex items-center"
                          style={{
                            gap: spacing(12),
                            height: container(50, 56), // Bounded height
                            marginTop: spacing(5),
                          }}
                        >
                          {/* User Icons - Fixed size container */}
                          <div
                            className="flex items-center"
                            style={{
                              marginLeft: spacing(-4),
                              height: container(50, 56),
                            }}
                          >
                            <div
                              className="bg-[#d0d0d0] border border-[#969696] rounded-full flex items-center justify-center"
                              style={{
                                width: "24px", // Fixed icon size
                                height: "24px", // Fixed icon size
                                ...r({ borderWidth: 0.3 }),
                              }}
                            >
                              <UserIcon size={12} className="text-[#969696]" />
                            </div>
                            {/* For now, showing single user - will add collaborators later */}
                          </div>

                          {/* Text Content - Fixed height container */}
                          <div
                            className="flex-1 flex flex-col justify-center"
                            style={{ height: container(46, 50) }}
                          >
                            <h3
                              className="font-medium text-[#666666] leading-tight"
                              style={{
                                fontSize: fontSize(12), // Smaller project name
                                marginBottom: spacing(2),
                                lineHeight: 1.2,
                              }}
                            >
                              {project.name}
                            </h3>
                            <p
                              className="text-[#999999] leading-tight"
                              style={{
                                fontSize: fontSize(10), // Smaller label text
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
        </div>{" "}
        {/* Close inner wrapper */}
      </div>{" "}
      {/* Close center wrapper */}
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
