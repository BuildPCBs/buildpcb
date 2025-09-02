"use client";

import { useState, useEffect } from "react";
import { UserIcon, ChartIcon, CloudIcon } from "@/components/icons";
import { ActivityAnalyticsPanel } from "./ActivityAnalyticsPanel";
import { r, responsive, responsiveSquare } from "@/lib/responsive";

interface TopToolbarProps {
  className?: string;
}

export function TopToolbar({ className = "" }: TopToolbarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);

  // Simulate autosave status
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSaving((prev) => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    console.log("Export clicked - showing analytics panel");
    setShowAnalyticsPanel(true);
  };

  const handleUserClick = () => {
    console.log("User icon clicked");
    // Add user menu functionality here
  };

  const handleChartClick = () => {
    console.log("Chart icon clicked");
    // Add chart functionality here
  };

  return (
    <div className="relative">
      {/* Main Toolbar Box */}
      <div
        className={`fixed bg-white border border-gray-300 flex items-center justify-between ${className}`}
        style={{
          ...r({
            width: 338,
            height: 45,
            borderRadius: 16,
            top: 45,
          }),
          right: responsive(32), // Add some margin from right edge
          borderWidth: responsive(1),
          zIndex: 10,
        }}
      >
        {/* Left Side Icons */}
        <div className="flex items-center" style={{ gap: responsive(25) }}>
          {/* User Icon */}
          <button
            onClick={handleUserClick}
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
            onClick={handleChartClick}
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
          onClick={handleExport}
          className="flex items-center justify-center text-white bg-[#0038DF] hover:bg-[#0032c6] transition-colors"
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
          <span className="font-medium" style={{ fontSize: responsive(10) }}>
            Export
          </span>
        </button>
      </div>

      {/* Autosave Indicator - Outside the box */}
      <div
        className="fixed flex items-center"
        style={{
          ...r({
            top: 61,
          }),
          right: responsive(32 + 338 + 16), // Right margin + box width + spacing
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
          {isSaving ? "Saving..." : "Saved"}
        </span>
      </div>

      {/* Analytics Panel Overlay - Triggered by Export Button Click */}
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
            className="fixed z-50 bg-white"
            style={{
              ...r({
                width: 522,
                height: 331,
                top: 92,
                left: 614,
              }),
              opacity: 1,
              transform: "rotate(0deg)",
              boxShadow:
                "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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
