"use client";

import React, { ReactNode, createContext, useContext } from "react";

interface ResponsiveContainerProps {
  children: ReactNode;
  designWidth?: number;
  designHeight?: number;
}

interface ResponsiveContextValue {
  designWidth: number;
  designHeight: number;
  vw: (value: number) => string; // Convert design px to vw
  vh: (value: number) => string; // Convert design px to vh
  rem: (value: number) => string; // Convert design px to rem (assuming 16px base)
  responsive: (value: number) => string; // Smart responsive conversion
}

const ResponsiveContext = createContext<ResponsiveContextValue | undefined>(undefined);

export const useResponsive = () => {
  const context = useContext(ResponsiveContext);
  if (!context) {
    throw new Error('useResponsive must be used within a ResponsiveContainer');
  }
  return context;
};

export function ResponsiveContainer({
  children,
  designWidth = 1280,
  designHeight = 832,
}: ResponsiveContainerProps) {
  
  const contextValue: ResponsiveContextValue = {
    designWidth,
    designHeight,
    vw: (value: number) => `${(value / designWidth) * 100}vw`,
    vh: (value: number) => `${(value / designHeight) * 100}vh`,
    rem: (value: number) => `${value / 16}rem`, // Assuming 16px base font
    responsive: (value: number) => {
      // For values less than 8px, use rem for better scaling
      if (value <= 8) return `${value / 16}rem`;
      // For larger values, use vw for fluid scaling
      return `${(value / designWidth) * 100}vw`;
    },
  };

  return (
    <ResponsiveContext.Provider value={contextValue}>
      <div className="w-full bg-white">
        {children}
      </div>
    </ResponsiveContext.Provider>
  );
}
