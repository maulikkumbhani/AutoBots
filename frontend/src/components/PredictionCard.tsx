import React, { useState, useEffect } from "react";
import { ForecastResponse } from "../types";
import { Brain, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, CheckCircle, Zap, Shield, Target, Clock, Activity, Gauge } from "lucide-react";

interface Props {
  forecast: ForecastResponse | null;
  selectedHorizon?: string;
  onSelectHorizon?: (horizon: string) => void;
  onExecuteTrade?: (direction: "LONG" | "SHORT", targetPrice: number, stopLoss: number) => Promise<void>;
}

export const PredictionCard: React.FC<Props> = ({
  forecast,
  selectedHorizon = "10m",
  onSelectHorizon,
  onExecuteTrade,
}) => {
  const [executing, setExecuting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // 1-second interval for real-time countdown to target hit
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!forecast) {
    return (
      <div className="glass-card">
        <div className="card-header">
          <div className="card-title">
            <Brain size={16} color="var(--accent-primary)" />
            <span>AI Predictive Horizon Engine</span>
          </div>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
          Select a symbol or horizon to generate an AI forecast.
        </div>
      </div>
    );
  }

  const pUp = Math.round(forecast.probabilities.up * 100);
  const pDown = Math.round(forecast.probabilities.down * 100);
  const pSide = Math.round(forecast.probabilities.sideways * 100);
  const isForex = forecast.instrument_symbol.includes("/");
  const precision = isForex ? 4 : 2;

  const handleTakeTrade = async () => {
    if (!onExecuteTrade || !forecast.target_price || !forecast.stop_loss) return;
    setExecuting(true);
    setStatusMessage(null);
    try {
      const side = forecast.direction === "down" ? "SHORT" : "LONG";
      await onExecuteTrade(side, forecast.target_price, forecast.stop_loss);
      setStatusMessage(`✔ Paper ${side} order placed at ${forecast.as_of_price.toFixed(precision)} with Target: ${forecast.target_price.toFixed(precision)} & SL: ${forecast.stop_loss.toFixed(precision)}`);
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setStatusMessage(`✖ Order failed: ${err.message || "Unknown error"}`);
    } finally {
      setExecuting(false);
    }
  };

  // Precise Indian Standard Time (IST) target hit timeline calculation
  let formattedEtaTime = "—";
  let countdownDisplay = "MONITORING";
  let remainingSeconds = 0;

  try {
    const rawHit = forecast.estimated_target_hit_time;
    let hitDate: Date;
    if (rawHit) {
      hitDate = new Date(rawHit);
    } else {
      const baseMs = new Date(forecast.created_at || forecast.cutoff_timestamp || Date.now()).getTime();
      const horizonMins = parseInt(forecast.horizon) || 10;
      hitDate = new Date(baseMs + horizonMins * 60000);
    }

    if (!isNaN(hitDate.getTime())) {
      formattedEtaTime = hitDate.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      remainingSeconds = Math.max(0, Math.floor((hitDate.getTime() - currentTime.getTime()) / 1000));
      const remainingMins = Math.floor(remainingSeconds / 60);
      const remainingSecs = remainingSeconds % 60;
      countdownDisplay = remainingSeconds > 0
        ? `${remainingMins.toString().padStart(2, "0")}m ${remainingSecs.toString().padStart(2, "0")}s remaining`
        : "TARGET ETA WINDOW REACHED";
    }
  } catch (err) {
    formattedEtaTime = "—";
    countdownDisplay = "MONITORING";
  }

  const velocityPtsPerSec = Number(forecast.price_velocity_pts_per_sec || 0.15);

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

      {/* Horizon Selector (5m, 10m, 15m, 60m) */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase" }}>
            Prediction Horizon
          </span>
          <span style={{ fontSize: "11px", color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>
            Current: {forecast.horizon}
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {["5m", "10m", "15m", "60m"].map((h) => (
            <button
              key={h}
              className={`timeline-btn ${selectedHorizon === h ? "active" : ""}`}
              style={{ flex: 1, padding: "4px 8px", fontSize: "11px" }}
              onClick={() => onSelectHorizon && onSelectHorizon(h)}
            >
              {h}
            </button>
          ))}
        </div>
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

      {/* Projected Target & Stop-Loss Trade Indicator Box */}
      <div style={{ background: "rgba(10, 14, 22, 0.7)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.05)", marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-dim)", marginBottom: "6px", fontWeight: 700 }}>
          <span>PROJECTED TRADE INDICATOR</span>
          <span style={{ color: "var(--neutral-blue)" }}>R:R = 2.0:1</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", textAlign: "center", fontFamily: "var(--font-mono)" }}>
          <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "6px", borderRadius: "4px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Signal Entry</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)" }}>
              {(forecast.as_of_price ?? 0).toFixed(precision)}
            </div>
          </div>
          <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "6px", borderRadius: "4px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
            <div style={{ fontSize: "10px", color: "var(--bullish-green)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
              <Target size={10} /> Target ({forecast.horizon})
            </div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--bullish-green)" }}>
              {forecast.target_price ? forecast.target_price.toFixed(precision) : "—"}
            </div>
          </div>
          <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: "6px", borderRadius: "4px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <div style={{ fontSize: "10px", color: "var(--bearish-red)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
              <Shield size={10} /> Stop-Loss
            </div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--bearish-red)" }}>
              {forecast.stop_loss ? forecast.stop_loss.toFixed(precision) : "—"}
            </div>
          </div>
        </div>

        {/* 1-Click Action to Execute Future Trade */}
        {onExecuteTrade && (
          <button
            className={`btn ${forecast.direction === "down" ? "btn-danger" : "btn-success"}`}
            style={{ width: "100%", marginTop: "10px", fontSize: "12px", padding: "8px" }}
            onClick={handleTakeTrade}
            disabled={executing}
          >
            <Zap size={14} className={executing ? "animate-spin" : ""} />
            <span>
              {executing
                ? "Placing Paper Order..."
                : `Execute Paper ${forecast.direction === "down" ? "SHORT" : "LONG"} (${forecast.horizon} Signal)`}
            </span>
          </button>
        )}

        {statusMessage && (
          <div
            style={{
              marginTop: "8px",
              padding: "6px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              background: statusMessage.startsWith("✔") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: statusMessage.startsWith("✔") ? "var(--bullish-green)" : "var(--bearish-red)",
              border: `1px solid ${statusMessage.startsWith("✔") ? "var(--bullish-green)" : "var(--bearish-red)"}`,
            }}
          >
            {statusMessage}
          </div>
        )}
      </div>

      {/* High-Precision Target Hit Timeline & Price Speed Corridor */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          borderRadius: "6px",
          padding: "10px 12px",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--bullish-green)", display: "flex", alignItems: "center", gap: "5px" }}>
            <Clock size={12} color="var(--bullish-green)" />
            <span>ESTIMATED TARGET HIT TIMELINE</span>
          </div>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: remainingSeconds > 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
              color: remainingSeconds > 0 ? "var(--bullish-green)" : "var(--warning-amber)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
            }}
          >
            {remainingSeconds > 0 ? "PACING TO TARGET" : "WINDOW REACHED"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "6px 8px", borderRadius: "4px" }}>
            <div style={{ color: "var(--text-dim)", fontSize: "9px" }}>EXACT SECOND TARGET ETA (IST)</div>
            <div style={{ fontWeight: 800, color: "var(--bullish-green)", fontSize: "13px", marginTop: "2px" }}>
              {formattedEtaTime} IST
            </div>
          </div>
          <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "6px 8px", borderRadius: "4px" }}>
            <div style={{ color: "var(--text-dim)", fontSize: "9px" }}>LIVE COUNTDOWN REMAINING</div>
            <div
              style={{
                fontWeight: 800,
                color: remainingSeconds > 0 ? "var(--accent-primary)" : "var(--warning-amber)",
                fontSize: "13px",
                marginTop: "2px",
              }}
            >
              {countdownDisplay}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "6px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Gauge size={11} color="var(--neutral-blue)" /> Price Speed: <strong style={{ color: "var(--text-main)" }}>{(velocityPtsPerSec ?? 0).toFixed(4)} pts/sec</strong>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Activity size={11} color="var(--accent-primary)" /> Volatility Adjusted ATR
          </span>
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
              ? `${forecast.predicted_range_lower.toFixed(precision)} - ${forecast.predicted_range_upper.toFixed(precision)}`
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
