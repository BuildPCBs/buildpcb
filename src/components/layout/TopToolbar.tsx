"use client";

import { useState, useEffect } from "react";
import {
  UserIcon,
  ChartIcon,
  CloudIcon,
  WindowIcon,
  ExportIcon,
} from "@/components/icons";
import { ActivityAnalyticsPanel } from "./ActivityAnalyticsPanel";
import { r, responsive, responsiveSquare } from "@/lib/responsive";
import { useProject } from "@/contexts/ProjectContext";
import { Circuit } from "@/lib/schemas/circuit";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";

interface TopToolbarProps {
  className?: string;
}

export function TopToolbar({ className = "" }: TopToolbarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Get project and canvas contexts
  const { currentProject, currentCircuit, saveProject } = useProject();

  // Track last save time for better status display
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  // Add keyboard shortcut for saving (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (currentProject && !isSaving) {
          handleExport();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentProject, isSaving]);

  const handleExport = async () => {
    if (!currentProject) {
      setSaveError("No project loaded");
      return;
    }

    // Get canvas from command manager instead of context
    const canvas = canvasCommandManager.getCanvas();
    if (!canvas) {
      setSaveError(
        "Canvas not initialized yet. Please wait a moment and try again."
      );
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      // Get canvas data using the same method as auto-save
      const { serializeCanvasData } = await import(
        "@/canvas/utils/canvasSerializer"
      );
      const canvasData = serializeCanvasData(canvas);

      // Get circuit data - use current circuit or create empty one
      const circuitData: Circuit = currentCircuit || {
        mode: "full",
        components: [],
        connections: [],
      };

      // Save the project
      await saveProject(circuitData, canvasData);

      // Update last save time
      setLastSaveTime(new Date());

      console.log("✅ Project saved successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save project";
      setSaveError(errorMessage);
      console.error("❌ Error saving project:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserClick = () => {
    console.log("User icon clicked");
    // Add user menu functionality here
  };

  const handleChartClick = () => {
    console.log("Chart icon clicked - showing analytics panel");
    setShowAnalyticsPanel(true);
  };

  const toggleFullExpand = () => {
    if (isFullyExpanded) {
      setIsFullyExpanded(false);
      setIsHovered(false);
    } else {
      setIsFullyExpanded(true);
    }
  };

  // Determine toolbar state and styles
  const getToolbarStyles = () => {
    if (isFullyExpanded) {
      return {
        width: responsive(338),
        height: responsive(45),
        borderRadius: responsive(16),
      };
    } else if (isHovered) {
      return {
        width: responsive(200),
        height: responsive(45),
        borderRadius: responsive(16),
      };
    } else {
      return {
        width: responsive(45),
        height: responsive(45),
        borderRadius: responsive(22.5),
      };
    }
  };

  return (
    <div className="relative">
      {/* Main Toolbar Box */}
      <div
        className={`fixed bg-white border border-gray-300 flex items-center justify-between transition-all duration-300 ease-in-out overflow-hidden cursor-pointer ${className}`}
        style={{
          ...getToolbarStyles(),
          top: responsive(45),
          right: responsive(32), // Position from right edge
          borderWidth: responsive(1),
          zIndex: 10,
        }}
        onMouseEnter={() => !isFullyExpanded && setIsHovered(true)}
        onMouseLeave={() => !isFullyExpanded && setIsHovered(false)}
        onClick={(e) => {
          if (!isFullyExpanded) {
            e.stopPropagation();
            toggleFullExpand();
          }
        }}
      >
        {/* Collapsed state - just show WindowIcon */}
        {!isHovered && !isFullyExpanded && (
          <div className="flex items-center justify-center w-full h-full">
            <ExportIcon size={20} className="text-[#0038DF]" />
          </div>
        )}

        {/* Hover state OR Fully expanded - show full toolbar */}
        {(isHovered || isFullyExpanded) && (
          <>
            {/* Left Side Icons */}
            <div className="flex items-center" style={{ gap: responsive(25) }}>
              {/* User Icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUserClick();
                }}
                className="flex items-center justify-center border border-gray-300 hover:border-[#0038DF] hover:bg-[#0038DF]/10 transition-colors"
                style={{
                  ...responsiveSquare(24),
                  borderRadius: responsive(99),
                  borderWidth: responsive(0.5),
                  marginLeft: responsive(11),
                }}
              >
                <UserIcon size={16} className="text-gray-600" />
              </button>

              {/* Chart Icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleChartClick();
                }}
                className="flex items-center justify-center border border-gray-400 hover:border-[#0038DF] hover:bg-[#0038DF]/10 transition-colors"
                style={{
                  ...r({
                    width: 24,
                    height: 24,
                  }),
                  borderWidth: responsive(1.2),
                  borderRadius: responsive(4),
                }}
              >
                <ChartIcon size={16} className="text-gray-700" />
              </button>
            </div>

            {/* Right Side Export Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleExport();
              }}
              disabled={isSaving || !currentProject}
              title={
                navigator.platform.includes("Mac")
                  ? "Export (⌘S)"
                  : "Export (Ctrl+S)"
              }
              className={`flex items-center justify-center text-white transition-colors ${
                isSaving || !currentProject
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#0038DF] hover:bg-[#0032c6]"
              }`}
              style={{
                ...r({
                  width: 83,
                  height: 30,
                  borderRadius: 8,
                  padding: 10,
                }),
                marginRight: responsive(8),
              }}
            >
              <span
                className="font-medium"
                style={{ fontSize: responsive(10) }}
              >
                {isSaving ? "Saving..." : "Export"}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Autosave Indicator - Outside the box */}
      <div
        className="fixed flex items-center"
        style={{
          ...r({
            top: 61,
          }),
          right: responsive(
            32 + (isFullyExpanded ? 338 : isHovered ? 200 : 45) + 16
          ), // Dynamic right margin based on toolbar width
          gap: responsive(6),
          zIndex: 9,
        }}
      >
        {/* Cloud Icon */}
        <CloudIcon
          size={20}
          className={`${
            isSaving ? "text-[#0038DF] animate-pulse" : "text-gray-400"
          } transition-colors`}
          isAnimating={isSaving}
        />

        {/* Saving Text */}
        <div className="flex flex-col items-start">
          <span
            className={`font-medium ${
              isSaving ? "text-[#0038DF]" : "text-gray-500"
            } transition-colors`}
            style={{
              fontSize: responsive(8),
              lineHeight: "120%",
              letterSpacing: "-0.5%",
              fontWeight: 500,
            }}
          >
            {isSaving ? "Saving..." : lastSaveTime ? "Saved" : "Ready"}
          </span>
          {lastSaveTime && !isSaving && (
            <span
              className="text-gray-400"
              style={{
                fontSize: responsive(6),
                lineHeight: "100%",
              }}
            >
              {lastSaveTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Error Notification */}
      {saveError && (
        <div
          className="fixed bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg"
          style={{
            ...r({
              top: 95,
            }),
            right: responsive(32), // Position from right edge
            maxWidth: "300px",
            zIndex: 10,
          }}
        >
          <div className="flex items-center">
            <span className="text-sm font-medium">
              Save failed: {saveError}
            </span>
            <button
              onClick={() => setSaveError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Analytics Panel Overlay - Triggered by Chart Icon Click */}
      {showAnalyticsPanel && (
        <>
          {/* Blur Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ backdropFilter: "blur(4px)" }}
            onClick={() => setShowAnalyticsPanel(false)}
          />

          {/* Analytics Panel Container */}
          <div
            className="fixed z-50"
            style={{
              ...r({
                width: 522,
                height: 331,
                top: 92,
                left: 614,
                borderRadius: 20,
              }),
              opacity: 1,
              transform: "rotate(0deg)",
              overflow: "hidden", // Ensure content doesn't bleed outside rounded corners
            }}
          >
            {/* Analytics Panel Content */}
            <div className="h-full w-full">
              <ActivityAnalyticsPanel className="h-full w-full" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
