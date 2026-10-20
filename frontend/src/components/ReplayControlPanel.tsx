import React, { useState } from "react";
import { ReplayResult } from "../types";
import { executeHistoricalReplay } from "../api";
import { History, Play, CheckCircle2, XCircle, Clock, Calendar, FastForward } from "lucide-react";

interface Props {
  symbol: string;
  onReplayExecuted: (result: ReplayResult) => void;
}

export const ReplayControlPanel: React.FC<Props> = ({ symbol, onReplayExecuted }) => {
  const [cutoffDate, setCutoffDate] = useState("2026-10-12T14:30");
  const [horizon, setHorizon] = useState("60m");
  const [modelType, setModelType] = useState("ENSEMBLE");
  const [loading, setLoading] = useState(false);
  const [lastReplay, setLastReplay] = useState<ReplayResult | null>(null);

  const setPreset = (preset: "15m" | "1h" | "open" | "yesterday" | "5d" | "1mo") => {
    const now = new Date();
    let target = new Date();

    if (preset === "15m") {
      target = new Date(now.getTime() - 15 * 60 * 1000);
    } else if (preset === "1h") {
      target = new Date(now.getTime() - 60 * 60 * 1000);
    } else if (preset === "open") {
      // 09:15 AM today
      target.setHours(9, 15, 0, 0);
    } else if (preset === "yesterday") {
      target.setDate(target.getDate() - 1);
      target.setHours(15, 30, 0, 0);
    } else if (preset === "5d") {
      target.setDate(target.getDate() - 5);
      target.setHours(14, 30, 0, 0);
    } else if (preset === "1mo") {
      target.setMonth(target.getMonth() - 1);
      target.setHours(14, 30, 0, 0);
    }

    // Format YYYY-MM-DDTHH:mm
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, "0");
    const day = String(target.getDate()).padStart(2, "0");
    const hours = String(target.getHours()).padStart(2, "0");
    const minutes = String(target.getMinutes()).padStart(2, "0");
    setCutoffDate(`${year}-${month}-${day}T${hours}:${minutes}`);
  };

  const handleRunReplay = async () => {
    setLoading(true);
    try {
      const utcIso = new Date(cutoffDate).toISOString();
      const res = await executeHistoricalReplay(symbol, utcIso, horizon, modelType);
      setLastReplay(res);
      onReplayExecuted(res);
    } catch (err) {
      console.error("Replay error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <History size={16} color="var(--accent-primary)" />
          <span>Point-in-Time Historical Replay Lab</span>
        </div>
        <span className="pill-badge pill-neutral">ZERO LOOK-AHEAD VERIFIED</span>
      </div>

      {/* Quick Timeline Jump Presets */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
          <FastForward size={12} color="var(--accent-primary)" />
          <span>Quick Timeline Jump & Walk-Forward Testing Presets</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
          <button
            className="btn btn-sm btn-primary"
            style={{ fontSize: "11px", background: "linear-gradient(135deg, #6366f1, #10b981)", border: "none" }}
            onClick={() => {
              setCutoffDate("2026-10-19T09:15");
              setHorizon("1d");
              setTimeout(() => {
                handleRunReplay();
              }, 50);
            }}
            title="Backtest model at Oct 19 market open to predict today's price action"
          >
            ⚡ Test Oct 19 → Today Flow
          </button>
          <button className="indicator-chip" onClick={() => setPreset("15m")}>15m Ago</button>
          <button className="indicator-chip" onClick={() => setPreset("1h")}>1 Hour Ago</button>
          <button className="indicator-chip" onClick={() => setPreset("open")}>Today's Open (09:15)</button>
          <button className="indicator-chip" onClick={() => setPreset("yesterday")}>Yesterday (Oct 19 Close)</button>
          <button className="indicator-chip" onClick={() => setPreset("5d")}>5 Days Ago</button>
          <button className="indicator-chip" onClick={() => setPreset("1mo")}>1 Month Ago</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto", gap: "12px", alignItems: "end", marginBottom: "14px" }}>
        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>
            Historical Cutoff (Point-in-Time)
          </label>
          <input
            type="datetime-local"
            className="select-control"
            style={{ width: "100%" }}
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>
            Evaluation Horizon
          </label>
          <select className="select-control" style={{ width: "100%" }} value={horizon} onChange={(e) => setHorizon(e.target.value)}>
            <option value="5m">Next 5 Minutes (5m)</option>
            <option value="15m">Next 15 Minutes (15m)</option>
            <option value="30m">Next 30 Minutes (30m)</option>
            <option value="60m">Next 60 Minutes (1h)</option>
            <option value="1d">Next Trading Day (1D)</option>
            <option value="5d">Next 5 Trading Days (5D)</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>
            Prediction Model
          </label>
          <select className="select-control" style={{ width: "100%" }} value={modelType} onChange={(e) => setModelType(e.target.value)}>
            <option value="ENSEMBLE">Calibrated Ensemble</option>
            <option value="STATISTICAL">Statistical TA (EMA+RSI+MACD)</option>
            <option value="ML_BASELINE">Random Forest Classifier</option>
            <option value="GEMINI_FLASH">Gemini Flash Reasoner</option>
          </select>
        </div>

        <button className="btn btn-primary" onClick={handleRunReplay} disabled={loading} style={{ height: "36px" }}>
          <Play size={14} /> {loading ? "Replaying..." : "Replay Cutoff"}
        </button>
      </div>

      {/* Outcome Banner */}
      {lastReplay && (
        <div
          style={{
            background: "rgba(10, 14, 22, 0.8)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "14px",
          }}
          className="animate-fade-in"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700 }}>
              Replay Result for {lastReplay.symbol} @ Cutoff Price: ₹{lastReplay.as_of_price.toFixed(2)}
            </div>
            {lastReplay.is_correct === true && (
              <span className="pill-badge pill-bullish">
                <CheckCircle2 size={12} /> FORECAST CORRECT
              </span>
            )}
            {lastReplay.is_correct === false && (
              <span className="pill-badge pill-bearish">
                <XCircle size={12} /> FORECAST INCORRECT
              </span>
            )}
            {lastReplay.is_correct === null && (
              <span className="pill-badge pill-neutral">
                <Clock size={12} /> {lastReplay.evaluation_status}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", fontSize: "12px", fontFamily: "var(--font-mono)" }}>
            <div>
              <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>PREDICTED DIRECTION</div>
              <div style={{ fontWeight: 700, textTransform: "uppercase", color: "var(--accent-primary)" }}>
                {lastReplay.forecast?.direction || "UNCERTAIN"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>REALIZED DIRECTION</div>
              <div style={{ fontWeight: 700, textTransform: "uppercase" }}>
                {lastReplay.realized_direction || "PENDING"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>REALIZED RETURN</div>
              <div
                style={{
                  fontWeight: 700,
                  color: (lastReplay.realized_return_pct || 0) >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                }}
              >
                {lastReplay.realized_return_pct != null ? `${lastReplay.realized_return_pct > 0 ? "+" : ""}${lastReplay.realized_return_pct.toFixed(2)}%` : "N/A"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>REALIZED PRICE</div>
              <div style={{ fontWeight: 700 }}>
                {lastReplay.realized_price ? `₹${lastReplay.realized_price.toFixed(2)}` : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
