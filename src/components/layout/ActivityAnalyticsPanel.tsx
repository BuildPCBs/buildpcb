"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { r, responsive } from "@/lib/responsive";

// Activity levels with corresponding colors (4 steps of blue)
const ACTIVITY_LEVELS = {
  0: "#DDE2FF", // Lightest: Inactive
  1: "#97ADFF", // Slightly darker: Low
  2: "#3F65FF", // Medium: Moderate
  3: "#0038DF", // Darkest: Busy
} as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface ActivityData {
  date: Date;
  activity: number;
  color: string;
  actionCount: number;
}

interface ActivityAnalyticsPanelProps {
  className?: string;
}

// Generate calendar heatmap data for the past 12 months
function generateActivityData() {
  const data: ActivityData[] = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 12); // 12 months back

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const activity = Math.floor(Math.random() * 4); // 0-3 activity levels
    const actionCount =
      activity === 0 ? 0 : Math.floor(Math.random() * 50) + activity * 10;

    data.push({
      date: new Date(d),
      activity,
      color: ACTIVITY_LEVELS[activity as keyof typeof ACTIVITY_LEVELS],
      actionCount,
    });
  }

  return data;
}

export function ActivityAnalyticsPanel({
  className = "",
}: ActivityAnalyticsPanelProps) {
  const [selectedMonth, setSelectedMonth] = useState("Monthly");
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const activityData = generateActivityData();

  // Create calendar heatmap grid: 7 rows (Sun-Sat) × 53 columns (weeks)
  const weeksInYear = 53;
  const grid: (ActivityData | null)[][] = Array(7)
    .fill(null)
    .map(() => Array(weeksInYear).fill(null));

  // Fill grid with activity data
  activityData.forEach((day) => {
    const dayOfWeek = day.date.getDay(); // 0 = Sunday, 6 = Saturday

    // Calculate week number from start date
    const weeksSinceStart = Math.floor(
      (day.date.getTime() - activityData[0].date.getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );

    if (
      weeksSinceStart >= 0 &&
      weeksSinceStart < weeksInYear &&
      dayOfWeek >= 0 &&
      dayOfWeek < 7
    ) {
      grid[dayOfWeek][weeksSinceStart] = day;
    }
  });

  // Generate month labels based on the first day of each month
  const monthLabels: { month: string; position: number }[] = [];
  let currentMonth = -1;

  activityData.forEach((day, index) => {
    const month = day.date.getMonth();
    if (month !== currentMonth && day.date.getDate() <= 7) {
      // First week of month
      currentMonth = month;
      const weekIndex = Math.floor(index / 7);
      if (weekIndex < weeksInYear) {
        monthLabels.push({
          month: MONTHS[month],
          position: weekIndex,
        });
      }
    }
  });

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const activityLegend = [
    { level: 0, label: "Inactive" },
    { level: 1, label: "Low" },
    { level: 2, label: "Moderate" },
    { level: 3, label: "Busy" },
  ];

  return (
    <div
      className={`bg-white ${className}`}
      style={{
        padding: responsive(24),
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: responsive(20),
        borderWidth: responsive(1),
        border: "1px solid #E5E7EB",
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
      }}
    >
      {/* Header */}
      <div className="w-full mb-6 flex justify-between items-start">
        <div>
          <h2
            className="text-gray-900 font-bold"
            style={{
              fontSize: responsive(18),
              fontWeight: 700,
              lineHeight: "120%",
            }}
          >
            Activity Analytics
          </h2>
          <p
            className="text-gray-500 mt-1"
            style={{
              fontSize: responsive(12),
              fontWeight: 400,
              lineHeight: "120%",
            }}
          >
            Live Performance Stats on editor
          </p>
        </div>

        {/* Filter Chip */}
        <div className="relative">
          <button
            onClick={() => setShowMonthSelector(!showMonthSelector)}
            className="flex items-center bg-gray-100 border border-gray-200 hover:border-[#0038DF] hover:bg-[#0038DF]/10 transition-colors"
            style={{
              ...r({
                width: 78,
                height: 28,
                borderRadius: 14,
                padding: 10,
              }),
              borderWidth: responsive(1),
              gap: responsive(6),
            }}
          >
            <span
              className="text-gray-700 font-medium"
              style={{
                fontSize: responsive(10),
                fontWeight: 500,
              }}
            >
              {selectedMonth}
            </span>
            <ChevronDownIcon
              size={10}
              className={`text-gray-600 transition-transform ${
                showMonthSelector ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Month Selector Dropdown */}
          {showMonthSelector && (
            <>
              <div
                className="fixed inset-0 z-40"
                style={{ backdropFilter: "blur(2px)" }}
                onClick={() => setShowMonthSelector(false)}
              />
              <div
                className="absolute top-full right-0 mt-2 bg-white border border-gray-200 shadow-lg z-50"
                style={{
                  borderRadius: responsive(8),
                  borderWidth: responsive(1),
                  minWidth: responsive(120),
                }}
              >
                {["Monthly", ...MONTHS].map((month) => (
                  <button
                    key={month}
                    onClick={() => {
                      setSelectedMonth(month);
                      setShowMonthSelector(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    style={{
                      fontSize: responsive(10),
                      fontWeight: month === selectedMonth ? 500 : 400,
                    }}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div
        className="flex justify-end items-center mb-4"
        style={{ gap: responsive(8) }}
      >
        <span
          className="text-gray-600"
          style={{
            fontSize: responsive(10),
            fontWeight: 400,
          }}
        >
          Less
        </span>
        {activityLegend.map((item) => (
          <div
            key={item.level}
            className="border border-gray-200"
            style={{
              width: responsive(12),
              height: responsive(12),
              borderRadius: responsive(2),
              backgroundColor:
                ACTIVITY_LEVELS[item.level as keyof typeof ACTIVITY_LEVELS],
              borderWidth: responsive(0.5),
            }}
            title={item.label}
          />
        ))}
        <span
          className="text-gray-600"
          style={{
            fontSize: responsive(10),
            fontWeight: 400,
          }}
        >
          More
        </span>
      </div>

      {/* Calendar Heatmap Grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex" style={{ gap: responsive(12) }}>
          {/* Day Labels */}
          <div className="flex flex-col" style={{ gap: responsive(3) }}>
            {dayLabels.map((day, index) => (
              <div
                key={day}
                className="text-gray-600 text-right flex items-center justify-end"
                style={{
                  width: responsive(24),
                  height: responsive(12),
                  fontSize: responsive(8),
                  fontWeight: 400,
                }}
              >
                {index % 2 === 1 ? day : ""} {/* Show every other day label */}
              </div>
            ))}
          </div>

          {/* Heatmap Grid */}
          <div className="flex flex-col">
            {/* Week Grid */}
            <div className="flex" style={{ gap: responsive(2) }}>
              {Array.from({ length: weeksInYear }, (_, weekIndex) => (
                <div
                  key={weekIndex}
                  className="flex flex-col"
                  style={{ gap: responsive(2) }}
                >
                  {grid.map((week, dayIndex) => {
                    const day = week[weekIndex];
                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className="border border-gray-200"
                        style={{
                          width: responsive(12),
                          height: responsive(12),
                          borderRadius: responsive(2),
                          backgroundColor: day ? day.color : "#F8F9FA",
                          borderWidth: responsive(0.5),
                        }}
                        title={
                          day
                            ? `${day.date.toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}: ${day.actionCount} actions`
                            : "No data"
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Month Labels */}
            <div
              className="flex mt-3 relative"
              style={{
                height: responsive(16),
              }}
            >
              {monthLabels.map((monthData, index) => (
                <span
                  key={`${monthData.month}-${index}`}
                  className="text-gray-600 absolute"
                  style={{
                    fontSize: responsive(8),
                    fontWeight: 400,
                    left: responsive(monthData.position * 14), // Position based on week
                  }}
                >
                  {monthData.month}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
