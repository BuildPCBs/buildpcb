"use client";

import React from "react";

interface ContextMenuProps {
  visible: boolean;
  top: number;
  left: number;
  menuType: "object" | "canvas";
  canPaste: boolean;
  onClose: () => void;
  // PART 2: Direct function props for debugging
  onGroup: () => void;
  onUngroup: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

/**
 * PART 2: The "Triggers" - Context Menu (Direct Connection Test)
 * This bypasses the command manager and calls functions directly
 */
export function ContextMenu({
  visible,
  top,
  left,
  menuType,
  canPaste,
  onClose,
  onGroup,
  onUngroup,
  onDelete,
  onCopy,
  onPaste,
}: ContextMenuProps) {
  if (!visible) return null;

  return (
    <>
      {/* Invisible overlay to close menu when clicking outside */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Context menu */}
      <div
        className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]"
        style={{
          top: `${top}px`,
          left: `${left}px`,
        }}
      >
        {/* Object menu: Copy, Group, Ungroup, Delete */}
        {menuType === "object" && (
          <>
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                console.log('TRIGGER: Context Menu "Copy" button clicked.');
                onCopy();
                onClose();
              }}
            >
              <span className="text-gray-500">⌘C</span>
              Copy
            </button>

            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                console.log('TRIGGER: Context Menu "Group" button clicked.');
                onGroup();
                onClose();
              }}
            >
              <span className="text-gray-500">⌘G</span>
              Group
            </button>

            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                console.log('TRIGGER: Context Menu "Ungroup" button clicked.');
                onUngroup();
                onClose();
              }}
            >
              <span className="text-gray-500">⌘⇧G</span>
              Ungroup
            </button>

            <hr className="my-1 border-gray-200" />

            <button
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => {
                console.log('TRIGGER: Context Menu "Delete" button clicked.');
                onDelete();
                onClose();
              }}
            >
              <span className="text-gray-500">⌫</span>
              Delete
            </button>
          </>
        )}

        {/* Canvas menu: Paste only */}
        {menuType === "canvas" && (
          <button
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              canPaste
                ? "text-gray-700 hover:bg-gray-100"
                : "text-gray-400 cursor-not-allowed"
            }`}
            onClick={() => {
              if (canPaste) {
                console.log('TRIGGER: Context Menu "Paste" button clicked.');
                onPaste();
                onClose();
              }
            }}
            disabled={!canPaste}
          >
            <span className="text-gray-500">⌘V</span>
            Paste
          </button>
        )}
      </div>
    </>
  );
}
