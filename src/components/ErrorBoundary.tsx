'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-96 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-status-caution-surface border border-status-caution-border flex items-center justify-center text-status-caution-content mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-heading-3 text-content-primary">
            Something unexpected occurred
          </h3>
          <p className="text-small text-content-tertiary max-w-sm mt-1 mb-4 leading-relaxed">
            Our diagnostic system encountered an unexpected condition. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="h-(--button-height-compact) px-4 bg-action-primary hover:bg-action-primary-hover text-content-on-action rounded-(--radius-control) text-small font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
