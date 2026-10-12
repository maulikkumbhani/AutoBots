import React, { useState } from "react";
import { BotStatus } from "../types";
import { startBot, stopBot, triggerBotCycle, configureBot } from "../api";
import { Play, Square, RefreshCw, Sliders, ShieldCheck, TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  botStatus: BotStatus | null;
  onRefresh: () => void;
}

export const AutoBotPanel: React.FC<Props> = ({ botStatus, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState(botStatus?.strategy_type || "ENSEMBLE");
  const [tp, setTp] = useState(botStatus?.take_profit_pct || 1.0);
  const [sl, setSl] = useState(botStatus?.stop_loss_pct || 0.5);
  const [trail, setTrail] = useState(botStatus?.trailing_stop_pct || 0.35);

  const handleToggleBot = async () => {
    setLoading(true);
    try {
      if (botStatus?.is_active) {
        await stopBot();
      } else {
        await startBot();
      }
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCycle = async () => {
    setLoading(true);
    try {
      await triggerBotCycle();
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await configureBot({
        strategy_type: strategy,
        take_profit_pct: Number(tp),
        stop_loss_pct: Number(sl),
        trailing_stop_pct: Number(trail),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <TrendingUp size={16} color="var(--accent-primary)" />
          <span>Auto-Bot Alpha Trading Engine</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {botStatus?.is_active ? (
            <span className="pill-badge pill-bullish">
              <span className="pulse-indicator"></span> BOT ACTIVE
            </span>
          ) : (
            <span className="pill-badge pill-neutral">STANDBY</span>
          )}
        </div>
      </div>

      {/* Bot Performance Metrics */}
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-label">Win Rate</div>
          <div className="stat-value" style={{ color: "var(--bullish-green)" }}>
            {botStatus ? `${botStatus.win_rate_pct}%` : "0.0%"}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Profit Factor</div>
          <div className="stat-value" style={{ color: "var(--neutral-blue)" }}>
            {botStatus?.profit_factor || "1.0"}x
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Open Positions</div>
          <div className="stat-value">{botStatus?.open_positions_count || 0}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Closed Trades</div>
          <div className="stat-value">{botStatus?.closed_positions_count || 0}</div>
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <button
          className={`btn ${botStatus?.is_active ? "btn-danger" : "btn-success"}`}
          onClick={handleToggleBot}
          disabled={loading}
          style={{ flex: 1 }}
        >
          {botStatus?.is_active ? (
            <>
              <Square size={14} /> Stop Auto-Bot
            </>
          ) : (
            <>
              <Play size={14} /> Start Auto-Bot
            </>
          )}
        </button>
        <button className="btn btn-outline" onClick={handleManualCycle} disabled={loading} title="Run Cycle Now">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Run Cycle
        </button>
      </div>

      {/* Risk Configuration Controls */}
      <div style={{ background: "rgba(10, 14, 22, 0.6)", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Sliders size={13} color="var(--accent-primary)" />
          <span>Strategy & Risk Target Tuning</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
          <div>
            <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "3px" }}>Strategy Model</label>
            <select
              className="select-control"
              style={{ width: "100%" }}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="ENSEMBLE">Calibrated Ensemble</option>
              <option value="STATISTICAL">Statistical TA (EMA+RSI+MACD)</option>
              <option value="ML_BASELINE">Random Forest Classifier</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "3px" }}>Take-Profit Target %</label>
            <input
              type="number"
              step="0.1"
              className="select-control"
              style={{ width: "100%" }}
              value={tp}
              onChange={(e) => setTp(Number(e.target.value))}
            />
          </div>
          <div>
            <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "3px" }}>Stop-Loss Risk %</label>
            <input
              type="number"
              step="0.1"
              className="select-control"
              style={{ width: "100%" }}
              value={sl}
              onChange={(e) => setSl(Number(e.target.value))}
            />
          </div>
          <div>
            <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "3px" }}>Trailing Stop %</label>
            <input
              type="number"
              step="0.05"
              className="select-control"
              style={{ width: "100%" }}
              value={trail}
              onChange={(e) => setTrail(Number(e.target.value))}
            />
          </div>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleSaveConfig}
          disabled={loading}
          style={{ marginTop: "10px", width: "100%" }}
        >
          Apply Parameters
        </button>
      </div>

      {/* Live Activity Stream */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>
          Live Execution Blotter
        </div>
        <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
          {botStatus?.recent_logs && botStatus.recent_logs.length > 0 ? (
            botStatus.recent_logs.slice().reverse().map((log, i) => (
              <div
                key={i}
                style={{
                  fontSize: "11px",
                  padding: "6px 8px",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "4px",
                  borderLeft: `3px solid ${
                    log.action === "BOUGHT"
                      ? "var(--bullish-green)"
                      : log.action === "SOLD"
                      ? "var(--bearish-red)"
                      : "var(--accent-primary)"
                  }`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)", fontSize: "10px" }}>
                  <span>{log.time}</span>
                  <span style={{ fontWeight: 700, color: log.action === "BOUGHT" ? "var(--bullish-green)" : (log.action === "SOLD" ? "var(--bearish-red)" : "inherit") }}>
                    {log.action}
                  </span>
                </div>
                <div style={{ marginTop: "2px", color: "var(--text-main)" }}>{log.detail}</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-dim)", textAlign: "center", padding: "12px" }}>
              No bot execution cycles recorded yet. Click "Start Auto-Bot" to begin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
