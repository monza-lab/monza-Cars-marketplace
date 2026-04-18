"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={cn(
            "flex min-h-[300px] items-center justify-center p-8",
            this.props.className
          )}
        >
          <div className="relative w-full max-w-md">
            {/* Background glow effect */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-900/20 via-amber-900/20 to-red-900/20 blur-xl" />

            <div className="relative rounded-2xl border border-zinc-800/80 bg-zinc-950/90 p-8 shadow-2xl backdrop-blur-sm">
              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

              {/* Icon */}
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-3 rounded-full bg-destructive/10 blur-md" />
                  <div className="relative flex size-14 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
                    <AlertTriangle className="size-7 text-destructive" />
                  </div>
                </div>
              </div>

              {/* Error message */}
              <div className="mb-6 text-center">
                <h3 className="mb-2 text-lg font-semibold tracking-tight text-zinc-100">
                  Something went wrong
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">
                  An unexpected error occurred. Please try again or contact
                  support if the problem persists.
                </p>
              </div>

              {/* Error details (collapsible) */}
              {this.state.error && (
                <details className="mb-6 group">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 transition-colors hover:text-destructive">
                    View error details
                  </summary>
                  <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                    <code className="block overflow-x-auto whitespace-pre-wrap text-xs text-destructive/80">
                      {this.state.error.message}
                    </code>
                  </div>
                </details>
              )}

              {/* Try Again button */}
              <div className="flex justify-center">
                <Button
                  onClick={this.handleReset}
                  className="group relative overflow-hidden border border-amber-500/20 bg-gradient-to-r from-amber-600 to-amber-500 px-6 text-zinc-950 shadow-lg shadow-amber-500/10 transition-all hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/20"
                >
                  <RefreshCw className="mr-2 size-4 transition-transform group-hover:rotate-180" />
                  Try Again
                </Button>
              </div>

              {/* Bottom accent line */}
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
