"use client";

import React, { useState, useEffect, ReactNode } from 'react';

interface ResponsiveContainerProps {
  children: ReactNode;
  designWidth?: number;
  designHeight?: number;
}

export function ResponsiveContainer({ 
  children, 
  designWidth = 1280, 
  designHeight = 832 
}: ResponsiveContainerProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const scaleX = window.innerWidth / designWidth;
      const scaleY = window.innerHeight / designHeight;
      setScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [designWidth, designHeight]);

  return (
    <div className="relative overflow-hidden" style={{ width: '100vw', height: '100vh' }}>
      <div 
        className="absolute origin-top-left"
        style={{
          transform: `scale(${scale})`,
          width: `${designWidth}px`,
          height: `${designHeight}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
