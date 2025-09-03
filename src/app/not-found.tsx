import { Search, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-blue-100 p-8 text-center">
        {/* 404 Illustration */}
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
            <Search className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        {/* 404 Title */}
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Page Not Found
        </h2>

        {/* Description */}
                <p className="text-gray-600 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Go to IDE
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Quick Links */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-3">Quick Links:</p>
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="block text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="block text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Profile
            </Link>
            <Link
              href="/login"
              className="block text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
