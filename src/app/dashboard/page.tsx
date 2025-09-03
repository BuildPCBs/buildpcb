"use client";

import React, { useState } from "react";
import { UserIcon, NotificationIcon, SearchIcon } from "@/components/icons";
import { ResponsiveContainer } from "@/components/layout/ResponsiveContainer";
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
      name: "Motor Controller",
      lastModified: "3 days ago",
      collaborators: 0,
    },
    {
      id: 4,
      name: "Sensor Board",
      lastModified: "1 week ago",
      collaborators: 3,
    },
  ];

  return (
    <ResponsiveContainer>
      <div
        className="min-h-screen bg-[#F8F9FA]"
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          className="bg-white border-b border-[#E1E5E9]"
          style={{
            padding: `${responsive(16)} ${responsive(24)}`,
          }}
        >
          <div className="flex items-center justify-between">
            {/* Left side - Logo */}
            <div className="flex items-center">
              <h1
                className="font-semibold text-[#1A1A1A]"
                style={{
                  fontSize: responsiveFontSize(18),
                }}
              >
                BuildPCB
              </h1>
            </div>

            {/* Right side - User info */}
            <div className="flex items-center">
              <div className="flex items-center gap-2 mr-4">
                <UserIcon size={16} className="text-[#969696]" />
                <span
                  className="text-[#969696]"
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
          </div>

          {/* Search Box */}
          <div className="relative">
            <div
              className="bg-[#F8F9FA] border border-[#E1E5E9] flex items-center"
              style={{
                borderRadius: responsive(12),
                padding: responsive(12),
                marginTop: responsive(16),
              }}
            >
              <SearchIcon size={16} className="text-[#969696] mr-2" />
              <input
                type="text"
                placeholder="Search projects..."
                className="bg-transparent flex-1 outline-none text-[#1A1A1A] placeholder-[#969696]"
                style={{
                  fontSize: responsiveFontSize(14),
                }}
              />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            padding: `${responsive(32)} ${responsive(24)}`,
          }}
        >
          {/* Page Title */}
          <h2
            className="text-[#1A1A1A] font-medium mb-8"
            style={{
              fontSize: responsiveFontSize(24),
            }}
          >
            Dashboard
          </h2>

          {/* Tab Navigation */}
          <div
            className="flex gap-4 mb-8"
            style={{
              marginBottom: responsive(32),
            }}
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
              maxWidth: responsive(850),
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
                }}
              >
                {/* Project Header */}
                <div className="flex items-start justify-between mb-3">
                  <h3
                    className="font-medium text-[#1A1A1A] truncate"
                    style={{
                      fontSize: responsiveFontSize(16),
                      maxWidth: responsive(250),
                    }}
                  >
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-1 ml-2">
                    {/* Collaborator icons */}
                    {Array.from({ length: Math.min(project.collaborators, 3) }).map(
                      (_, i) => (
                        <div
                          key={i}
                          className="bg-[#969696] rounded-full"
                          style={{
                            width: responsive(20),
                            height: responsive(20),
                          }}
                        />
                      )
                    )}
                    {project.collaborators > 3 && (
                      <span
                        className="text-[#969696] ml-1"
                        style={{
                          fontSize: responsiveFontSize(12),
                        }}
                      >
                        +{project.collaborators - 3}
                      </span>
                    )}
                  </div>
                </div>

                {/* Project Stats */}
                <div className="space-y-2">
                  <p
                    className="text-[#969696]"
                    style={{
                      fontSize: responsiveFontSize(14),
                    }}
                  >
                    Last modified: {project.lastModified}
                  </p>
                </div>

                {/* Project Preview Area */}
                <div
                  className="bg-white border border-[#E1E5E9] mt-4 flex items-center justify-center"
                  style={{
                    ...r({
                      borderRadius: 12,
                      height: 120,
                    }),
                  }}
                >
                  <div className="text-center">
                    <div
                      className="w-12 h-12 bg-[#F8F9FA] rounded-lg mx-auto mb-2 flex items-center justify-center"
                      style={{
                        width: responsive(48),
                        height: responsive(48),
                      }}
                    >
                      {/* Placeholder icon */}
                      <div className="w-6 h-6 bg-[#E1E5E9] rounded"></div>
                    </div>
                    <span
                      className="text-[#969696]"
                      style={{
                        fontSize: responsiveFontSize(12),
                      }}
                    >
                      PCB Preview
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveContainer>
  );
};

export default Dashboard;
