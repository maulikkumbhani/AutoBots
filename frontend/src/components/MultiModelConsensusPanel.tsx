import React, { useState, useEffect } from "react";
import { MultiModelAnalysisResponse, DetectedCandlestickPattern } from "../types";
import { fetchMultiModelAnalysis, trainCustomModel, executePaperOrder } from "../api";
import {
  Layers,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sliders,
  Zap,
  Shield,
  Target,
  Cpu,
  BarChart2,
  Clock,
  Gauge,
  Activity,
} from "lucide-react";

interface Props {
  symbol: string;
  horizon?: string;
  onRefresh?: () => void;
}

export const MultiModelConsensusPanel: React.FC<Props> = ({
  symbol,
  horizon = "10m",
  onRefresh,
}) => {
  const [data, setData] = useState<MultiModelAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<any>(null);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // 1-second interval for real-time countdown to target hit
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchMultiModelAnalysis(symbol, horizon);
      setData(res);
    } catch (err) {
      console.error("Failed to load multi-model analysis:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [symbol, horizon]);

  const handleTrainCustomModel = async () => {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await trainCustomModel(symbol, 30);
      setTrainResult(res);
      await loadData();
    } catch (err: any) {
      console.error("Training error:", err);
    } finally {
      setTraining(false);
    }
  };

  const handleExecuteConsensusTrade = async () => {
    if (!data?.consensus) return;
    setTradeMessage(null);
    try {
      const isShort = data.consensus.direction === "BEARISH";
      const side = isShort ? "SELL" : "BUY";
      const qty = symbol.includes("/") ? 1000 : symbol === "GOLD" ? 1 : 25;

      await executePaperOrder({
        symbol,
        side,
        order_type: "MARKET",
        quantity: qty,
        take_profit: data.consensus.consensus_target,
        stop_loss: data.consensus.consensus_stop_loss,
      });

      setTradeMessage(`✔ Consensus ${isShort ? "SHORT" : "LONG"} order placed @ ${data.as_of_price} (Target: ${data.consensus.consensus_target}, SL: ${data.consensus.consensus_stop_loss})`);
      setTimeout(() => setTradeMessage(null), 5000);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      setTradeMessage(`✖ Order failed: ${e.message}`);
    }
  };

  if (!data) {
    return (
      <div className="glass-card" style={{ padding: "30px", textAlign: "center", color: "var(--text-dim)", marginBottom: "16px" }}>
        <RefreshCw size={24} className={loading ? "animate-spin" : ""} style={{ margin: "0 auto 10px auto", color: "var(--accent-primary)" }} />
        <div>{loading ? "Running Multi-Model Quant Consensus & Candlestick Analysis..." : "Loading quantitative models & consensus..."}</div>
      </div>
    );
  }

  const consensus = data.consensus;
  const isBullish = consensus?.direction === "BULLISH";
  const isBearish = consensus?.direction === "BEARISH";
  const isDivergence = consensus?.direction === "NEUTRAL_DIVERGENCE";

  const formatIST = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const formatCountdown = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      const diffSec = Math.max(0, Math.floor((d.getTime() - currentTime.getTime()) / 1000));
      if (diffSec <= 0) return "ETA REACHED";
      const m = Math.floor(diffSec / 60);
      const s = diffSec % 60;
      return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
    } catch {
      return "";
    }
  };

  const isForex = symbol.includes("/");
  const precision = isForex ? 4 : 2;
  const currencySign = symbol.includes("NIFTY") || symbol.includes("BANK") ? "₹" : isForex ? "$" : "$";

  return (
    <div className="glass-card animate-fade-in" style={{ marginBottom: "16px" }}>
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Layers size={16} color="var(--accent-primary)" />
          <span>Multi-Model Quant Consensus & Candlestick Shape Recognition</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="pill-badge pill-neutral" style={{ fontSize: "11px" }}>
            HORIZON: <strong>{horizon}</strong>
          </span>
          <button className="btn btn-outline btn-sm" onClick={loadData} disabled={loading} title="Refresh Models">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Run Analysis
          </button>
        </div>
      </div>

      {/* Hero Consensus Ribbon */}
      {consensus && (
        <div
          style={{
            background: isBullish
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(10, 14, 22, 0.8) 100%)"
              : isBearish
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(10, 14, 22, 0.8) 100%)"
              : "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(10, 14, 22, 0.8) 100%)",
            border: `1px solid ${
              isBullish ? "rgba(16, 185, 129, 0.4)" : isBearish ? "rgba(239, 68, 68, 0.4)" : "rgba(99, 102, 241, 0.4)"
            }`,
            borderRadius: "8px",
            padding: "14px 16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                className={`pill-badge ${isBullish ? "pill-bullish" : isBearish ? "pill-bearish" : "pill-neutral"}`}
                style={{ fontSize: "13px", padding: "4px 10px", fontWeight: 800 }}
              >
                {isBullish && <ArrowUpRight size={16} />}
                {isBearish && <ArrowDownRight size={16} />}
                {isDivergence && <Minus size={16} />}
                CONSENSUS: {consensus.direction} ({consensus.agreement_pct}% AGREEMENT)
              </span>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>
                {consensus.bullish_votes} Bullish • {consensus.bearish_votes} Bearish • {consensus.neutral_votes} Neutral
              </span>
            </div>

            {/* 1-Click Consensus Paper Order Execution */}
            <button
              className={`btn btn-sm ${isBearish ? "btn-danger" : "btn-success"}`}
              onClick={handleExecuteConsensusTrade}
              style={{ padding: "6px 14px", fontWeight: 700 }}
            >
              <Zap size={13} /> Execute Consensus {isBearish ? "SHORT" : "LONG"} Order
            </button>
          </div>

          {/* Target & Stop Loss Summary with Exact Second Target Hit Timeline */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
            <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "8px", borderRadius: "4px" }}>
              <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>Current Asset Price</div>
              <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "13px" }}>
                {currencySign}{(data?.as_of_price ?? 0).toFixed(precision)}
              </div>
            </div>
            <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "8px", borderRadius: "4px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ color: "var(--bullish-green)", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                <Target size={11} /> Consensus Target Price
              </div>
              <div style={{ fontWeight: 700, color: "var(--bullish-green)", fontSize: "13px" }}>
                {currencySign}{(consensus.consensus_target ?? 0).toFixed(precision)}
              </div>
            </div>
            <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: "8px", borderRadius: "4px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
              <div style={{ color: "var(--bearish-red)", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px" }}>
                <Shield size={11} /> Consensus Stop-Loss
              </div>
              <div style={{ fontWeight: 700, color: "var(--bearish-red)", fontSize: "13px" }}>
                {currencySign}{(consensus.consensus_stop_loss ?? 0).toFixed(precision)}
              </div>
            </div>
            <div style={{ background: "rgba(99, 102, 241, 0.12)", padding: "8px", borderRadius: "4px", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
              <div style={{ color: "var(--accent-primary)", fontSize: "10px", display: "flex", alignItems: "center", gap: "4px", fontWeight: 700 }}>
                <Clock size={11} /> Target Hit ETA (IST)
              </div>
              <div style={{ fontWeight: 800, color: "var(--accent-primary)", fontSize: "13px" }}>
                {formatIST(consensus.consensus_target_hit_time)} IST
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--bullish-green)", fontWeight: 600 }}>{formatCountdown(consensus.consensus_target_hit_time)}</span>
                <span>{consensus.consensus_velocity_pts_per_sec ? `${(consensus.consensus_velocity_pts_per_sec ?? 0).toFixed(4)} pts/s` : ""}</span>
              </div>
            </div>
          </div>

          {tradeMessage && (
            <div
              style={{
                marginTop: "8px",
                padding: "6px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                background: tradeMessage.startsWith("✔") ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                color: tradeMessage.startsWith("✔") ? "var(--bullish-green)" : "var(--bearish-red)",
              }}
            >
              {tradeMessage}
            </div>
          )}
        </div>
      )}

      {/* Candlestick Pattern & Shape Recognition Section */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          <BarChart2 size={13} color="var(--accent-primary)" />
          <span>Active Candlestick Feature Shapes Detected on Chart</span>
        </div>

        {data?.detected_patterns && data.detected_patterns.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
            {data.detected_patterns.map((pat, idx) => {
              const isBull = pat.direction === "BULLISH";
              const isBear = pat.direction === "BEARISH";
              return (
                <div
                  key={idx}
                  style={{
                    background: "rgba(10, 14, 22, 0.6)",
                    border: `1px solid ${isBull ? "rgba(16, 185, 129, 0.3)" : isBear ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
                    borderRadius: "6px",
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, fontSize: "12px", color: isBull ? "var(--bullish-green)" : isBear ? "var(--bearish-red)" : "var(--neutral-blue)" }}>
                      {pat.name}
                    </span>
                    <span className={`pill-badge ${isBull ? "pill-bullish" : isBear ? "pill-bearish" : "pill-neutral"}`} style={{ fontSize: "9px", padding: "1px 5px" }}>
                      {pat.direction} ({Math.round(pat.confidence * 100)}%)
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {pat.description}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "10px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "6px", fontSize: "11px", color: "var(--text-dim)" }}>
            Standard range consolidation: No high-conviction 2-bar or 3-bar reversal patterns detected on latest candle.
          </div>
        )}
      </div>

      {/* Individual Model Voting Grid */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Cpu size={13} color="var(--accent-primary)" />
          <span>Parallel Model Output & Strategy Comparison</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
          {data?.models.map((m) => {
            const isUp = m.direction === "up";
            const isDown = m.direction === "down";
            return (
              <div
                key={m.model_key}
                style={{
                  background: "rgba(10, 14, 22, 0.6)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)" }}>
                      {m.model_name}
                    </div>
                    <span className={`pill-badge ${isUp ? "pill-bullish" : isDown ? "pill-bearish" : "pill-neutral"}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                      {isUp && <ArrowUpRight size={12} />}
                      {isDown && <ArrowDownRight size={12} />}
                      {m.direction.toUpperCase()} ({m.confidence_pct}%)
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "var(--font-mono)", marginBottom: "6px" }}>
                    <span style={{ color: "var(--text-dim)" }}>Target: <strong style={{ color: "var(--bullish-green)" }}>{currencySign}{m.target_price?.toFixed(precision)}</strong></span>
                    <span style={{ color: "var(--text-dim)" }}>SL: <strong style={{ color: "var(--bearish-red)" }}>{currencySign}{m.stop_loss?.toFixed(precision)}</strong></span>
                  </div>

                  {m.estimated_target_hit_time && (
                    <div style={{ fontSize: "10px", color: "var(--accent-primary)", background: "rgba(99, 102, 241, 0.08)", padding: "3px 6px", borderRadius: "4px", marginBottom: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--font-mono)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <Clock size={10} /> ETA: {formatIST(m.estimated_target_hit_time)} IST
                      </span>
                      <span style={{ color: "var(--bullish-green)", fontWeight: 600 }}>
                        {formatCountdown(m.estimated_target_hit_time)}
                      </span>
                    </div>
                  )}

                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px" }}>
                    {m.supporting_factors.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle size={10} color="var(--bullish-green)" /> {f}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: "9px", color: "var(--text-dim)", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "4px", fontFamily: "var(--font-mono)" }}>
                  VER: {m.model_version}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Quantitative Model Self-Training & Rebuilding */}
      <div style={{ background: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: "6px", padding: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Sliders size={13} color="var(--accent-primary)" />
              <span>Custom Mathematical Model: Continuous Online Rebuilder</span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              Runs 100% locally without external AI APIs. Calibrates factor weights automatically via rolling walk-forward training.
            </div>
          </div>

          <button className="btn btn-outline btn-sm" onClick={handleTrainCustomModel} disabled={training}>
            <RefreshCw size={12} className={training ? "animate-spin" : ""} />
            {training ? "Calibrating Weights..." : "Rebuild & Train on Last 30 Days"}
          </button>
        </div>

        {/* Dynamic Factor Weights Bar */}
        {data?.custom_model_weights?.weights && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginBottom: "4px", textTransform: "uppercase", fontWeight: 700 }}>
              Calibrated Alpha Factor Allocations
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
              {Object.entries(data.custom_model_weights.weights).map(([k, v]) => (
                <div key={k} style={{ background: "rgba(255, 255, 255, 0.03)", padding: "4px", borderRadius: "4px" }}>
                  <div style={{ color: "var(--text-dim)", fontSize: "9px", textTransform: "uppercase" }}>{k}</div>
                  <div style={{ fontWeight: 700, color: "var(--accent-primary)" }}>{((Number(v) || 0) * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {trainResult && (
          <div style={{ marginTop: "8px", padding: "6px 10px", borderRadius: "4px", fontSize: "11px", background: "rgba(16, 185, 129, 0.15)", color: "var(--bullish-green)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
            ✔ Custom Model Rebuilt Successfully! Walk-forward accuracy: <strong>{trainResult.walk_forward_accuracy_pct}%</strong> over {trainResult.samples_trained} historical slices.
          </div>
        )}
      </div>
    </div>
  );
};
