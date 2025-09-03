"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DatabaseVerification() {
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const verifyDatabase = async () => {
    setIsLoading(true);
    setResults([]);

    addResult("🔍 Starting database verification...");

    try {
      // Check auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        addResult("❌ Authentication required");
        return;
      }
      addResult(`✅ User authenticated: ${user.email}`);

      // Test each table
      const tables = [
        "projects",
        "project_versions",
        "components",
        "project_collaborators",
        "project_activity",
        "user_preferences",
        "component_usage",
      ];

      for (const table of tables) {
        try {
          const { error } = await supabase
            .from(table)
            .select("count", { count: "exact", head: true });
          if (error) {
            addResult(`❌ Table '${table}': ${error.message}`);
          } else {
            addResult(`✅ Table '${table}': Accessible`);
          }
        } catch (err) {
          addResult(
            `❌ Table '${table}': ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        }
      }

      // Test project creation
      addResult("🧪 Testing project creation...");
      const { data: testProject, error: createError } = await supabase
        .from("projects")
        .insert([
          {
            name: `Test Project ${Date.now()}`,
            description: "Database verification test",
            owner_id: user.id,
          },
        ])
        .select()
        .single();

      if (createError) {
        addResult(`❌ Project creation failed: ${createError.message}`);
      } else {
        addResult(`✅ Project creation successful: ${testProject.name}`);

        // Clean up
        await supabase.from("projects").delete().eq("id", testProject.id);
        addResult("🧹 Test project cleaned up");
      }
    } catch (error) {
      addResult(
        `❌ Unexpected error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsLoading(false);
      addResult("🏁 Database verification completed");
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">
            Database Schema Verification
          </h1>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Verify Database Tables</h2>
              <button
                onClick={verifyDatabase}
                disabled={isLoading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Verifying..." : "Verify Database"}
              </button>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 h-96 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-gray-500 italic">
                  Click "Verify Database" to check if schema was deployed
                  correctly
                </p>
              ) : (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <div key={index} className="text-sm font-mono">
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              Schema Deployment Instructions
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-green-600">
                  ✅ Deploy Schema to Supabase:
                </h3>
                <ol className="list-decimal list-inside space-y-2 ml-4 mt-2">
                  <li>
                    Go to{" "}
                    <a
                      href="https://app.supabase.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Supabase Dashboard
                    </a>
                  </li>
                  <li>Select your BuildPCB project</li>
                  <li>
                    Click <strong>"SQL Editor"</strong> in the sidebar
                  </li>
                  <li>
                    Click <strong>"New Query"</strong>
                  </li>
                  <li>
                    Copy the entire contents of{" "}
                    <code>/database/schema.sql</code>
                  </li>
                  <li>
                    Paste into the SQL editor and click <strong>"Run"</strong>
                  </li>
                  <li>Come back here and click "Verify Database"</li>
                </ol>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-blue-600">
                  📋 What This Creates:
                </h3>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                  <li>
                    <code>projects</code> - PCB project metadata
                  </li>
                  <li>
                    <code>project_versions</code> - Version control for designs
                  </li>
                  <li>
                    <code>components</code> - Component library
                  </li>
                  <li>
                    <code>project_collaborators</code> - Team permissions
                  </li>
                  <li>
                    <code>project_activity</code> - Activity logging
                  </li>
                  <li>
                    <code>user_preferences</code> - User settings
                  </li>
                  <li>
                    <code>component_usage</code> - Usage tracking
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
