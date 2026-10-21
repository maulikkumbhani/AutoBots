import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Zap,
  Target,
  ShieldCheck,
  Percent,
  DollarSign,
  BarChart3,
  Clock,
  Filter,
  RefreshCw,
  Award,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { TradeHistoryResponse } from "../types";
import { fetchTradeHistory, executePaperOrder } from "../api";

interface TradeAnalyticsLedgerProps {
  currentSymbol: string;
  onTradeExecuted?: () => void;
}

export const TradeAnalyticsLedger: React.FC<TradeAnalyticsLedgerProps> = ({
  currentSymbol,
  onTradeExecuted,
}) => {
  const [period, setPeriod] = useState<"DAY" | "MONTH" | "YEAR" | "CUSTOM" | "ALL">("DAY");
  const [filterSymbol, setFilterSymbol] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [historyData, setHistoryData] = useState<TradeHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [scalpExecuting, setScalpExecuting] = useState<boolean>(false);
  const [scalpMessage, setScalpMessage] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchTradeHistory(
        period,
        filterSymbol === "ALL" ? undefined : filterSymbol,
        period === "CUSTOM" && startDate ? startDate : undefined,
        period === "CUSTOM" && endDate ? endDate : undefined
      );
      setHistoryData(data);
    } catch (err) {
      console.error("Failed to load trade history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 8000);
    return () => clearInterval(interval);
  }, [period, filterSymbol, startDate, endDate]);

  const handleExecuteScalp = async (side: "BUY" | "SELL") => {
    setScalpExecuting(true);
    setScalpMessage(null);
    try {
      const targetSym = filterSymbol !== "ALL" ? filterSymbol : currentSymbol;
      const res = await executePaperOrder({
        symbol: targetSym,
        side,
        quantity: targetSym.includes("GOLD") ? 2 : 25,
        order_type: "MARKET",
      });
      const execPrice = res.price || res.executed_price || 0;
      setScalpMessage(`⚡ ${side} Micro-Scalp executed on ${targetSym} @ ₹${execPrice.toFixed(2)}!`);
      if (onTradeExecuted) onTradeExecuted();
      setTimeout(loadHistory, 1200);
    } catch (err: any) {
      setScalpMessage(`❌ Scalp order failed: ${err.message || "Unknown error"}`);
    } finally {
      setScalpExecuting(false);
      setTimeout(() => setScalpMessage(null), 5000);
    }
  };

  const summary = historyData?.summary;
  const trades = historyData?.trades || [];
  const strategies = historyData?.strategy_breakdown || [];

  const formatIST = (isoString: string) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  const formatDuration = (secs: number) => {
    if (!secs || secs < 1) return "< 5s";
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className="trade-ledger-box">
      {/* Header & Period Filters */}
      <div className="trade-ledger-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              padding: "10px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Award size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", letterSpacing: "0.3px" }}>
                Trade Ledger & Period Profitability
              </h2>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "20px",
                  padding: "2px 8px",
                }}
              >
                Persistent Storage
              </span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
              Filtered win rate %, net profit factor, and second-level high-volume scalper analytics
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Period Selector Buttons */}
          <div className="period-pill-group">
            {(["DAY", "MONTH", "YEAR", "CUSTOM", "ALL"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`period-pill-btn ${period === p ? "active" : ""}`}
              >
                {p === "DAY"
                  ? "Today"
                  : p === "MONTH"
                  ? "This Month"
                  : p === "YEAR"
                  ? "This Year"
                  : p === "CUSTOM"
                  ? "Custom Range"
                  : "All-Time"}
              </button>
            ))}
          </div>

          {/* Symbol Filter */}
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="symbol-select-control"
          >
            <option value="ALL">All Monitored Assets</option>
            <option value="NIFTY 50">NIFTY 50</option>
            <option value="BANKNIFTY">BANK NIFTY</option>
            <option value="GOLD">GOLD (XAUUSD)</option>
            <option value="SILVER">SILVER (XAGUSD)</option>
            <option value="USD/INR">USD/INR</option>
            <option value="RELIANCE">RELIANCE</option>
            <option value="TCS">TCS</option>
            <option value="CRUDE OIL">CRUDE OIL</option>
            <option value="EUR/USD">EUR/USD</option>
            <option value="GBP/USD">GBP/USD</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadHistory}
            disabled={loading}
            style={{
              padding: "7px 10px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            title="Reload trade data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === "CUSTOM" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "12px",
            flexWrap: "wrap",
          }}
        >
          <Calendar size={15} color="#34d399" />
          <span style={{ color: "var(--text-main)", fontWeight: 600 }}>Select Custom Date Range:</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label style={{ color: "var(--text-dim)" }}>From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                background: "#0b0f19",
                border: "1px solid var(--border-subtle)",
                color: "#fff",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "12px",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <label style={{ color: "var(--text-dim)" }}>To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                background: "#0b0f19",
                border: "1px solid var(--border-subtle)",
                color: "#fff",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "12px",
              }}
            />
          </div>
          <button
            onClick={loadHistory}
            style={{
              background: "#10b981",
              color: "#000",
              fontWeight: 700,
              border: "none",
              borderRadius: "4px",
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>
      )}

      {/* KPI Performance Cards */}
      {summary && (
        <div className="kpi-cards-grid">
          {/* Win Rate Card */}
          <div className="kpi-metric-card">
            <div className="kpi-title">
              <span>Win Rate %</span>
              <Percent size={14} color="#10b981" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span
                  className="kpi-value"
                  style={{
                    color:
                      summary.win_rate_pct >= 60
                        ? "#34d399"
                        : summary.win_rate_pct >= 45
                        ? "#fbbf24"
                        : "#f87171",
                  }}
                >
                  {(summary.win_rate_pct ?? 0).toFixed(1)}%
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  ({summary.win_count}W / {summary.loss_count}L)
                </span>
              </div>
              {/* Visual progress bar */}
              <div
                style={{
                  width: "100%",
                  height: "5px",
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "4px",
                  marginTop: "8px",
                  overflow: "hidden",
                  display: "flex",
                }}
              >
                <div
                  style={{
                    width: `${summary.win_rate_pct}%`,
                    background: "#10b981",
                    height: "100%",
                    transition: "width 0.4s ease",
                  }}
                />
                <div
                  style={{
                    width: `${100 - summary.win_rate_pct}%`,
                    background: "#ef4444",
                    height: "100%",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>
            <div className="kpi-footer">
              <span>Total {summary.total_trades} trade{summary.total_trades !== 1 ? "s" : ""}</span>
              <span style={{ color: "var(--accent-primary)" }}>{period} Filter</span>
            </div>
          </div>

          {/* Net Realized P&L */}
          <div className="kpi-metric-card">
            <div className="kpi-title">
              <span>Net Realized P&L</span>
              <DollarSign size={14} color="#10b981" />
            </div>
            <div>
              <span
                className="kpi-value"
                style={{
                  color: summary.net_realized_pnl >= 0 ? "#34d399" : "#f87171",
                }}
              >
                {summary.net_realized_pnl >= 0 ? "+" : ""}₹
                {summary.net_realized_pnl.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="kpi-footer">
              <span style={{ color: "#34d399" }}>+₹{(summary.gross_profit ?? 0).toFixed(0)}</span>
              <span style={{ color: "#f87171" }}>-₹{(summary.gross_loss ?? 0).toFixed(0)}</span>
            </div>
          </div>

          {/* Profit Factor */}
          <div className="kpi-metric-card">
            <div className="kpi-title">
              <span>Profit Factor</span>
              <BarChart3 size={14} color="#38bdf8" />
            </div>
            <div>
              <span
                className="kpi-value"
                style={{
                  color:
                    (summary.profit_factor ?? 0) >= 2.0
                      ? "#38bdf8"
                      : (summary.profit_factor ?? 0) >= 1.0
                      ? "#fbbf24"
                      : "#f87171",
                }}
              >
                {(summary.profit_factor ?? 0) >= 99 ? "∞" : `${(summary.profit_factor ?? 0).toFixed(2)}x`}
              </span>
            </div>
            <div className="kpi-footer">
              <span>Avg W: ₹{(summary.avg_win ?? 0).toFixed(0)}</span>
              <span>Avg L: ₹{(summary.avg_loss ?? 0).toFixed(0)}</span>
            </div>
          </div>

          {/* Average Trade P&L */}
          <div className="kpi-metric-card">
            <div className="kpi-title">
              <span>Avg Trade Return</span>
              <Target size={14} color="#a78bfa" />
            </div>
            <div>
              <span
                className="kpi-value"
                style={{
                  color: summary.avg_trade_pnl >= 0 ? "#a78bfa" : "#f87171",
                }}
              >
                {summary.avg_trade_pnl >= 0 ? "+" : ""}₹
                {summary.avg_trade_pnl.toLocaleString("en-IN", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
            </div>
            <div className="kpi-footer">
              <span>Risk:Reward 2.5 : 1</span>
              <span style={{ color: "#34d399" }}>Target Scalp</span>
            </div>
          </div>
        </div>
      )}

      {/* High-Volume Micro Scalper Action Banner */}
      <div className="scalper-banner">
        <div style={{ maxWidth: "680px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                padding: "4px",
                borderRadius: "4px",
                color: "#34d399",
                display: "flex",
              }}
            >
              <Zap size={15} />
            </div>
            <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              ⚡ High-Volume Micro Scalper (Second-Trade Strategy)
            </h3>
            <span
              style={{
                background: "#10b981",
                color: "#000",
                fontSize: "9px",
                fontWeight: 900,
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              CHOP-PROOF
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: "1.6" }}>
            Eliminates false breakouts and prediction losses. Only triggers when bar volume spikes{" "}
            <strong style={{ color: "#34d399" }}>≥ 1.35x average</strong> with price breaking institutional VWAP.
            Takes micro-targets in <strong style={{ color: "#38bdf8" }}>15s – 90s</strong> on heavy volume
            with strict trailing stop to secure profit before market can reverse.
          </p>
        </div>

        {/* Scalp Trigger Buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={() => handleExecuteScalp("BUY")}
            disabled={scalpExecuting}
            className="btn-scalp-buy"
          >
            <TrendingUp size={14} />
            <span>SCALP BUY ({filterSymbol !== "ALL" ? filterSymbol : currentSymbol})</span>
          </button>
          <button
            onClick={() => handleExecuteScalp("SELL")}
            disabled={scalpExecuting}
            className="btn-scalp-sell"
          >
            <TrendingDown size={14} />
            <span>SCALP SHORT ({filterSymbol !== "ALL" ? filterSymbol : currentSymbol})</span>
          </button>
        </div>

        {scalpMessage && (
          <div
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "6px",
              background: "rgba(6, 78, 59, 0.8)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#6ee7b7",
            }}
          >
            {scalpMessage}
          </div>
        )}
      </div>

      {/* Strategy Breakdown Chips */}
      {strategies.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--text-muted)",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Layers size={13} color="#38bdf8" />
            <span>Model Strategy Breakdown ({period})</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
            {strategies.map((strat) => (
              <div
                key={strat.name}
                style={{
                  background: "rgba(15, 21, 33, 0.6)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>
                    {strat.name === "HIGH_VOLUME_SCALPER"
                      ? "⚡ Micro Scalper"
                      : strat.name === "ORDER_FLOW_IMBALANCE"
                      ? "🌊 Order Flow"
                      : strat.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                    {strat.trades} trades • {strat.wins} wins
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      color: strat.pnl >= 0 ? "#34d399" : "#f87171",
                    }}
                  >
                    {strat.pnl >= 0 ? "+" : ""}₹{strat.pnl.toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 700 }}>
                    {(strat.win_rate ?? 0).toFixed(0)}% Win
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trade History Table */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)" }}>
            <Clock size={13} color="#10b981" />
            <span>Executed Trade Ledger ({trades.length} Records)</span>
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            Timestamps formatted in Indian Standard Time (IST)
          </span>
        </div>

        {trades.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "rgba(15, 21, 33, 0.4)",
              border: "1px dashed var(--border-subtle)",
              borderRadius: "10px",
            }}
          >
            <Filter size={24} color="var(--text-dim)" style={{ margin: "0 auto 8px auto" }} />
            <p style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
              No completed trades found for the selected {period} filter.
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "4px" }}>
              Execute a high-volume scalp or start auto-bot to record trades in this period.
            </p>
          </div>
        ) : (
          <div className="ledger-table-wrap">
            <table className="ledger-data-table">
              <thead>
                <tr>
                  <th>Time (IST)</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Strategy</th>
                  <th style={{ textAlign: "right" }}>Volume</th>
                  <th style={{ textAlign: "right" }}>Entry</th>
                  <th style={{ textAlign: "right" }}>Exit</th>
                  <th style={{ textAlign: "center" }}>Duration</th>
                  <th style={{ textAlign: "right" }}>Realized P&L</th>
                  <th style={{ textAlign: "center" }}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      {formatIST(t.closed_at)}
                    </td>
                    <td style={{ fontWeight: 700, color: "#fff", fontFamily: "var(--font-sans)" }}>
                      {t.symbol}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 800,
                          background: t.side === "BUY" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                          color: t.side === "BUY" ? "#34d399" : "#fb7185",
                          border: `1px solid ${t.side === "BUY" ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                        }}
                      >
                        {t.side === "BUY" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {t.side}
                      </span>
                    </td>
                    <td style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-sans)" }}>
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.04)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {t.strategy === "HIGH_VOLUME_SCALPER"
                          ? "⚡ Micro Scalper"
                          : t.strategy === "ORDER_FLOW_IMBALANCE"
                          ? "Order Flow"
                          : t.strategy}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", color: "var(--text-main)", fontWeight: 700 }}>
                      {t.quantity}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--text-muted)" }}>
                      ₹{(t.entry_price ?? 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--text-main)" }}>
                      ₹{(t.exit_price ?? 0).toFixed(2)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "11px", fontFamily: "var(--font-sans)" }}>
                      {formatDuration(t.duration_seconds)}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 800,
                        color: (t.realized_pnl ?? 0) >= 0 ? "#34d399" : "#f87171",
                      }}
                    >
                      {(t.realized_pnl ?? 0) >= 0 ? "+" : ""}₹{(t.realized_pnl ?? 0).toFixed(2)}
                      <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.8, fontWeight: 500 }}>
                        {((t.realized_return_pct ?? 0) >= 0 ? "+" : "")}
                        {(t.realized_return_pct ?? 0).toFixed(2)}%)
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          fontSize: "9px",
                          fontWeight: 900,
                          borderRadius: "4px",
                          textTransform: "uppercase",
                          background: t.is_win ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                          color: t.is_win ? "#34d399" : "#fb7185",
                          border: `1px solid ${t.is_win ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                        }}
                      >
                        {t.close_reason || (t.is_win ? "WIN" : "LOSS")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
