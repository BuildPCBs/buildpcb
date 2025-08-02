"use client";

import React from "react";

interface ContextMenuProps {
  visible: boolean;
  top: number;
  left: number;
  menuType: "object" | "canvas";
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  canPaste: boolean;
  onClose: () => void;
}

export function ContextMenu({
  visible,
  top,
  left,
  menuType,
  onCopy,
  onPaste,
  onDelete,
  canPaste,
  onClose,
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
        {/* Object menu: Copy and Delete */}
        {menuType === "object" && (
          <>
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              onClick={() => {
                onCopy();
                onClose();
              }}
            >
              <span className="text-gray-500">⌘C</span>
              Copy
            </button>

            <hr className="my-1 border-gray-200" />

            <button
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => {
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
