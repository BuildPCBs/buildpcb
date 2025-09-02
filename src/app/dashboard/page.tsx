"use client";

import React, { useState } from "react";
import { UserIcon, NotificationIcon, SearchIcon } from "@/components/icons";
import { ResponsiveContainer } from "@/components/layout/ResponsiveContainer";
import { AuthGuard, AuthButton } from "@/components/auth";
import { useAuth } from "@/hooks/useAuth";
import { r, responsive, responsiveFontSize } from "@/lib/responsive";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("recently-viewed");
  const { user, isAuthenticated, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const mockProjects = [
    {
      id: 1,
      name: "PCB Design v2",
      lastModified: "2 hours ago",
      collaborators: 1,
    },
    {
      id: 2,
      name: "Arduino Shield",
      lastModified: "1 day ago",
      collaborators: 2,
    },
    {
      id: 3,
      name: "LED Controller",
      lastModified: "3 days ago",
      collaborators: 1,
    },
    {
      id: 4,
      name: "Power Module",
      lastModified: "1 week ago",
      collaborators: 2,
    },
    {
      id: 5,
      name: "Sensor Board",
      lastModified: "2 weeks ago",
      collaborators: 1,
    },
  ];

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
                  {isAuthenticated ? user?.email || "Authenticated User" : "Guest"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <NotificationIcon size={16} className="text-[#969696]" />
                {isAuthenticated && (
                  <button
                    onClick={handleLogout}
                    className="text-xs text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Logout
                  </button>
                )}
              </div>
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
                className="w-full bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0038DF] focus:border-transparent"
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
            className="flex"
            style={{ gap: responsive(8), marginBottom: responsive(24) }}
          >
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

          {/* Project Cards */}
          <div
            className="grid grid-cols-1 xl:grid-cols-2"
            style={{
              gap: responsive(24),
              maxWidth: responsive(850), // Constrains to 2 cards max
            }}
          >
            {mockProjects.map((project) => (
              <div
                key={project.id}
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
                      {project.collaborators === 2 && (
                        <div
                          className="bg-[#e0e0e0] border border-[#969696] rounded-full flex items-center justify-center"
                          style={{
                            width: responsive(24),
                            height: responsive(24),
                            marginLeft: responsive(-8),
                            ...r({ borderWidth: 0.68 }),
                          }}
                        >
                          <UserIcon size={12} className="text-[#969696]" />
                        </div>
                      )}
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
                        Edited {project.lastModified}
                      </p>
                    </div>
                  </div>
                </div>{" "}
                {/* Close inner container with 4px spacing */}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveContainer>
  );
};

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}
