import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard caught unhandled exception:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#0a0e17",
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              width: "100%",
              background: "rgba(18, 24, 38, 0.95)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: "12px",
              padding: "28px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  padding: "10px",
                  borderRadius: "8px",
                  color: "#ef4444",
                  display: "flex",
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                  Dashboard Interface Recovered
                </h2>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  AutoBots caught a component runtime exception
                </div>
              </div>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                padding: "12px 14px",
                borderRadius: "6px",
                fontFamily: "monospace",
                fontSize: "12px",
                color: "#fca5a5",
                marginBottom: "20px",
                overflowX: "auto",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              {this.state.error?.message || "An unknown render error occurred"}
            </div>

            <button
              onClick={this.handleReload}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "#6366f1",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <RefreshCw size={14} />
              Reload AutoBots Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
