"use client";

import { useState, useEffect } from "react";
import {
  UserIcon,
  ChartIcon,
  CloudIcon,
  WindowIcon,
  ExportIcon,
} from "@/components/icons";
// import { toast } from "sonner"; // Not available
const toast = {
  success: (msg: string) => console.log("✅ " + msg),
  error: (msg: string) => console.error("❌ " + msg),
};
import { ActivityAnalyticsPanel } from "./ActivityAnalyticsPanel";
import { r, responsive, responsiveSquare } from "@/lib/responsive";
import { useProject } from "@/contexts/ProjectContext";
import { Circuit } from "@/lib/schemas/circuit";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import { useAIChat } from "@/contexts/AIChatContext";
import { useProjectStore } from "@/store/projectStore";

interface TopToolbarProps {
  className?: string;
  getNetlist?: (() => any) | null;
  onSave?: (overrideMessages?: any[]) => Promise<void>;
}

export function TopToolbar({
  className = "",
  getNetlist,
  onSave,
}: TopToolbarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);

  // Get project and canvas contexts
  const { currentProject, currentCircuit } = useProject();
  const { messages } = useAIChat();
  const isProjectDirty = useProjectStore((state) => state.isDirty);

  // Get canvas instance for save functionality
  const canvas = canvasCommandManager.getStage();

  // Track last save time for better status display
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  // Add keyboard shortcut for saving (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleChatSave = (event: CustomEvent) => {
      console.log("🔥 Chat save event received, triggering manual save", {
        hasEventDetail: !!event.detail,
        eventMessages: event.detail?.messages?.length || 0,
        currentMessages: messages.length,
      });
      if (currentProject && !isSaving) {
        // Use the messages from the event if available, otherwise fall back to current messages
        const messagesToSave = event.detail?.messages || messages;
        handleExport(messagesToSave);
      }
    };

    window.addEventListener("triggerChatSave", handleChatSave as EventListener);

    return () => {
      window.removeEventListener(
        "triggerChatSave",
        handleChatSave as EventListener
      );
    };
  }, [currentProject, isSaving, messages]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isProjectDirty && !isSaving) {
        return;
      }

      const warningMessage =
        "Changes are still being saved. Leaving now may lose recent updates.";
      event.preventDefault();
      event.returnValue = warningMessage;
      return warningMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isProjectDirty, isSaving]);

  // Save handler
  const handleSave = async () => {
    try {
      if (!currentProject) {
        toast.error("No project loaded");
        return;
      }

      setIsSaving(true);
      const canvas = canvasCommandManager.getStage();
      if (!canvas) {
        toast.error("Canvas not initialized");
        return;
      }

      // Check if project name is empty or default
      if (
        !currentProject.name ||
        currentProject.name.trim() === "" ||
        currentProject.name === "Untitled Project"
      ) {
        setIsNameDialogOpen(true);
        setIsSaving(false);
        return;
      }

      // Use shared save function if available, otherwise fallback
      if (onSave) {
        await onSave();
      } else {
        // Fallback to direct save (note: this might need updates if saveProject expects fabric)
        // For now relying on onSave being passed from IDECanvas which is the standard path
        console.warn(
          "No onSave prop provided to TopToolbar, functionality limited"
        );
      }
      toast.success("Project saved successfully");
    } catch (error) {
      console.error("Failed to save project:", error);
      toast.error("Failed to save project");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (format: "json" | "png" | "svg" = "json") => {
    const canvas = canvasCommandManager.getStage();
    if (!canvas) return;

    if (format === "json") {
      // Export to JSON using shared save mechanism
      if (onSave) {
        await onSave();
      }
    } else if (format === "png") {
      const dataURL = canvas.toDataURL({
        pixelRatio: 2, // Higher quality
        mimeType: "image/png",
      });
      const link = document.createElement("a");
      link.download = `circuit-${
        currentProject?.name || "untitled"
      }-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

            {/* Center: Undo/Redo */}
            <div className="flex items-center" style={{ gap: responsive(8) }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  canvasCommandManager.emit("undo");
                }}
                className="flex items-center justify-center hover:opacity-70 transition-opacity"
                title="Undo (Ctrl+Z)"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600"
                >
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  canvasCommandManager.emit("redo");
                }}
                className="flex items-center justify-center hover:opacity-70 transition-opacity"
                title="Redo (Ctrl+Y)"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600"
                >
                  <path d="M21 7v6h-6" />
                  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                </svg>
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
