"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error caught by boundary:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: "var(--space-8)",
          textAlign: "center",
          minHeight: "400px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div style={{ fontSize: "3em", marginBottom: "var(--space-4)" }}>⚠️</div>
          <h2 style={{ 
            color: "var(--color-error, #ef4444)", 
            marginBottom: "var(--space-4)" 
          }}>
            Something went wrong
          </h2>
          <p style={{ 
            color: "var(--color-text-secondary, #6b7280)", 
            marginBottom: "var(--space-6)",
            maxWidth: "500px"
          }}>
            {this.state.error?.message || "An unexpected error occurred. Please refresh the page and try again."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: "var(--space-3) var(--space-6)",
              background: "var(--color-accent, #3b82f6)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md, 6px)",
              cursor: "pointer",
              fontSize: "var(--font-size-base, 16px)"
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}