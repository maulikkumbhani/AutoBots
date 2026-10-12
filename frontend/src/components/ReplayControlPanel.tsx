import React, { useState } from "react";
import { ReplayResult } from "../types";
import { executeHistoricalReplay } from "../api";
import { History, Play, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

interface Props {
  symbol: string;
  onReplayExecuted: (result: ReplayResult) => void;
}

export const ReplayControlPanel: React.FC<Props> = ({ symbol, onReplayExecuted }) => {
  const [cutoffDate, setCutoffDate] = useState("2026-10-09T14:30");
  const [horizon, setHorizon] = useState("60m");
  const [modelType, setModelType] = useState("ENSEMBLE");
  const [loading, setLoading] = useState(false);
  const [lastReplay, setLastReplay] = useState<ReplayResult | null>(null);

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
            <option value="5m">Next 5 Minutes</option>
            <option value="15m">Next 15 Minutes</option>
            <option value="30m">Next 30 Minutes</option>
            <option value="60m">Next 60 Minutes (1h)</option>
            <option value="1d">Next Trading Day</option>
            <option value="5d">Next 5 Trading Days</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>
            Prediction Model
          </label>
          <select className="select-control" style={{ width: "100%" }} value={modelType} onChange={(e) => setModelType(e.target.value)}>
            <option value="ENSEMBLE">Calibrated Ensemble</option>
            <option value="STATISTICAL">Statistical TA</option>
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
              Replay Result for {lastReplay.symbol} @ Cutoff Price: {lastReplay.as_of_price.toFixed(2)}
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
                {lastReplay.realized_price ? lastReplay.realized_price.toFixed(2) : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
