import { Shield, Zap, ArrowRight, User } from "lucide-react";
import Link from "next/link";

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="mx-auto w-16 h-16 bg-amber-600 rounded-xl flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Unauthorized Icon */}
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
            <Shield className="w-10 h-10 text-amber-600" />
          </div>
        </div>

        {/* Main Content */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Access Required
        </h1>
        
        <p className="text-gray-600 mb-8">
          You need to be signed in to access BuildPCB.ai&apos;s PCB design tools and AI assistant.
        </p>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Link 
            href="/login"
            className="w-full inline-flex items-center justify-center px-6 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors"
          >
            <User className="w-5 h-5 mr-2" />
            Sign In to Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>

          <Link 
            href="/"
            className="w-full inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Return to Homepage
          </Link>
        </div>

        {/* Feature Preview */}
        <div className="mt-12 p-6 bg-white rounded-lg border border-amber-200">
          <h3 className="font-semibold text-gray-900 mb-2">
            What you&apos;ll get access to:
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• AI-powered PCB design assistant</li>
            <li>• Advanced component library</li>
            <li>• Professional schematic tools</li>
            <li>• Cloud project storage</li>
          </ul>
        </div>

        {/* Help Text */}
        <p className="mt-6 text-sm text-gray-500">
          New to BuildPCB.ai? Creating an account is free and takes less than a minute.
        </p>
      </div>
    </div>
  );
}
