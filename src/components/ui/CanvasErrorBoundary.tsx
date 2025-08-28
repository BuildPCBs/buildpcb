"use client";

import React from 'react';

interface CanvasErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class CanvasErrorBoundary extends React.Component<
  CanvasErrorBoundaryProps,
  CanvasErrorBoundaryState
> {
  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Canvas Error Boundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center p-6 max-w-md">
            <div className="text-red-600 text-lg font-semibold mb-2">
              Canvas Error
            </div>
            <div className="text-red-500 text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred in the canvas'}
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-left text-xs bg-red-100 p-2 rounded mb-4">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 overflow-auto max-h-32">
                  {this.state.error?.stack}
                </pre>
                <pre className="mt-2 overflow-auto max-h-32">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleRetry}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
