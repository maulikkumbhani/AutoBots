import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Target,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  BarChart2,
  RefreshCw,
  Compass,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
} from "lucide-react";
import {
  OrderBlockAnalysisResponse,
  OrderBlockItem,
  FairValueGapItem,
} from "../types";
import { fetchOrderBlockAnalysis, executePaperOrder } from "../api";

interface OrderBlockTerminalProps {
  currentSymbol: string;
  onSelectSymbol?: (symbol: string) => void;
  onTradeExecuted?: () => void;
}

export const OrderBlockTerminal: React.FC<OrderBlockTerminalProps> = ({
  currentSymbol,
  onSelectSymbol,
  onTradeExecuted,
}) => {
  const [symbol, setSymbol] = useState<string>(currentSymbol || "NIFTY 50");
  const [timeframe, setTimeframe] = useState<string>("15m");
  const [data, setData] = useState<OrderBlockAnalysisResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [orderExecuting, setOrderExecuting] = useState<boolean>(false);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);

  const availableSymbols = [
    "NIFTY 50",
    "BANKNIFTY",
    "GOLD",
    "SILVER",
    "USD/INR",
    "RELIANCE",
    "TCS",
    "CRUDE OIL",
  ];

  const timeframes = ["1m", "5m", "15m", "1h", "4h", "1d"];

  const loadAnalysis = useCallback(async () => {
    try {
      setError(null);
      const res = await fetchOrderBlockAnalysis(symbol, timeframe);
      setData(res);
    } catch (err: any) {
      console.error("Order Block Analysis error:", err);
      setError(err?.message || "Failed to load order block intelligence");
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    setLoading(true);
    loadAnalysis();
  }, [loadAnalysis]);

  // Live auto-refresh every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(loadAnalysis, 3500);
    return () => clearInterval(interval);
  }, [loadAnalysis]);

  const handleExecuteSniperOrder = async () => {
    if (!data || !data.confluence) return;
    const conf = data.confluence;
    if (conf.signal === "WAIT_FOR_RETEST") {
      setOrderFeedback("⚠️ Signal is consolidating. Please wait for an unmitigated Order Block retest!");
      setTimeout(() => setOrderFeedback(null), 4000);
      return;
    }

    setOrderExecuting(true);
    setOrderFeedback(null);
    try {
      const isGoldOrFx = symbol.includes("GOLD") || symbol.includes("SILVER") || symbol.includes("/");
      const qty = symbol === "GOLD" ? 2 : symbol === "SILVER" ? 10 : symbol === "USD/INR" ? 1000 : 25;

      const res = await executePaperOrder({
        symbol,
        side: conf.signal,
        quantity: qty,
        order_type: "MARKET",
        stop_loss: conf.stop_loss,
        take_profit: conf.take_profit,
      });

      const fillP = res.price || res.executed_price || data.current_price;
      setOrderFeedback(
        `⚡ Executed Institutional ${conf.signal} on ${symbol} @ ₹${(fillP ?? 0).toFixed(2)} | Target: ₹${conf.take_profit} | SL: ₹${conf.stop_loss}`
      );
      if (onTradeExecuted) onTradeExecuted();
      setTimeout(() => setOrderFeedback(null), 6000);
    } catch (err: any) {
      setOrderFeedback(`❌ Execution failed: ${err.message || "Unknown error"}`);
      setTimeout(() => setOrderFeedback(null), 5000);
    } finally {
      setOrderExecuting(false);
    }
  };

  const confluence = data?.confluence;
  const orderBlocks = data?.order_blocks;
  const fvgs = data?.fair_value_gaps;
  const orderFlow = data?.order_flow_imbalance;
  const structure = data?.market_structure;
  const liquidity = data?.liquidity_pools;

  const isBuy = confluence?.signal === "BUY";
  const isSell = confluence?.signal === "SELL";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header bar: Symbol Selector, Timeframe, Live Price & Refresh */}
      <div
        className="glass-card"
        style={{
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          border: "1px solid rgba(99, 102, 241, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div
            style={{
              padding: "8px",
              borderRadius: "8px",
              background: "rgba(99, 102, 241, 0.15)",
              color: "var(--accent-primary)",
              display: "flex",
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#fff", margin: 0 }}>
                Smart Money Concepts & Order Block Terminal
              </h2>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "var(--bullish-green)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  padding: "2px 8px",
                  borderRadius: "12px",
                }}
              >
                ORDER-BLOCK.COM ENGINE
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "2px" }}>
              Institutional Liquidity Sweeps • Demand & Supply Mitigation • 50% Equilibrium • CVD Volume Delta
            </div>
          </div>
        </div>

        {/* Controls: Symbol Dropdown, Timeframe buttons, and Live Price */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Symbol Selector */}
          <select
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              if (onSelectSymbol) onSelectSymbol(e.target.value);
            }}
            style={{
              background: "#0b0f19",
              border: "1px solid var(--border-subtle)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {availableSymbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Timeframe Chips */}
          <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.05)", borderRadius: "6px", padding: "2px" }}>
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 700,
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  background: timeframe === tf ? "var(--accent-primary)" : "transparent",
                  color: timeframe === tf ? "#fff" : "var(--text-dim)",
                  transition: "all 0.15s ease",
                }}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Live Price Tag */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              padding: "6px 12px",
              borderRadius: "6px",
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>LIVE:</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-main)" }}>
              {symbol.includes("GOLD") || symbol.includes("SILVER") || symbol.includes("CRUDE") ? "$" : "₹"}
              {(data?.current_price ?? 0).toFixed(symbol.includes("/") ? 4 : 2)}
            </span>
          </div>

          <button
            onClick={loadAnalysis}
            className="btn btn-outline"
            style={{ padding: "6px", borderRadius: "6px" }}
            title="Refresh Order Block Telemetry"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
          </button>
        </div>
      </div>

      {orderFeedback && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 700,
            background: orderFeedback.includes("❌")
              ? "rgba(239, 68, 68, 0.15)"
              : orderFeedback.includes("⚠️")
              ? "rgba(245, 158, 11, 0.15)"
              : "rgba(16, 185, 129, 0.15)",
            border: `1px solid ${
              orderFeedback.includes("❌")
                ? "rgba(239, 68, 68, 0.3)"
                : orderFeedback.includes("⚠️")
                ? "rgba(245, 158, 11, 0.3)"
                : "rgba(16, 185, 129, 0.3)"
            }`,
            color: orderFeedback.includes("❌") ? "#f87171" : orderFeedback.includes("⚠️") ? "#fbbf24" : "#34d399",
          }}
        >
          {orderFeedback}
        </div>
      )}

      {/* Hero: 100% Institutional Sniper Confluence Card */}
      {confluence && (
        <div
          className="glass-card"
          style={{
            padding: "20px",
            position: "relative",
            overflow: "hidden",
            border: isBuy
              ? "1px solid rgba(16, 185, 129, 0.4)"
              : isSell
              ? "1px solid rgba(239, 68, 68, 0.4)"
              : "1px solid var(--border-subtle)",
            background: isBuy
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%)"
              : isSell
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%)"
              : "var(--card-bg)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px" }}>
            <div style={{ flex: "1 1 340px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span
                  className={`pill-badge ${isBuy ? "pill-bullish" : isSell ? "pill-bearish" : "pill-neutral"}`}
                  style={{ fontSize: "12px", padding: "4px 10px", fontWeight: 800 }}
                >
                  {isBuy && <ArrowUpRight size={14} />}
                  {isSell && <ArrowDownRight size={14} />}
                  {confluence.signal} SIGNAL • {confluence.confidence_pct}% ACCURACY
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#fbbf24",
                    background: "rgba(234, 179, 8, 0.15)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid rgba(234, 179, 8, 0.3)",
                  }}
                >
                  🏆 {confluence.grade}
                </span>
              </div>

              <div style={{ fontSize: "14px", color: "var(--text-main)", fontWeight: 600, lineHeight: "1.4", marginBottom: "8px" }}>
                {confluence.reasoning}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "11px", color: "var(--text-dim)" }}>
                <span>Structure: <strong style={{ color: "#fff" }}>{structure?.market_structure_regime}</strong></span>
                <span>Zone: <strong style={{ color: structure?.is_discount_zone ? "var(--bullish-green)" : "var(--bearish-red)" }}>{structure?.pricing_zone}</strong></span>
              </div>
            </div>

            {/* Target, SL, Entry and 1-Click Execution */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: "1 1 300px", minWidth: "260px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center", fontFamily: "var(--font-mono)" }}>
                <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Optimal Entry</div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                    ₹{(confluence.entry_zone?.optimal ?? 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--text-dim)", marginTop: "2px" }}>
                    {confluence.entry_zone?.min} - {confluence.entry_zone?.max}
                  </div>
                </div>

                <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
                  <div style={{ fontSize: "10px", color: "var(--bearish-red)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                    <Shield size={10} /> Stop-Loss
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--bearish-red)" }}>
                    ₹{(confluence.stop_loss ?? 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--text-dim)", marginTop: "2px" }}>
                    OB Wick Invalidation
                  </div>
                </div>

                <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                  <div style={{ fontSize: "10px", color: "var(--bullish-green)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                    <Target size={10} /> Liquidity TP
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--bullish-green)" }}>
                    ₹{(confluence.take_profit ?? 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--bullish-green)", marginTop: "2px" }}>
                    R:R {confluence.risk_reward_ratio}
                  </div>
                </div>
              </div>

              {/* 1-Click Institutional Order Execution */}
              <button
                className={`btn ${isBuy ? "btn-success" : isSell ? "btn-danger" : "btn-primary"}`}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
                onClick={handleExecuteSniperOrder}
                disabled={orderExecuting || confluence.signal === "WAIT_FOR_RETEST"}
              >
                <Zap size={14} className={orderExecuting ? "animate-spin" : ""} />
                {confluence.signal === "WAIT_FOR_RETEST"
                  ? "Consolidating (Awaiting Liquidity Sweep)"
                  : `Execute Institutional ${confluence.signal} Sniper Trade`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buyer vs Seller Order Flow Imbalance & CVD Bar */}
      {orderFlow && (
        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Activity size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                Order Flow Imbalance & Real-Time Buyer vs Seller Delta
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px" }}>
              <span style={{ color: "var(--text-dim)" }}>
                CVD Trend: <strong style={{ color: orderFlow.cvd_trend === "BULLISH_EXPANSION" ? "var(--bullish-green)" : "var(--bearish-red)" }}>{orderFlow.cvd_trend}</strong>
              </span>
              {orderFlow.institutional_absorption_detected && (
                <span
                  style={{
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "#fbbf24",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                  }}
                >
                  ⚡ INSTITUTIONAL ABSORPTION DETECTED
                </span>
              )}
            </div>
          </div>

          {/* Visual Dual Progress Bar */}
          <div style={{ display: "flex", height: "16px", borderRadius: "8px", overflow: "hidden", background: "rgba(255,255,255,0.05)", marginBottom: "8px" }}>
            <div
              style={{
                width: `${orderFlow.buyer_volume_pct}%`,
                background: "linear-gradient(90deg, #059669, #10b981)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                paddingLeft: "8px",
                fontSize: "10px",
                fontWeight: 800,
                color: "#fff",
                transition: "width 0.4s ease",
              }}
            >
              BUYERS: {orderFlow.buyer_volume_pct}%
            </div>
            <div
              style={{
                width: `${orderFlow.seller_volume_pct}%`,
                background: "linear-gradient(90deg, #ef4444, #dc2626)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: "8px",
                fontSize: "10px",
                fontWeight: 800,
                color: "#fff",
                transition: "width 0.4s ease",
              }}
            >
              SELLERS: {orderFlow.seller_volume_pct}%
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-dim)" }}>
            <span>
              Dominant Control: <strong style={{ color: orderFlow.dominant_party === "BUYERS" ? "var(--bullish-green)" : orderFlow.dominant_party === "SELLERS" ? "var(--bearish-red)" : "#fbbf24" }}>{orderFlow.dominant_party}</strong>
            </span>
            <span>
              Order Flow Imbalance Ratio: <strong style={{ color: "#fff" }}>{orderFlow.order_flow_imbalance_ratio}x</strong>
            </span>
          </div>
        </div>
      )}

      {/* Grid: Order Blocks Ladder (Demand vs Supply) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "16px" }}>
        {/* Demand Zones (Bullish Order Blocks) */}
        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="color-dot" style={{ background: "var(--bullish-green)" }}></span>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--bullish-green)" }}>
                Institutional Demand Zones (Bullish Order Blocks)
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              {orderBlocks?.total_unmitigated_demand ?? 0} Unmitigated
            </span>
          </div>

          {orderBlocks?.bullish_order_blocks && orderBlocks.bullish_order_blocks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orderBlocks.bullish_order_blocks.map((ob: OrderBlockItem, idx: number) => {
                const isClosest = idx === 0 && ob.is_fresh;
                return (
                  <div
                    key={idx}
                    style={{
                      background: isClosest ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${isClosest ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.06)"}`,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff", fontFamily: "var(--font-mono)" }}>
                          ₹{ob.bottom.toFixed(2)} - ₹{ob.top.toFixed(2)}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: "3px",
                            background: ob.is_fresh ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                            color: ob.is_fresh ? "var(--bullish-green)" : "var(--text-dim)",
                          }}
                        >
                          {ob.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
                        50% Equilibrium: <strong>₹{ob.equilibrium_50.toFixed(2)}</strong> • Volume: {ob.volume_surge_x}x • {ob.age_bars} bars ago
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--bullish-green)" }}>
                        {ob.distance_pct >= 0 ? `+${ob.distance_pct}%` : `${ob.distance_pct}%`}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                        Quality: {ob.strength_score}/100
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
              No active demand blocks detected in recent lookback.
            </div>
          )}
        </div>

        {/* Supply Zones (Bearish Order Blocks) */}
        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="color-dot" style={{ background: "var(--bearish-red)" }}></span>
              <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--bearish-red)" }}>
                Institutional Supply Zones (Bearish Order Blocks)
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              {orderBlocks?.total_unmitigated_supply ?? 0} Unmitigated
            </span>
          </div>

          {orderBlocks?.bearish_order_blocks && orderBlocks.bearish_order_blocks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {orderBlocks.bearish_order_blocks.map((ob: OrderBlockItem, idx: number) => {
                const isClosest = idx === 0 && ob.is_fresh;
                return (
                  <div
                    key={idx}
                    style={{
                      background: isClosest ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.02)",
                      border: `1px solid ${isClosest ? "rgba(239, 68, 68, 0.4)" : "rgba(255, 255, 255, 0.06)"}`,
                      borderRadius: "6px",
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff", fontFamily: "var(--font-mono)" }}>
                          ₹{ob.bottom.toFixed(2)} - ₹{ob.top.toFixed(2)}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: "3px",
                            background: ob.is_fresh ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.08)",
                            color: ob.is_fresh ? "var(--bearish-red)" : "var(--text-dim)",
                          }}
                        >
                          {ob.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
                        50% Equilibrium: <strong>₹{ob.equilibrium_50.toFixed(2)}</strong> • Volume: {ob.volume_surge_x}x • {ob.age_bars} bars ago
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--bearish-red)" }}>
                        {ob.distance_pct >= 0 ? `+${ob.distance_pct}%` : `${ob.distance_pct}%`}
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                        Quality: {ob.strength_score}/100
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: "12px", color: "var(--text-dim)", textAlign: "center", padding: "20px" }}>
              No active supply blocks detected in recent lookback.
            </div>
          )}
        </div>
      </div>

      {/* Fair Value Gaps (FVG) and Liquidity Pools Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
        {/* Fair Value Gaps (Imbalance) */}
        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Compass size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                Fair Value Gaps (FVG / Price Imbalance)
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              {fvgs?.total_open_gaps ?? 0} Open Imbalances
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {fvgs?.bullish_fvgs && fvgs.bullish_fvgs.length > 0 ? (
              fvgs.bullish_fvgs.slice(0, 3).map((fvg: FairValueGapItem, i: number) => (
                <div
                  key={`b-${i}`}
                  style={{
                    background: "rgba(16, 185, 129, 0.06)",
                    border: "1px solid rgba(16, 185, 129, 0.2)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--bullish-green)", fontFamily: "var(--font-mono)" }}>
                      Bullish FVG: ₹{fvg.bottom.toFixed(2)} - ₹{fvg.top.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                      Midpoint: ₹{fvg.midpoint.toFixed(2)} • Gap: {fvg.gap_size} pts
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: fvg.fill_pct > 0 ? "#fbbf24" : "var(--bullish-green)" }}>
                    {fvg.fill_pct > 0 ? `${fvg.fill_pct}% Filled` : "UNFILLED"}
                  </span>
                </div>
              ))
            ) : null}

            {fvgs?.bearish_fvgs && fvgs.bearish_fvgs.length > 0 ? (
              fvgs.bearish_fvgs.slice(0, 3).map((fvg: FairValueGapItem, i: number) => (
                <div
                  key={`s-${i}`}
                  style={{
                    background: "rgba(239, 68, 68, 0.06)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--bearish-red)", fontFamily: "var(--font-mono)" }}>
                      Bearish FVG: ₹{fvg.bottom.toFixed(2)} - ₹{fvg.top.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                      Midpoint: ₹{fvg.midpoint.toFixed(2)} • Gap: {fvg.gap_size} pts
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: fvg.fill_pct > 0 ? "#fbbf24" : "var(--bearish-red)" }}>
                    {fvg.fill_pct > 0 ? `${fvg.fill_pct}% Filled` : "UNFILLED"}
                  </span>
                </div>
              ))
            ) : null}

            {(!fvgs?.bullish_fvgs || fvgs.bullish_fvgs.length === 0) && (!fvgs?.bearish_fvgs || fvgs.bearish_fvgs.length === 0) && (
              <div style={{ fontSize: "12px", color: "var(--text-dim)", textAlign: "center", padding: "16px" }}>
                No active price imbalances detected. Price is fully balanced.
              </div>
            )}
          </div>
        </div>

        {/* Liquidity Pools & Market Structure */}
        <div className="glass-card" style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Target size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                Liquidity Targets & Market Structure
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              SMC Invalidation Framework
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>BUY-SIDE LIQUIDITY (BSL TARGET)</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--bullish-green)", fontFamily: "var(--font-mono)" }}>
                  ₹{(liquidity?.buy_side_liquidity_bsl ?? 0).toFixed(2)}
                </div>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {liquidity?.distance_to_bsl_pct ? `${liquidity.distance_to_bsl_pct}% away` : ""}
              </span>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "var(--text-dim)", fontSize: "10px" }}>SELL-SIDE LIQUIDITY (SSL TARGET)</div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--bearish-red)", fontFamily: "var(--font-mono)" }}>
                  ₹{(liquidity?.sell_side_liquidity_ssl ?? 0).toFixed(2)}
                </div>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                {liquidity?.distance_to_ssl_pct ? `${liquidity.distance_to_ssl_pct}% away` : ""}
              </span>
            </div>

            <div style={{ background: "rgba(99, 102, 241, 0.08)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <div style={{ color: "var(--accent-primary)", fontSize: "10px", fontWeight: 700 }}>50% RANGE EQUILIBRIUM</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff", fontFamily: "var(--font-mono)" }}>
                  ₹{(structure?.equilibrium_50 ?? 0).toFixed(2)}
                </span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: structure?.is_discount_zone ? "var(--bullish-green)" : "var(--bearish-red)" }}>
                  {structure?.pricing_zone}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

