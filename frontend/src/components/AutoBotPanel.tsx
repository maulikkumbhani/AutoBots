import React, { useState, useEffect } from "react";
import { BotStatus, MT5BridgeStatus } from "../types";
import {
  startBot,
  stopBot,
  triggerBotCycle,
  configureBot,
  fetchMT5Status,
  updateMT5Config,
  sendManualMT5Order,
  fetchMT5EACode,
} from "../api";
import {
  Play,
  Square,
  RefreshCw,
  Sliders,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Zap,
  Server,
  Wifi,
  WifiOff,
  Copy,
  Download,
  Check,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Props {
  botStatus: BotStatus | null;
  activeSymbol?: string;
  onRefresh: () => void;
}

export const AutoBotPanel: React.FC<Props> = ({ botStatus, activeSymbol = "NIFTY 50", onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState(botStatus?.strategy_type || "HIGH_VOLUME_SCALPER");
  const [executionMode, setExecutionMode] = useState<"PAPER" | "MT5_LIVE">(botStatus?.execution_mode || "PAPER");
  const [mt5AutoTrade, setMt5AutoTrade] = useState<boolean>(botStatus?.mt5_auto_trade || false);
  const [tp, setTp] = useState(botStatus?.take_profit_pct || 0.8);
  const [sl, setSl] = useState(botStatus?.stop_loss_pct || 0.4);
  const [trail, setTrail] = useState(botStatus?.trailing_stop_pct || 0.25);

  // MT5 state
  const [mt5Status, setMt5Status] = useState<MT5BridgeStatus | null>(botStatus?.mt5_status || null);
  const [mt5Server, setMt5Server] = useState<string>("MetaQuotes-Demo");
  const [mt5Account, setMt5Account] = useState<string>("");
  const [mt5Lots, setMt5Lots] = useState<number>(0.1);
  const [showEaModal, setShowEaModal] = useState(false);
  const [eaCode, setEaCode] = useState<string>("");
  const [copiedEa, setCopiedEa] = useState(false);
  const [testOrderSuccess, setTestOrderSuccess] = useState<string | null>(null);
  const [showMt5Settings, setShowMt5Settings] = useState(false);

  const pollMT5 = async () => {
    try {
      const st = await fetchMT5Status();
      setMt5Status(st);
      if (st.server && !mt5Server) setMt5Server(st.server);
      if (st.account_id && !mt5Account) setMt5Account(st.account_id);
      if (st.default_lot_size) setMt5Lots(st.default_lot_size);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    pollMT5();
    const interval = setInterval(pollMT5, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleBot = async () => {
    setLoading(true);
    try {
      if (botStatus?.is_active) {
        await stopBot();
      } else {
        await startBot(activeSymbol);
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
        symbol: activeSymbol,
        strategy_type: strategy,
        execution_mode: executionMode,
        mt5_auto_trade: mt5AutoTrade,
        take_profit_pct: Number(tp),
        stop_loss_pct: Number(sl),
        trailing_stop_pct: Number(trail),
      });

      await updateMT5Config({
        enabled: mt5AutoTrade,
        server: mt5Server,
        account_id: mt5Account,
        default_lot_size: Number(mt5Lots),
      });

      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestMT5Order = async (side: "BUY" | "SELL") => {
    try {
      const res = await sendManualMT5Order({
        symbol: activeSymbol,
        side,
        lots: Number(mt5Lots) || 0.1,
        price: botStatus?.current_price || 1.0,
        strategy: "UI_TEST",
      });
      setTestOrderSuccess(`⚡ Queued ${side} ${mt5Lots} lots on MT5 for ${activeSymbol}!`);
      setTimeout(() => setTestOrderSuccess(null), 4000);
      pollMT5();
    } catch (e: any) {
      setTestOrderSuccess(`❌ Test order failed: ${e.message}`);
      setTimeout(() => setTestOrderSuccess(null), 4000);
    }
  };

  const handleOpenEaModal = async () => {
    try {
      const res = await fetchMT5EACode();
      setEaCode(res.code);
      setShowEaModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyEa = () => {
    navigator.clipboard.writeText(eaCode);
    setCopiedEa(true);
    setTimeout(() => setCopiedEa(false), 2500);
  };

  const handleDownloadEa = () => {
    const blob = new Blob([eaCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AutoBot_MT5_Bridge.mq5";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Quantitative Alpha Composite Score (0-100)
  const winRate = botStatus?.win_rate_pct || 0;
  const profitFactor = botStatus?.profit_factor || 1.0;
  const closedCount = botStatus?.closed_positions_count || 0;
  const alphaRating = Math.min(
    99,
    Math.max(
      15,
      Math.round(40 + (winRate * 0.4) + (Math.min(profitFactor, 3.5) * 12))
    )
  );
  const alphaGrade =
    alphaRating >= 85 ? "A+ ELITE ALPHA" :
    alphaRating >= 75 ? "A STRONG EDGE" :
    alphaRating >= 60 ? "B+ BALANCED" : "C CALIBRATING";

  const isConnected = mt5Status?.connected || false;

  return (
    <div className="glass-card">
      <div className="card-header">
        <div className="card-title">
          <TrendingUp size={16} color="var(--accent-primary)" />
          <span>Auto-Bot Alpha & MT5 Engine</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className="pill-badge pill-neutral"
            style={{ fontSize: "10px", padding: "2px 6px", border: "1px solid rgba(99, 102, 241, 0.3)" }}
            title="Bot is locked to active chart asset"
          >
            ACTIVE: <strong style={{ color: "var(--accent-primary)", marginLeft: "3px" }}>{activeSymbol}</strong>
          </span>
          {botStatus?.is_active ? (
            <span className="pill-badge pill-bullish">
              <span className="pulse-indicator"></span> RUNNING
            </span>
          ) : (
            <span className="pill-badge pill-bearish">STOPPED</span>
          )}
        </div>
      </div>

      {/* Execution Mode Selector: Paper vs MT5 Live */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", background: "rgba(10, 14, 22, 0.7)", padding: "4px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
        <button
          onClick={() => {
            setExecutionMode("PAPER");
            setMt5AutoTrade(false);
          }}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: "11px",
            fontWeight: 700,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
            background: executionMode === "PAPER" ? "rgba(99, 102, 241, 0.25)" : "transparent",
            color: executionMode === "PAPER" ? "#818cf8" : "var(--text-dim)",
            borderBottom: executionMode === "PAPER" ? "2px solid #818cf8" : "none",
          }}
        >
          🛡️ Paper Simulation
        </button>
        <button
          onClick={() => {
            setExecutionMode("MT5_LIVE");
            setMt5AutoTrade(true);
          }}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: "11px",
            fontWeight: 700,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
            background: executionMode === "MT5_LIVE" ? "rgba(16, 185, 129, 0.2)" : "transparent",
            color: executionMode === "MT5_LIVE" ? "#34d399" : "var(--text-dim)",
            borderBottom: executionMode === "MT5_LIVE" ? "2px solid #10b981" : "none",
          }}
        >
          ⚡ MT5 Live Execution
        </button>
      </div>

      {/* MT5 Status Strip (When MT5 Mode is Active) */}
      {executionMode === "MT5_LIVE" && (
        <div
          style={{
            background: isConnected ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
            border: `1px solid ${isConnected ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.25)"}`,
            borderRadius: "8px",
            padding: "10px",
            marginBottom: "14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
              {isConnected ? (
                <>
                  <Wifi size={14} color="#10b981" />
                  <span style={{ color: "#34d399" }}>MT5 Bridge Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={14} color="#f59e0b" />
                  <span style={{ color: "#fbbf24" }}>Awaiting MT5 Terminal EA</span>
                </>
              )}
            </div>
            <button
              onClick={handleOpenEaModal}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "4px",
                color: "#e2e8f0",
                fontSize: "10px",
                padding: "2px 8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Terminal size={11} /> MQL5 EA Setup
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px", color: "var(--text-dim)" }}>
            <div>
              Account: <strong style={{ color: "var(--text-main)" }}>{mt5Status?.account_id || "Demo Account"}</strong>
            </div>
            <div>
              Server: <strong style={{ color: "var(--text-main)" }}>{mt5Status?.server || "MetaQuotes-Demo"}</strong>
            </div>
            <div>
              Equity: <strong style={{ color: "#34d399" }}>${mt5Status?.account_info?.equity?.toLocaleString() || "10,000"}</strong>
            </div>
            <div>
              Default Lot: <strong style={{ color: "var(--text-main)" }}>{mt5Status?.default_lot_size || 0.1} Lots</strong>
            </div>
          </div>

          {/* Quick MT5 Test Execution */}
          <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
            <button
              onClick={() => handleTestMT5Order("BUY")}
              style={{
                flex: 1,
                padding: "5px 8px",
                fontSize: "11px",
                fontWeight: 700,
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#34d399",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Test MT5 BUY
            </button>
            <button
              onClick={() => handleTestMT5Order("SELL")}
              style={{
                flex: 1,
                padding: "5px 8px",
                fontSize: "11px",
                fontWeight: 700,
                background: "rgba(244, 63, 94, 0.2)",
                border: "1px solid rgba(244, 63, 94, 0.4)",
                color: "#fb7185",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Test MT5 SELL
            </button>
          </div>

          {testOrderSuccess && (
            <div style={{ marginTop: "6px", fontSize: "10px", color: "#34d399", fontWeight: 600 }}>
              {testOrderSuccess}
            </div>
          )}
        </div>
      )}

      {/* Quantitative Edge Rating Card */}
      <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "10px 12px", borderRadius: "8px", marginBottom: "14px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Bot Alpha Rating
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: alphaRating >= 75 ? "var(--bullish-green)" : (alphaRating >= 60 ? "var(--accent-primary)" : "var(--bearish-red)"),
            }}
          >
            {alphaGrade}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <div style={{ fontSize: "24px", fontWeight: 900, color: "var(--text-main)", letterSpacing: "-0.5px" }}>
            {alphaRating}
            <span style={{ fontSize: "13px", color: "var(--text-dim)", fontWeight: 500 }}>/100</span>
          </div>
          <div style={{ flex: 1, height: "6px", background: "rgba(255, 255, 255, 0.08)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${alphaRating}%`,
                height: "100%",
                background: "linear-gradient(90deg, #6366f1 0%, #10b981 100%)",
                borderRadius: "3px",
                transition: "width 0.4s ease",
              }}
            />
          </div>
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
              <Square size={14} /> Stop Bot on {activeSymbol}
            </>
          ) : (
            <>
              <Play size={14} /> Start Bot on {activeSymbol}
            </>
          )}
        </button>
        <button className="btn btn-outline" onClick={handleManualCycle} disabled={loading} title="Run Cycle Now">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Run Cycle
        </button>
      </div>

      {/* Risk Configuration Controls */}
      <div style={{ background: "rgba(10, 14, 22, 0.6)", padding: "12px", borderRadius: "8px", marginBottom: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Sliders size={13} color="var(--accent-primary)" />
            <span>Strategy & Risk Calibration</span>
          </div>
          {executionMode === "MT5_LIVE" && (
            <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 600 }}>
              MT5 Auto-Trade Active
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "3px" }}>
              Strategy Model
            </label>
            <select
              className="select-control"
              style={{ width: "100%" }}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="HIGH_VOLUME_SCALPER">⚡ High-Volume Micro Scalper (Order Flow & VWAP Breakout)</option>
              <option value="ENSEMBLE">Calibrated Multi-Model Ensemble (Recommended for Nifty / Equities)</option>
              <option value="STATISTICAL">Statistical Momentum Breakout (Recommended for Gold / Commodities)</option>
              <option value="ML_BASELINE">Random Forest Mean Reversion (Recommended for Forex MT5)</option>
            </select>
          </div>

          {executionMode === "MT5_LIVE" ? (
            <>
              <div>
                <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "3px" }}>MT5 Lot Size</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="select-control"
                  style={{ width: "100%" }}
                  value={mt5Lots}
                  onChange={(e) => setMt5Lots(Number(e.target.value))}
                />
              </div>
              <div>
                <label style={{ display: "block", color: "var(--text-dim)", marginBottom: "3px" }}>MT5 Server</label>
                <input
                  type="text"
                  className="select-control"
                  style={{ width: "100%" }}
                  value={mt5Server}
                  onChange={(e) => setMt5Server(e.target.value)}
                  placeholder="e.g. ICMarkets-Demo"
                />
              </div>
            </>
          ) : null}

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
          <div style={{ gridColumn: executionMode === "MT5_LIVE" ? "1 / -1" : "auto" }}>
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
          Apply Parameters & Mode
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

      {/* MT5 MQL5 EA Code & Setup Modal */}
      {showEaModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "760px",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #374151",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Terminal size={18} color="#10b981" />
                  MetaTrader 5 (MT5) Auto-Trading Bridge Setup
                </h3>
                <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                  Connect your live MT5 broker terminal to automatically execute Buy and Sell signals.
                </p>
              </div>
              <button
                onClick={() => setShowEaModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: "20px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px", overflowY: "auto", flex: 1, spaceY: "16px" }}>
              {/* Setup Steps */}
              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
                <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#34d399", marginBottom: "8px" }}>
                  🚀 3-Minute Quick Setup in MetaTrader 5:
                </h4>
                <ol style={{ fontSize: "12px", color: "#d1d5db", paddingLeft: "18px", lineHeight: "1.7" }}>
                  <li>
                    In MT5, go to <strong>Tools → Options → Expert Advisors</strong>.
                  </li>
                  <li>
                    Check <strong>"Allow WebRequest for listed URL"</strong> and add:
                    <code style={{ background: "#1f2937", padding: "2px 6px", borderRadius: "4px", color: "#60a5fa", marginLeft: "6px" }}>
                      http://127.0.0.1:8000
                    </code>
                  </li>
                  <li>
                    In MT5 menu, click <strong>File → Open Data Folder → MQL5 → Experts</strong>.
                  </li>
                  <li>
                    Save or paste this file as <strong>AutoBot_MT5_Bridge.mq5</strong>.
                  </li>
                  <li>
                    Open MetaEditor (<kbd>F4</kbd>), click <strong>Compile</strong> (<kbd>F7</kbd>), then drag the EA onto any chart and toggle <strong>Algo Trading: ON</strong>!
                  </li>
                </ol>
              </div>

              {/* Code viewer & actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#9ca3af" }}>
                  MQL5 Source Code (AutoBot_MT5_Bridge.mq5):
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleCopyEa}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: copiedEa ? "#059669" : "#374151",
                      border: "none",
                      color: "#fff",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    {copiedEa ? <Check size={14} /> : <Copy size={14} />}
                    {copiedEa ? "Copied!" : "Copy Code"}
                  </button>
                  <button
                    onClick={handleDownloadEa}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: "#10b981",
                      border: "none",
                      color: "#000",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <Download size={14} /> Download .mq5
                  </button>
                </div>
              </div>

              <pre
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: "8px",
                  padding: "14px",
                  fontSize: "11px",
                  color: "#c9d1d9",
                  fontFamily: "monospace",
                  maxHeight: "260px",
                  overflowY: "auto",
                }}
              >
                {eaCode}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
