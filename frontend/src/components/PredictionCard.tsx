import React from "react";
import { ForecastResponse } from "../types";
import { Brain, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";

interface Props {
  forecast: ForecastResponse | null;
}

export const PredictionCard: React.FC<Props> = ({ forecast }) => {
  if (!forecast) {
    return (
      <div className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <Brain size={16} color="var(--accent-primary)" />
            <span>AI Market Intelligence & Explanation</span>
          </div>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
          Select a symbol or run a historical cutoff to generate an AI forecast.
        </div>
      </div>
    );
  }

  const pUp = Math.round(forecast.probabilities.up * 100);
  const pDown = Math.round(forecast.probabilities.down * 100);
  const pSide = Math.round(forecast.probabilities.sideways * 100);

  return (
    <div className="glass-card animate-fade-in">
      <div className="card-header">
        <div className="card-title">
          <Brain size={16} color="var(--accent-primary)" />
          <span>AI Forecast: {forecast.instrument_symbol}</span>
        </div>
        <span
          className={`pill-badge ${
            forecast.direction === "up"
              ? "pill-bullish"
              : forecast.direction === "down"
              ? "pill-bearish"
              : "pill-neutral"
          }`}
        >
          {forecast.direction === "up" && <ArrowUpRight size={14} />}
          {forecast.direction === "down" && <ArrowDownRight size={14} />}
          {forecast.direction === "sideways" && <Minus size={14} />}
          {forecast.direction.toUpperCase()} ({forecast.horizon})
        </span>
      </div>

      {/* Probabilities Bars */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>
          <span style={{ color: "var(--bullish-green)" }}>UP: {pUp}%</span>
          <span style={{ color: "var(--neutral-blue)" }}>SIDEWAYS: {pSide}%</span>
          <span style={{ color: "var(--bearish-red)" }}>DOWN: {pDown}%</span>
        </div>
        <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", background: "rgba(255, 255, 255, 0.05)" }}>
          <div style={{ width: `${pUp}%`, background: "var(--bullish-green)", transition: "width 0.3s" }}></div>
          <div style={{ width: `${pSide}%`, background: "var(--neutral-blue)", transition: "width 0.3s" }}></div>
          <div style={{ width: `${pDown}%`, background: "var(--bearish-red)", transition: "width 0.3s" }}></div>
        </div>
      </div>

      {/* Targets & Range */}
      <div className="stats-grid" style={{ marginBottom: "14px" }}>
        <div className="stat-box">
          <div className="stat-label">Expected Return</div>
          <div
            className="stat-value"
            style={{
              color: (forecast.expected_return_pct || 0) >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
            }}
          >
            {forecast.expected_return_pct != null ? `${forecast.expected_return_pct > 0 ? "+" : ""}${forecast.expected_return_pct}%` : "0.0%"}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Predicted Range</div>
          <div className="stat-value" style={{ fontSize: "13px" }}>
            {forecast.predicted_range_lower && forecast.predicted_range_upper
              ? `${forecast.predicted_range_lower.toFixed(1)} - ${forecast.predicted_range_upper.toFixed(1)}`
              : "N/A"}
          </div>
        </div>
      </div>

      {/* Supporting Factors */}
      {forecast.supporting_factors.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--bullish-green)", textTransform: "uppercase", marginBottom: "4px" }}>
            Supporting Factors
          </div>
          <ul style={{ listStyle: "none", fontSize: "12px", color: "var(--text-main)", display: "flex", flexDirection: "column", gap: "4px" }}>
            {forecast.supporting_factors.map((f, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <CheckCircle size={13} color="var(--bullish-green)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conflicting / Risk Factors */}
      {forecast.risk_factors.length > 0 && (
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--warning-amber)", textTransform: "uppercase", marginBottom: "4px" }}>
            Risk Factors & Caveats
          </div>
          <ul style={{ listStyle: "none", fontSize: "12px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "4px" }}>
            {forecast.risk_factors.map((r, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <AlertTriangle size={13} color="var(--warning-amber)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "14px", paddingTop: "8px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
        <span>MODEL: {forecast.model_name}</span>
        <span>QUALITY: {forecast.data_quality.toUpperCase()}</span>
      </div>
    </div>
  );
};
