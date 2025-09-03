"use client";

import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";

export function ProjectRenameDialog() {
  const { currentProject, renameProject } = useProject();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show rename option for "Untitled" projects
  if (!currentProject || currentProject.name !== "Untitled") {
    return null;
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await renameProject(newName.trim());
      setIsRenaming(false);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename project");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRenaming) {
    return (
      <button
        onClick={() => setIsRenaming(true)}
        className="text-blue-600 hover:text-blue-700 text-sm underline"
      >
        Give your project a name
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
        <h3 className="text-lg font-semibold mb-4">Name Your Project</h3>

        <form onSubmit={handleRename}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter project name..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
            disabled={isLoading}
          />

          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setIsRenaming(false);
                setNewName("");
                setError(null);
              }}
              className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Saving..." : "Save Name"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProjectRenameDialog;
