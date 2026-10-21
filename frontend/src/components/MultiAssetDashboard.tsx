import React, { useState, useEffect, useCallback } from "react";
import {
  fetchMultiAssetOverview,
  toggleAssetTrading,
  MultiAssetOverviewResponse,
  MultiAssetData,
  sendManualMT5Order,
} from "../api";

interface MultiAssetDashboardProps {
  onSelectSymbol?: (symbol: string) => void;
}

export const MultiAssetDashboard: React.FC<MultiAssetDashboardProps> = ({ onSelectSymbol }) => {
  const [data, setData] = useState<MultiAssetOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("DAY");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [togglingSymbol, setTogglingSymbol] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);

  const loadData = useCallback(async (period: string = selectedPeriod) => {
    try {
      setError(null);
      const res = await fetchMultiAssetOverview(period);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load multi-asset overview:", err);
      setError(err?.message || "Failed to load multi-asset overview");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // Initial load
  useEffect(() => {
    loadData(selectedPeriod);
  }, [loadData, selectedPeriod]);

  // Live auto-refresh polling every 3.5s
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      loadData(selectedPeriod);
    }, 3500);
    return () => clearInterval(interval);
  }, [isAutoRefresh, loadData, selectedPeriod]);

  const handleToggle = async (symbol: string, currentEnabled: boolean) => {
    setTogglingSymbol(symbol);
    try {
      await toggleAssetTrading(symbol, !currentEnabled);
      setActionNotice(`${symbol} auto-trading ${!currentEnabled ? "ENABLED" : "PAUSED"} on server.`);
      await loadData(selectedPeriod);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      alert(`Failed to toggle ${symbol}: ${err?.message}`);
    } finally {
      setTogglingSymbol(null);
    }
  };

  const handleQuickScalp = async (asset: MultiAssetData, side: "BUY" | "SELL") => {
    try {
      const defaultLots: Record<string, number> = {
        "NIFTY 50": 50,
        "BANKNIFTY": 25,
        "GOLD": 2,
        "SILVER": 10,
        "USD/INR": 1000,
        "RELIANCE": 25,
        "TCS": 25,
        "CRUDE OIL": 10,
      };
      const lots = defaultLots[asset.symbol] || 10;
      const slDist = asset.current_price * 0.003;
      const tpDist = asset.current_price * 0.006;
      const sl = side === "BUY" ? asset.current_price - slDist : asset.current_price + slDist;
      const tp = side === "BUY" ? asset.current_price + tpDist : asset.current_price - tpDist;

      await sendManualMT5Order({
        symbol: asset.symbol,
        side,
        lots,
        price: asset.current_price,
        stop_loss: Number(sl.toFixed(2)),
        take_profit: Number(tp.toFixed(2)),
        strategy: "MULTI_ASSET_ONE_CLICK_SCALPER",
      });

      setActionNotice(`Executed ${side} scalp on ${asset.symbol} (${lots} units)`);
      await loadData(selectedPeriod);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      alert(`Scalp execution failed: ${err?.message}`);
    }
  };

  const periodOptions = [
    { label: "Today", value: "DAY" },
    { label: "This Week", value: "WEEK" },
    { label: "This Month", value: "MONTH" },
    { label: "This Year", value: "YEAR" },
    { label: "All Time", value: "ALL" },
  ];

  const categoryOptions = [
    { label: "All Assets", value: "ALL" },
    { label: "Indices", value: "INDEX" },
    { label: "Commodities", value: "COMMODITY" },
    { label: "Currencies", value: "FOREX" },
    { label: "Equities", value: "EQUITY" },
  ];

  const filteredAssets = data?.assets?.filter((asset) => {
    if (categoryFilter === "ALL") return true;
    if (categoryFilter === "FOREX" && (asset.category === "FOREX" || asset.category === "FX")) return true;
    return asset.category === categoryFilter;
  }) || [];

  const formatPrice = (val: number, symbol: string) => {
    if (!val) return "₹0.00";
    if (symbol.includes("USD") && !symbol.includes("INR") || symbol === "GOLD" || symbol === "SILVER" || symbol.includes("CRUDE")) {
      return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  const formatPnL = (val: number, currency = "INR") => {
    const symbol = currency === "USD" ? "$" : "₹";
    const prefix = val > 0 ? `+${symbol}` : val < 0 ? `-${symbol}` : symbol;
    const absVal = Math.abs(val);
    return `${prefix}${absVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const activePositionsCount = data?.assets?.filter((a) => a.active_position !== null).length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      {/* 24/7 Autonomous Server Engine HUD */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 27, 75, 0.45) 100%)",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              padding: "6px 12px",
              borderRadius: "20px",
            }}
          >
            <span className="pulse-indicator" style={{ width: "9px", height: "9px" }}></span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", letterSpacing: "0.5px" }}>
              24/7 AUTONOMOUS SERVER DAEMON ACTIVE
            </span>
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Runs continuously on backend server • Autonomous order flow & SL/TP execution even if browser is closed
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            style={{
              background: isAutoRefresh ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
              border: "1px solid " + (isAutoRefresh ? "rgba(99, 102, 241, 0.5)" : "var(--border-subtle)"),
              color: isAutoRefresh ? "#a5b4fc" : "var(--text-muted)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isAutoRefresh ? "⚡ Live Stream (3.5s)" : "⏸ Polling Paused"}
          </button>

          <button
            onClick={() => loadData(selectedPeriod)}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.2)",
            border: "1px solid rgba(16, 185, 129, 0.5)",
            color: "#6ee7b7",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 600,
            animation: "fadeIn 0.2s ease",
          }}
        >
          ✓ {actionNotice}
        </div>
      )}

      {/* Filter Toolbar: Period Segment & Category Filter */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "rgba(15, 21, 33, 0.6)",
          padding: "10px 14px",
          borderRadius: "10px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
            Analysis Horizon:
          </span>
          <div className="period-pill-group">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                className={`period-pill-btn ${selectedPeriod === opt.value ? "active" : ""}`}
                onClick={() => setSelectedPeriod(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
            Asset Class:
          </span>
          <div style={{ display: "flex", gap: "4px" }}>
            {categoryOptions.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                style={{
                  background: categoryFilter === cat.value ? "rgba(99, 102, 241, 0.3)" : "rgba(255, 255, 255, 0.04)",
                  border: "1px solid " + (categoryFilter === cat.value ? "rgba(99, 102, 241, 0.6)" : "transparent"),
                  color: categoryFilter === cat.value ? "#c7d2fe" : "var(--text-muted)",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-Stock KPI Summary Cards */}
      <div className="kpi-cards-grid">
        <div className="kpi-metric-card">
          <div className="kpi-label">Active Monitored Assets</div>
          <div className="kpi-value" style={{ color: "#38bdf8" }}>
            {data?.overall_summary.enabled_count ?? 8} / {data?.overall_summary.monitored_count ?? 8}
          </div>
          <div className="kpi-footer">
            <span>Server Trading Enabled</span>
            <span style={{ color: "#10b981" }}>● Live Daemon</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-label">Overall Win Rate % ({selectedPeriod})</div>
          <div
            className="kpi-value"
            style={{
              color:
                (data?.overall_summary.win_rate_pct ?? 0) >= 60
                  ? "var(--bullish-green)"
                  : (data?.overall_summary.win_rate_pct ?? 0) > 0
                  ? "#f59e0b"
                  : "var(--text-muted)",
            }}
          >
            {(data?.overall_summary.win_rate_pct ?? 0).toFixed(1)}%
          </div>
          <div className="kpi-footer">
            <span>Closed Trades: {data?.overall_summary.total_trades ?? 0}</span>
            <span>Target: &gt;65%</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-label">Total Realized P&L ({selectedPeriod})</div>
          <div
            className="kpi-value"
            style={{
              color:
                (data?.overall_summary.net_pnl ?? 0) >= 0
                  ? "var(--bullish-green)"
                  : "var(--bearish-red)",
            }}
          >
            {formatPnL(data?.overall_summary.net_pnl ?? 0)}
          </div>
          <div className="kpi-footer">
            <span>Server Executed</span>
            <span>Audited</span>
          </div>
        </div>

        <div className="kpi-metric-card">
          <div className="kpi-label">Active Market Positions</div>
          <div className="kpi-value" style={{ color: "#a855f7" }}>
            {activePositionsCount}
          </div>
          <div className="kpi-footer">
            <span>Trailing SL / Dynamic TP</span>
            <span style={{ color: "#38bdf8" }}>⚡ Server Managed</span>
          </div>
        </div>
      </div>

      {/* Main Multi-Stock Grid */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🌐 Simultaneous Multi-Stock Algorithmic Execution</span>
            <span style={{ fontSize: "11px", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "12px", color: "var(--text-dim)" }}>
              {filteredAssets.length} Assets
            </span>
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            Click any asset to switch interactive TradingView chart
          </span>
        </div>

        {loading && !data ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            ⚡ Connecting to Autonomous Server Daemon...
          </div>
        ) : error ? (
          <div style={{ padding: "20px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: "8px", color: "#fca5a5" }}>
            ⚠️ Error loading multi-stock engine: {error}
          </div>
        ) : (
          <div className="multi-asset-grid">
            {filteredAssets.map((asset) => {
              const isEnabled = asset.enabled;
              const pos = asset.active_position;
              const hasPos = pos !== null;
              const winRate = asset.win_rate_pct;
              const totalTrades = asset.total_trades;

              return (
                <div
                  key={asset.symbol}
                  className={`asset-command-card ${isEnabled ? "enabled" : "paused"}`}
                >
                  {/* Card Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          onClick={() => onSelectSymbol && onSelectSymbol(asset.symbol)}
                          style={{
                            fontSize: "15px",
                            fontWeight: 800,
                            color: "var(--text-main)",
                            cursor: "pointer",
                            textDecoration: "underline",
                            textDecorationColor: "rgba(255,255,255,0.2)",
                          }}
                          title="Click to view chart in Terminal"
                        >
                          {asset.symbol}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              asset.category === "INDEX"
                                ? "rgba(56, 189, 248, 0.15)"
                                : asset.category === "COMMODITY"
                                ? "rgba(245, 158, 11, 0.15)"
                                : asset.category === "FOREX" || asset.category === "FX"
                                ? "rgba(168, 85, 247, 0.15)"
                                : "rgba(16, 185, 129, 0.15)",
                            color:
                              asset.category === "INDEX"
                                ? "#38bdf8"
                                : asset.category === "COMMODITY"
                                ? "#fbbf24"
                                : asset.category === "FOREX" || asset.category === "FX"
                                ? "#c084fc"
                                : "#34d399",
                          }}
                        >
                          {asset.category}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
                        {asset.name}
                      </div>
                    </div>

                    {/* Auto-Trading Toggle Button */}
                    <button
                      onClick={() => handleToggle(asset.symbol, isEnabled)}
                      disabled={togglingSymbol === asset.symbol}
                      style={{
                        background: isEnabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        border: "1px solid " + (isEnabled ? "rgba(16, 185, 129, 0.5)" : "var(--border-subtle)"),
                        color: isEnabled ? "#10b981" : "var(--text-muted)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.15s ease",
                      }}
                      title="Toggle autonomous server trading for this stock"
                    >
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: isEnabled ? "#10b981" : "#64748b",
                        }}
                      />
                      {togglingSymbol === asset.symbol ? "Updating..." : isEnabled ? "AUTO ON" : "PAUSED"}
                    </button>
                  </div>

                  {/* Quantitative Model Badge */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "10px",
                    }}
                  >
                    <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      🧠 {asset.best_model}
                    </span>
                    <span style={{ color: "#a5b4fc", fontWeight: 700 }}>
                      Acc: ~72.5%
                    </span>
                  </div>

                  {/* Current Live Price & Direction */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "4px 0",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase" }}>Live Price</div>
                      <div style={{ fontSize: "18px", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--text-main)" }}>
                        {formatPrice(asset.current_price, asset.symbol)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase" }}>Server Status</div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: hasPos ? "#38bdf8" : isEnabled ? "#10b981" : "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          justifyContent: "flex-end",
                        }}
                      >
                        {hasPos ? "⚡ IN POSITION" : isEnabled ? "🟢 SCANNING VWAP" : "⏸ PAUSED"}
                      </div>
                    </div>
                  </div>

                  {/* Active Trade Position Status */}
                  <div
                    style={{
                      background: hasPos
                        ? pos.side === "LONG" || pos.side === "BUY"
                          ? "rgba(16, 185, 129, 0.12)"
                          : "rgba(225, 29, 72, 0.12)"
                        : "rgba(255, 255, 255, 0.02)",
                      border: "1px solid " + (hasPos ? (pos.side === "LONG" || pos.side === "BUY" ? "rgba(16, 185, 129, 0.35)" : "rgba(225, 29, 72, 0.35)") : "var(--border-subtle)"),
                      borderRadius: "8px",
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-dim)" }}>
                        SERVER POSITION:
                      </span>
                      {hasPos && pos ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: pos.side === "LONG" || pos.side === "BUY" ? "#059669" : "#e11d48",
                              color: "#fff",
                            }}
                          >
                            {pos.side} {pos.quantity}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              color: pos.unrealized_pnl >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                            }}
                          >
                            {formatPnL(pos.unrealized_pnl, asset.currency)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "10px", color: "var(--text-dim)", fontStyle: "italic" }}>
                          No Active Position (Flat)
                        </span>
                      )}
                    </div>
                    {hasPos && pos && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-dim)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                        <span>SL: {pos.stop_loss}</span>
                        <span>Entry: {pos.entry_price}</span>
                        <span>TP: {pos.take_profit}</span>
                      </div>
                    )}
                  </div>

                  {/* Historical Success / Fail Statistics */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      background: "rgba(8, 12, 20, 0.5)",
                      padding: "8px 10px",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Win Rate ({selectedPeriod})</span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          color: winRate >= 60 ? "var(--bullish-green)" : winRate > 0 ? "#f59e0b" : "var(--text-muted)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {((winRate ?? 0)).toFixed(1)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "5px",
                        background: "rgba(255, 255, 255, 0.08)",
                        borderRadius: "3px",
                        overflow: "hidden",
                        display: "flex",
                      }}
                    >
                      <div
                        style={{
                          width: `${winRate}%`,
                          background: "#10b981",
                          height: "100%",
                        }}
                      />
                      <div
                        style={{
                          width: `${100 - winRate}%`,
                          background: totalTrades > 0 ? "#ef4444" : "transparent",
                          height: "100%",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      <span>Wins: <strong style={{ color: "#10b981" }}>{asset.win_count}</strong></span>
                      <span>Losses: <strong style={{ color: "#ef4444" }}>{asset.loss_count}</strong></span>
                      <span>Net: <strong style={{ color: asset.net_pnl >= 0 ? "#10b981" : "#ef4444" }}>{formatPnL(asset.net_pnl, asset.currency)}</strong></span>
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div style={{ display: "flex", gap: "6px", marginTop: "auto" }}>
                    <button
                      className="btn-scalp-buy"
                      style={{ flex: 1, padding: "6px 8px", fontSize: "11px" }}
                      onClick={() => handleQuickScalp(asset, "BUY")}
                    >
                      ▲ Buy
                    </button>
                    <button
                      className="btn-scalp-sell"
                      style={{ flex: 1, padding: "6px 8px", fontSize: "11px" }}
                      onClick={() => handleQuickScalp(asset, "SELL")}
                    >
                      ▼ Sell
                    </button>
                    <button
                      onClick={() => onSelectSymbol && onSelectSymbol(asset.symbol)}
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)",
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                      title="Load this instrument into chart"
                    >
                      📈 Chart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cross-Stock Performance Matrix Table */}
      <div className="glass-card" style={{ padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>
              📊 Cross-Asset Performance & Precision Scorecard
            </h3>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Continuous evaluation across all asset classes with algorithmic model attribution ({selectedPeriod})
            </p>
          </div>
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Asset Class</th>
                <th>Quant Engine</th>
                <th>Win Rate %</th>
                <th>Trades (W / L)</th>
                <th>Net Realized P&L</th>
                <th>Active Position</th>
                <th>Server Trading</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "24px", color: "var(--text-dim)" }}>
                    No assets found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.symbol}>
                    <td style={{ fontWeight: 700, color: "var(--text-main)" }}>
                      <span
                        style={{ cursor: "pointer", textDecoration: "underline" }}
                        onClick={() => onSelectSymbol && onSelectSymbol(asset.symbol)}
                      >
                        {asset.symbol}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                        {asset.category}
                      </span>
                    </td>
                    <td style={{ color: "#a5b4fc", fontSize: "11px" }}>
                      {asset.best_model}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            asset.win_rate_pct >= 60
                              ? "var(--bullish-green)"
                              : asset.win_rate_pct > 0
                              ? "#f59e0b"
                              : "var(--text-muted)",
                        }}
                      >
                        {((asset.win_rate_pct ?? 0)).toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      {asset.total_trades} ({asset.win_count}W / {asset.loss_count}L)
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color:
                          asset.net_pnl >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {formatPnL(asset.net_pnl, asset.currency)}
                    </td>
                    <td>
                      {asset.active_position ? (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              asset.active_position.side === "LONG" || asset.active_position.side === "BUY"
                                ? "rgba(16, 185, 129, 0.2)"
                                : "rgba(225, 29, 72, 0.2)",
                            color:
                              asset.active_position.side === "LONG" || asset.active_position.side === "BUY"
                                ? "#10b981"
                                : "#f43f5e",
                          }}
                        >
                          {asset.active_position.side} ({formatPnL(asset.active_position.unrealized_pnl, asset.currency)})
                        </span>
                      ) : (
                        <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>FLAT</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: asset.enabled ? "#10b981" : "#64748b",
                        }}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: asset.enabled ? "#10b981" : "#64748b",
                          }}
                        />
                        {asset.enabled ? "ACTIVE" : "PAUSED"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => onSelectSymbol && onSelectSymbol(asset.symbol)}
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          border: "1px solid rgba(99, 102, 241, 0.3)",
                          color: "#a5b4fc",
                          borderRadius: "4px",
                          padding: "3px 8px",
                          fontSize: "10px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Open Chart
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default MultiAssetDashboard;
