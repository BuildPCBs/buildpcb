"use client";

import { useState, useRef, useEffect } from "react";
import { EditIcon } from "@/components/icons";
import { useProject } from "@/contexts/ProjectContext";

interface EditableProjectNameProps {
  className?: string;
  onRenameSuccess?: (newName: string) => void;
  onRenameError?: (error: string) => void;
}

export function EditableProjectName({
  className = "",
  onRenameSuccess,
  onRenameError,
}: EditableProjectNameProps) {
  const { currentProject, renameProject } = useProject();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize edit value when starting to edit
  useEffect(() => {
    if (isEditing && currentProject) {
      setEditValue(currentProject.name || "");
      // Focus the input after render
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, currentProject]);

  const handleStartEdit = () => {
    if (!currentProject || isLoading) return;
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!currentProject || !editValue.trim() || isLoading) {
      // If empty, revert to original name
      if (!editValue.trim()) {
        handleCancelEdit();
      }
      return;
    }

    const trimmedName = editValue.trim();

    // Don't save if the name hasn't changed
    if (trimmedName === currentProject.name) {
      handleCancelEdit();
      return;
    }

    // Validate name length (reasonable limits)
    if (trimmedName.length > 100) {
      onRenameError?.("Project name must be 100 characters or less");
      return;
    }

    try {
      setIsLoading(true);
      await renameProject(trimmedName);
      setIsEditing(false);
      setEditValue("");
      onRenameSuccess?.(trimmedName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to rename project";
      onRenameError?.(errorMessage);
      console.error("Failed to rename project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  if (!currentProject) {
    return <span className={className}>Project</span>;
  }

  if (isEditing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveEdit}
          className="bg-white bg-opacity-20 text-black border border-white border-opacity-30 rounded px-2 py-1 outline-none font-medium min-w-0 max-w-40 focus:bg-opacity-30 focus:border-opacity-50"
          disabled={isLoading}
          placeholder="Project name..."
          maxLength={100}
        />
        {isLoading && (
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-spin"></div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 group cursor-pointer ${className}`}
      onClick={handleStartEdit}
      title="Click to rename project"
    >
      <span className="font-medium">{currentProject.name}</span>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-0.5 hover:bg-white hover:bg-opacity-20 rounded">
        <EditIcon size={12} className="text-white" />
      </div>
    </div>
  );
}
