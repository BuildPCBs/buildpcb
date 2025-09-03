"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { DatabaseService } from "@/lib/database";
import { ResponsiveContainer } from "@/components/layout/ResponsiveContainer";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const NewProjectPage = () => {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const createNewProject = async () => {
      if (!user) {
        console.log("❌ No user found, redirecting to login");
        router.push("/login");
        return;
      }

      try {
        console.log("➕ Creating new project for user:", user.id);

        const newProject = await DatabaseService.createProject({
          name: `New Project ${new Date().toLocaleDateString()}`,
          description: "New PCB design project",
          owner_id: user.id,
        });

        console.log("✅ Created new project:", newProject);

        // Navigate to the new project
        router.push(`/project/${newProject.id}`);
      } catch (err) {
        console.error("❌ Failed to create project:", err);
        // On error, redirect to projects page
        router.push("/projects");
      }
    };

    createNewProject();
  }, [user, router]);

  return (
    <ProtectedRoute>
      <ResponsiveContainer>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Creating your new project...
            </h2>
            <p className="text-gray-600">
              Please wait while we set up your PCB design workspace.
            </p>
          </div>
        </div>
      </ResponsiveContainer>
    </ProtectedRoute>
  );
};

export default NewProjectPage;
