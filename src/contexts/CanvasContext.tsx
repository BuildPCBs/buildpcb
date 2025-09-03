"use client";

import React, { createContext, useContext, ReactNode } from "react";
import * as fabric from "fabric";

interface CanvasContextType {
  canvas: fabric.Canvas | null;
  isCanvasReady: boolean;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    // Return safe defaults during SSR instead of throwing
    return {
      canvas: null,
      isCanvasReady: false,
    };
  }
  return context;
}

interface CanvasProviderProps {
  children: ReactNode;
  canvas: fabric.Canvas | null;
  isReady?: boolean;
}

export function CanvasProvider({ 
  children, 
  canvas, 
  isReady = false 
}: CanvasProviderProps) {
  const value: CanvasContextType = {
    canvas,
    isCanvasReady: isReady && canvas !== null,
  };

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
}
