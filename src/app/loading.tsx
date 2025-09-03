import { Loader2, Zap } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Loading Spinner */}
        <div className="mb-6">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
        </div>

        {/* Loading Text */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Loading BuildPCB.ai
        </h1>
        
        <p className="text-gray-600 mb-8">
          Setting up your PCB design environment...
        </p>

        {/* Loading Steps */}
        <div className="max-w-sm mx-auto space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Initializing canvas</span>
            <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Loading components</span>
            <div className="w-4 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Connecting AI assistant</span>
            <div className="w-4 h-4 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8 max-w-xs mx-auto">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: "70%" }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
