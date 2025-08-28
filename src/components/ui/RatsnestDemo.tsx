"use client";

import React, { useState } from 'react';
import { useView } from '@/contexts/ViewContext';

export const RatsnestDemo: React.FC = () => {
  const { sharedComponents, connections, addDemoConnections, clearConnections, validateState, getStats } = useView();
  const [isExpanded, setIsExpanded] = useState(false);

  const stats = getStats();
  const isValidState = validateState();

  return (
    <div className="absolute top-4 right-4 bg-purple-600 bg-opacity-90 text-white rounded-lg shadow-lg backdrop-blur-sm border border-purple-500">
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Ratsnest Demo</div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-purple-200 hover:text-white transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
        
        <div className="text-xs mt-1">
          Components: {stats.componentCount} | Connections: {stats.connectionCount}
          {stats.validConnections !== stats.connectionCount && (
            <span className="text-yellow-300"> | Invalid: {stats.connectionCount - stats.validConnections}</span>
          )}
        </div>

        {!isValidState && (
          <div className="text-xs text-red-300 mt-1">⚠️ State validation failed</div>
        )}

        {isExpanded && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={addDemoConnections}
                disabled={stats.componentCount < 2}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 px-2 py-1 rounded text-xs transition-colors"
                title={stats.componentCount < 2 ? "Need at least 2 components" : "Add demo connections"}
              >
                Add Demo Connections
              </button>
              <button
                onClick={clearConnections}
                disabled={stats.connectionCount === 0}
                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-500 px-2 py-1 rounded text-xs transition-colors"
                title="Clear all connections"
              >
                Clear All
              </button>
            </div>

            <div className="text-xs space-y-1 bg-black bg-opacity-20 p-2 rounded">
              <div>Valid Connections: {stats.validConnections}/{stats.connectionCount}</div>
              <div>State Valid: {isValidState ? '✅' : '❌'}</div>
              {process.env.NODE_ENV === 'development' && (
                <>
                  <div className="border-t border-purple-400 pt-1 mt-1">
                    <div>Performance Info:</div>
                    <div>• Real-time ratsnest updates</div>
                    <div>• Throttled for 60fps</div>
                    <div>• Batched rendering</div>
                  </div>
                </>
              )}
            </div>

            <div className="text-xs opacity-80">
              Add 2+ components in schematic view, switch to PCB view, then test ratsnest visualization
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
