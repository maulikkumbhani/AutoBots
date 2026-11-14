import React, { useState } from "react";
import { Server, Wifi, WifiOff, X, CheckCircle, AlertTriangle, RefreshCw, Copy, Check, ExternalLink } from "lucide-react";
import { getStoredApiUrl, setStoredApiUrl, checkBackendHealth } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChanged: () => void;
}

export const ServerConnectionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConnectionChanged,
}) => {
  const [urlInput, setUrlInput] = useState<string>(getStoredApiUrl());
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  if (!isOpen) return null;

  const terminalCommand = "cd backend && source venv/bin/activate && python3 -m uvicorn app.main:app --port 8000 --host 0.0.0.0 --reload";

  const handleCopy = () => {
    navigator.clipboard.writeText(terminalCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  const handleTestAndSave = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setStoredApiUrl(urlInput.trim());
      const health = await checkBackendHealth();
      if (health.ok) {
        setTestResult({ ok: true, message: `Connected successfully to ${health.url}!` });
        onConnectionChanged();
      } else {
        setTestResult({
          ok: false,
          message: `Cannot connect to ${health.url} (${health.error || "Connection Refused"}). Is the backend running?`,
        });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: `Connection failed: ${err?.message || "Refused"}` });
    } finally {
      setTesting(false);
    }
  };

  const handleResetDefault = () => {
    setUrlInput("http://localhost:8000");
    setStoredApiUrl("http://localhost:8000");
    setTestResult(null);
    onConnectionChanged();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "580px",
          backgroundColor: "#0d1322",
          border: "1px solid rgba(99, 102, 241, 0.35)",
          borderRadius: "14px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.7)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Server size={18} color="#38bdf8" />
            <strong style={{ fontSize: "15px", color: "#f8fafc" }}>Backend Server Connection</strong>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Explanation Banner */}
          <div
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "8px",
              padding: "12px 14px",
              fontSize: "12px",
              color: "#fca5a5",
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertTriangle size={14} color="#ef4444" />
              <span>Fixing "ERR_CONNECTION_REFUSED" or "Failed to fetch"</span>
            </div>
            This error happens when the Python backend server (FastAPI/Uvicorn) is not running on your machine, or when viewing this site from a phone/Vercel that cannot reach <code>localhost:8000</code>.
          </div>

          {/* Section 1: Run Backend Locally */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              1. Start Backend in Terminal (Local Machine):
            </label>
            <div
              style={{
                background: "#080c14",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "6px",
                padding: "10px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span style={{ overflowX: "auto", whiteSpace: "nowrap" }}>{terminalCommand}</span>
              <button
                onClick={handleCopy}
                style={{
                  background: copiedCmd ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                  border: `1px solid ${copiedCmd ? "#10b981" : "rgba(255, 255, 255, 0.15)"}`,
                  color: copiedCmd ? "#34d399" : "#e2e8f0",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  flexShrink: 0,
                }}
              >
                {copiedCmd ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedCmd ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Custom API URL */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              2. Backend Server URL:
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="http://localhost:8000 or https://your-backend.com"
                style={{
                  flex: 1,
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#f8fafc",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <button
                onClick={handleTestAndSave}
                disabled={testing}
                className="btn btn-primary"
                style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {testing ? <RefreshCw size={13} className="animate-spin" /> : <Wifi size={13} />}
                <span>{testing ? "Testing..." : "Test & Save"}</span>
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
              <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                Tip: For mobile testing on WiFi, use your computer's IP (e.g. <code>http://192.168.1.XX:8000</code>).
              </span>
              <button
                onClick={handleResetDefault}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-primary)",
                  fontSize: "10px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Reset to localhost:8000
              </button>
            </div>
          </div>

          {/* Test Feedback */}
          {testResult && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: testResult.ok ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${testResult.ok ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                color: testResult.ok ? "var(--bullish-green)" : "var(--bearish-red)",
              }}
            >
              {testResult.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(10, 15, 26, 0.8)",
          }}
        >
          <button className="btn btn-outline" style={{ fontSize: "12px" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

