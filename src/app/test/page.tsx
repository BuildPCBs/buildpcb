"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { TopToolbar } from "@/components/layout/TopToolbar";
import { AIPromptPanel } from "@/components/layout/AIPromptPanel";
import { AIChatInterface } from "@/components/ai/AIChatInterface";

export default function TestPage() {
  const { showAuthOverlay } = useAuth();
  const [showDirectOverlay, setShowDirectOverlay] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [showTopToolbar, setShowTopToolbar] = useState(false);
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Component Testing Ground
        </h1>

        <div className="space-y-8">
          {/* Authentication Tests */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Authentication Components
            </h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => showAuthOverlay()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Login Overlay (Context)
              </button>

              <button
                onClick={() => setShowDirectOverlay(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Test Email Entry
              </button>

              <button
                onClick={() => setShowCodeInput(true)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Test 6-Digit Code Input
              </button>
            </div>
          </section>

          {/* UI Components Tests */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              UI Components
            </h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => alert("Schema Panel test - coming soon")}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Test Schema Panel
              </button>

              <button
                onClick={() => alert("Canvas test - coming soon")}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Test Canvas Interactions
              </button>

              <button
                onClick={() => alert("Responsive utilities test - coming soon")}
                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Test Responsive Utils
              </button>

              <button
                onClick={() => setShowTopToolbar(!showTopToolbar)}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                {showTopToolbar ? "Hide" : "Show"} Top Toolbar
              </button>

              <button
                onClick={() => setShowAIPrompt(!showAIPrompt)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {showAIPrompt ? "Hide" : "Show"} AI Prompt Panel
              </button>

              <button
                onClick={() => setShowAIChat(!showAIChat)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showAIChat ? "Hide" : "Show"} AI Chat Interface
              </button>

              <button
                onClick={() =>
                  alert(
                    "Analytics panel now triggered by Export button in Top Toolbar!"
                  )
                }
                className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Info: Analytics via Export
              </button>
            </div>
          </section>

          {/* Core System Tests */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Core Systems
            </h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => {
                  console.log("IDE Core test triggered");
                  alert("Check console for IDE Core status");
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Test IDE Core
              </button>

              <button
                onClick={() => alert("State Manager test - coming soon")}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Test State Manager
              </button>
            </div>
          </section>

          {/* Test Results Area */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Test Results
            </h2>
            <div className="bg-gray-50 rounded-lg p-6 min-h-32">
              <p className="text-gray-600 italic">
                Test results and component outputs will appear here...
              </p>
            </div>
          </section>
        </div>

        {/* Top Toolbar Demo */}
        {showTopToolbar && (
          <section className="border-2 border-teal-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Top Toolbar
            </h3>
            <TopToolbar />
          </section>
        )}

        {/* AI Prompt Panel Demo */}
        {showAIPrompt && (
          <section className="border-2 border-emerald-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              AI Prompt Panel (Original)
            </h3>
            <AIPromptPanel />
          </section>
        )}

        {/* AI Chat Interface Demo */}
        {showAIChat && (
          <section className="border-2 border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              AI Chat Interface (New 200x200 with Dots)
            </h3>
            <div className="flex gap-6">
              <AIChatInterface
                onCircuitUpdate={(changes) =>
                  console.log("Circuit changes:", changes)
                }
              />
              <div className="text-sm text-gray-600 max-w-md">
                <h4 className="font-medium mb-2">Features:</h4>
                <ul className="space-y-1">
                  <li>• 200x200 scrollable chat area</li>
                  <li>• Dot navigation above chat</li>
                  <li>• Current message highlighted in blue</li>
                  <li>• Chat history tracking</li>
                  <li>• Ready for OpenAI GPT-4o integration</li>
                </ul>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Direct Auth Overlay Tests */}
      {showDirectOverlay && (
        <AuthOverlay
          isOpen={showDirectOverlay}
          onClose={() => setShowDirectOverlay(false)}
          onSuccess={() => {
            setShowDirectOverlay(false);
            alert("Email step completed!");
          }}
        />
      )}

      {showCodeInput && (
        <AuthOverlay
          isOpen={showCodeInput}
          onClose={() => setShowCodeInput(false)}
          onSuccess={() => {
            setShowCodeInput(false);
            alert("Code verification completed!");
          }}
        />
      )}

      {/* Top Toolbar Test */}
      {showTopToolbar && <TopToolbar />}

      {/* AI Prompt Panel Test */}
      {showAIPrompt && <AIPromptPanel />}
    </div>
  );
}
