import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Shield,
  Layers,
  Clock,
  Play,
  Square,
  RefreshCw,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
  Maximize2,
  Filter,
  BarChart3,
  Flame,
  Target,
  Sparkles,
  Lock,
  Unlock,
} from "lucide-react";
import { TradingViewChart } from "./TradingViewChart";
import {
  fetchMT5Status,
  sendManualMT5Order,
  fetchLiveTick,
  fetchCandles,
  fetchIndicators,
  fetchMT5Trades,
  fetchStrategyPerformance,
  isolateStrategy,
  fetchFvgAnalysis,
  fetchVolumeOptimization,
  updateVolumeConfig,
  closeAllMT5Positions,
  fetchStrategyAllocations,
  updateStrategyAllocationMode,
  fetchMarketFlow,
  executeMicroBurstWave,
  RecordedMT5Trade,
  StrategyPerformanceItem,
  FvgAnalysisResponse,
  VolumeOptimizationData,
  StrategyAllocationsResponse,
  StrategyAllocationItem,
  MarketFlowAnalysisResponse,
} from "../api";

interface XauusdHubProps {
  onBackToMain: () => void;
}

export const XauusdHub: React.FC<XauusdHubProps> = ({ onBackToMain }) => {
  const symbol = "XAUUSD";
  const [timeframe, setTimeframe] = useState("15m");
  const [candles, setCandles] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any>(null);
  const [liveTick, setLiveTick] = useState<any>(null);
  const [mt5Status, setMt5Status] = useState<any>(null);
  const [lotSize, setLotSize] = useState<number>(0.05);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== "undefined" ? window.innerWidth < 900 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 900);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Tabs
  const [activeTab, setActiveTab] = useState<"ANALYSIS" | "MATRIX" | "LEDGER" | "SETUP">("ANALYSIS");

  // Filter States for MT5 Trade Ledger
  const [ledgerTimeframe, setLedgerTimeframe] = useState<string>("all");
  const [ledgerPeriod, setLedgerPeriod] = useState<string>("all");
  const [ledgerStrategy, setLedgerStrategy] = useState<string>("all");

  // Strategy, FVG, Volume Optimization & Market Flow Data
  const [strategyMatrix, setStrategyMatrix] = useState<StrategyPerformanceItem[]>([]);
  const [isolatedStrategyId, setIsolatedStrategyId] = useState<string>("ALL");
  const [allocationsData, setAllocationsData] = useState<StrategyAllocationsResponse | null>(null);
  const [marketFlowData, setMarketFlowData] = useState<MarketFlowAnalysisResponse | null>(null);
  const [burstCount, setBurstCount] = useState<number>(25);
  const [burstProfitTarget, setBurstProfitTarget] = useState<number>(0.50);
  const [fvgData, setFvgData] = useState<FvgAnalysisResponse | null>(null);
  const [volumeData, setVolumeData] = useState<VolumeOptimizationData | null>(null);
  const [tradesData, setTradesData] = useState<{
    total_trades: number;
    wins: number;
    losses: number;
    win_rate: number;
    net_pnl: number;
    gross_profit: number;
    gross_loss: number;
    profit_factor: number;
    current_equity: number;
    current_balance: number;
    trades: RecordedMT5Trade[];
  }>({
    total_trades: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    net_pnl: 0,
    gross_profit: 0,
    gross_loss: 0,
    profit_factor: 1,
    current_equity: 100000,
    current_balance: 100000,
    trades: [],
  });

  // Load telemetry, chart, strategy matrix, volume optimization, allocations, market flow and trades
  const loadData = async () => {
    try {
      const [cData, indData, tick, mt5, matrixRes, tradesRes, fvgRes, volRes, allocRes, flowRes] = await Promise.all([
        fetchCandles(symbol, timeframe, 15).catch(() => []),
        fetchIndicators(symbol, timeframe, 20).catch(() => []),
        fetchLiveTick(symbol).catch(() => null),
        fetchMT5Status().catch(() => null),
        fetchStrategyPerformance().catch(() => null),
        fetchMT5Trades(ledgerTimeframe, ledgerPeriod, ledgerStrategy).catch(() => null),
        fetchFvgAnalysis(symbol).catch(() => null),
        fetchVolumeOptimization(symbol).catch(() => null),
        fetchStrategyAllocations().catch(() => null),
        fetchMarketFlow(symbol).catch(() => null),
      ]);

      if (cData && cData.length > 0) setCandles(cData);
      if (indData) setIndicators(indData);
      if (tick) setLiveTick(tick);
      if (mt5) setMt5Status(mt5);
      if (matrixRes) {
        setStrategyMatrix(matrixRes.strategies || []);
        setIsolatedStrategyId(matrixRes.active_isolation || "ALL");
      }
      if (tradesRes) setTradesData(tradesRes);
      if (fvgRes) setFvgData(fvgRes);
      if (volRes) setVolumeData(volRes);
      if (allocRes) setAllocationsData(allocRes);
      if (flowRes) setMarketFlowData(flowRes);
    } catch (e) {
      console.error("Error loading XAUUSD Hub data:", e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [timeframe, ledgerTimeframe, ledgerPeriod, ledgerStrategy]);

  // Strategy Isolation Handler
  const handleIsolateStrategy = async (stratId: string) => {
    try {
      await isolateStrategy(stratId);
      setIsolatedStrategyId(stratId);
      setActionMessage(
        stratId === "ALL"
          ? "✅ All 6 Quantitative Strategies are now actively trading simultaneously."
          : `⚡ Isolated Active Testing: Bot will ONLY execute ${stratId} signals on MT5.`
      );
      setTimeout(() => setActionMessage(null), 4000);
      loadData();
    } catch (e: any) {
      setActionMessage(`❌ Failed to set strategy: ${e.message}`);
    }
  };

  // Dynamic Strategy Allocation Mode Handler (80/20 Rule & 100% Solo)
  const handleToggleAllocationMode = async (
    mode: "DYNAMIC_WEIGHTED" | "SOLO_ISOLATION_100" | "BALANCED_EQUAL",
    stratId?: string
  ) => {
    try {
      const res = await updateStrategyAllocationMode(mode, stratId);
      setAllocationsData(res);
      if (stratId) {
        setIsolatedStrategyId(stratId);
      } else if (mode !== "SOLO_ISOLATION_100") {
        setIsolatedStrategyId("ALL");
      }
      setActionMessage(
        mode === "DYNAMIC_WEIGHTED"
          ? "⚡ Dynamic 80/20 Allocation Enabled: 80% capital & trade opportunities routed to top-performing strategy."
          : mode === "SOLO_ISOLATION_100"
          ? `🎯 100% Solo Isolation Active: All execution exclusively assigned to ${stratId || "selected strategy"}.`
          : "⚖️ Balanced Equal Mode Activated: Equal 16.7% execution weight across all 6 strategies."
      );
      setTimeout(() => setActionMessage(null), 4500);
      loadData();
    } catch (e: any) {
      setActionMessage(`❌ Allocation Error: ${e.message}`);
    }
  };

  // Fast Order Handler
  const handleManualOrder = async (side: "BUY" | "SELL", customStrat: string = "MANUAL_UI") => {
    setIsExecuting(true);
    setActionMessage(null);
    try {
      const curPrice = liveTick?.price || (candles.length > 0 ? candles[candles.length - 1].close : 3520.0);
      const chosenLots = (volumeData?.mode === "DYNAMIC_AUTO" && volumeData?.recommended_lots) ? volumeData.recommended_lots : lotSize;
      const targetPts = volumeData?.target_move_points || 2.20;
      const stopPts = volumeData?.protective_stop_points || 1.20;
      const sl = side === "BUY" ? Number((curPrice - stopPts).toFixed(2)) : Number((curPrice + stopPts).toFixed(2));
      const tp = side === "BUY" ? Number((curPrice + targetPts).toFixed(2)) : Number((curPrice - targetPts).toFixed(2));

      await sendManualMT5Order({
        symbol: "XAUUSD",
        side,
        lots: chosenLots,
        price: curPrice,
        stop_loss: sl,
        take_profit: tp,
        strategy: customStrat,
      });

      setActionMessage(`⚡ ${side} ${chosenLots} Lots submitted to MT5 Terminal (TP: $${tp}, SL: $${sl})`);
      setTimeout(() => setActionMessage(null), 4500);
      loadData();
    } catch (err: any) {
      setActionMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToggleVolumeMode = async (mode: "DYNAMIC_AUTO" | "MANUAL_FIXED") => {
    try {
      await updateVolumeConfig({ mode });
      setActionMessage(
        mode === "DYNAMIC_AUTO"
          ? "⚡ Dynamic Volatility & Conviction Volume Sizing Activated. Optimal lots computed dynamically."
          : "🔒 Fixed Lot Mode Activated. Order size locked to manual selection."
      );
      setTimeout(() => setActionMessage(null), 4000);
      loadData();
    } catch (e: any) {
      setActionMessage(`❌ Error: ${e.message}`);
    }
  };

  const handleBulkWaves = async (side: "BUY" | "SELL") => {
    setIsExecuting(true);
    setActionMessage(null);
    try {
      const curPrice = liveTick?.price || (candles.length > 0 ? candles[candles.length - 1].close : 3520.0);
      const waveLots = (volumeData?.mode === "DYNAMIC_AUTO" && volumeData?.recommended_lots) ? volumeData.recommended_lots : (lotSize || 0.05);
      const targetPts = volumeData?.target_move_points || 2.20;
      const stopPts = volumeData?.protective_stop_points || 1.20;

      const tp = side === "BUY" ? Number((curPrice + targetPts).toFixed(2)) : Number((curPrice - targetPts).toFixed(2));
      const sl = side === "BUY" ? Number((curPrice - stopPts).toFixed(2)) : Number((curPrice + stopPts).toFixed(2));

      // Dispatch 3 rapid staggered micro-orders for bulk wave profit
      for (let i = 0; i < 3; i++) {
        await sendManualMT5Order({
          symbol: "XAUUSD",
          side,
          lots: waveLots,
          price: curPrice,
          stop_loss: sl,
          take_profit: tp,
          strategy: "BULK_MICRO_SCALPER",
        });
      }

      const totalGain = (waveLots * 100 * targetPts * 3).toFixed(2);
      setActionMessage(`🌊 Executed 3x Bulk Wave of ${waveLots} lots on ${side} (TP: +$${targetPts} pts, Projected Wave Profit: +$${totalGain})`);
      setTimeout(() => setActionMessage(null), 5000);
      loadData();
    } catch (err: any) {
      setActionMessage(`❌ Bulk Wave Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleFireMicroBurst = async (side: "BUY" | "SELL") => {
    setIsExecuting(true);
    setActionMessage(null);
    try {
      await executeMicroBurstWave(side, burstCount, burstProfitTarget, 0.75, 0.02);
      const totalGain = (burstCount * burstProfitTarget).toFixed(2);
      setActionMessage(`⚡ Fired ${burstCount}x Synchronized Micro-Burst on ${side} targeting +$${burstProfitTarget} per ticket (+$${totalGain} Total) in milliseconds!`);
      setTimeout(() => setActionMessage(null), 5000);
      loadData();
    } catch (err: any) {
      setActionMessage(`❌ Micro-Burst Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCloseAllTrades = async () => {
    setIsExecuting(true);
    setActionMessage(null);
    try {
      await closeAllMT5Positions();
      setActionMessage("🚨 Emergency CLOSE ALL command sent to MT5. Closing open positions immediately...");
      setTimeout(() => setActionMessage(null), 5000);
      loadData();
    } catch (err: any) {
      setActionMessage(`❌ Close All Error: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyServerUrl = () => {
    navigator.clipboard.writeText("http://127.0.0.1:8000");
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const curPrice = liveTick?.price || (candles.length > 0 ? candles[candles.length - 1].close : 3520.0);
  const changePct = liveTick?.change_pct ?? -0.43;
  const isPositive = changePct >= 0;

  const equity = mt5Status?.account_info?.equity || tradesData.current_equity || 100000;
  const balance = mt5Status?.account_info?.balance || tradesData.current_balance || 100000;
  const netProfit = Number((equity - balance).toFixed(2));
  const isNetProfitPositive = netProfit >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "16px", padding: isMobile ? "8px" : "16px", maxWidth: "1600px", margin: "0 auto", color: "#f8fafc", width: "100%", boxSizing: "border-box" }}>
      
      {/* TOP HEADER */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)",
        border: "1px solid rgba(245, 158, 11, 0.25)",
        borderRadius: "14px",
        padding: isMobile ? "12px" : "16px 20px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "16px", flexWrap: "wrap" }}>
          <button
            onClick={onBackToMain}
            className="btn btn-outline"
            style={{ padding: "6px 12px", fontSize: "12px", borderColor: "rgba(255,255,255,0.15)" }}
          >
            ← Back
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: isMobile ? "34px" : "42px",
              height: isMobile ? "34px" : "42px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(245, 158, 11, 0.4)",
            }}>
              <span style={{ fontSize: isMobile ? "16px" : "20px" }}>🪙</span>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: isMobile ? "16px" : "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.5px" }}>
                  XAUUSD (GOLD SPOT)
                </span>
                <span style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#f59e0b",
                  border: "1px solid rgba(245, 158, 11, 0.3)"
                }}>
                  MT5 LIVE
                </span>
                <span style={{
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: mt5Status?.connected ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  color: mt5Status?.connected ? "#34d399" : "#f87171",
                  border: `1px solid ${mt5Status?.connected ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: mt5Status?.connected ? "#34d399" : "#f87171" }}></span>
                  {mt5Status?.connected ? "CONNECTED" : "AWAITING MT5"}
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "2px" }}>
                COMEX Real-Time Spot • Direct IPC Bridge Active
              </div>
            </div>
          </div>
        </div>

        {/* Live Spot Price & Profit Metrics */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "12px" : "24px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase" }}>
              Gold Spot
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontSize: isMobile ? "18px" : "24px", fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>
                ${curPrice.toFixed(2)}
              </span>
              <span style={{
                fontSize: "11px",
                fontWeight: 800,
                color: isPositive ? "#34d399" : "#f87171",
                display: "flex",
                alignItems: "center"
              }}>
                {isPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {changePct >= 0 ? `+${changePct.toFixed(2)}%` : `${changePct.toFixed(2)}%`}
              </span>
            </div>
          </div>

          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: isMobile ? "10px" : "20px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase" }}>
              Equity
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{ fontSize: isMobile ? "17px" : "22px", fontWeight: 900, color: "#38bdf8", fontFamily: "monospace" }}>
                ${equity.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span style={{
                fontSize: "10px",
                fontWeight: 800,
                padding: "2px 5px",
                borderRadius: "4px",
                background: isNetProfitPositive ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                color: isNetProfitPositive ? "#34d399" : "#f87171"
              }}>
                {isNetProfitPositive ? `+$${netProfit}` : `-$${Math.abs(netProfit)}`}
              </span>
            </div>
          </div>

          <button
            onClick={handleCloseAllTrades}
            disabled={isExecuting}
            style={{
              padding: isMobile ? "8px 12px" : "10px 14px",
              fontSize: isMobile ? "10px" : "11px",
              fontWeight: 900,
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#fca5a5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s",
              width: isMobile ? "100%" : "auto",
              justifyContent: "center"
            }}
          >
            🚨 CLOSE ALL MT5 TRADES
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          padding: "10px 16px",
          borderRadius: "8px",
          background: actionMessage.includes("❌") ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
          border: `1px solid ${actionMessage.includes("❌") ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
          fontSize: "13px",
          fontWeight: 700,
          color: actionMessage.includes("❌") ? "#fca5a5" : "#6ee7b7",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          {actionMessage}
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div style={{
        display: "flex",
        gap: isMobile ? "6px" : "8px",
        background: "rgba(15, 23, 42, 0.6)",
        padding: "6px",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.06)",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch"
      }}>
        <button
          onClick={() => setActiveTab("ANALYSIS")}
          style={{
            padding: isMobile ? "8px 12px" : "8px 18px",
            fontSize: isMobile ? "11px" : "12px",
            fontWeight: 800,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: activeTab === "ANALYSIS" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "transparent",
            color: activeTab === "ANALYSIS" ? "#000" : "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all 0.2s"
          }}
        >
          <BarChart3 size={14} /> LIVE CHART & STRATEGY ANALYSIS
        </button>

        <button
          onClick={() => setActiveTab("MATRIX")}
          style={{
            padding: isMobile ? "8px 12px" : "8px 18px",
            fontSize: isMobile ? "11px" : "12px",
            fontWeight: 800,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: activeTab === "MATRIX" ? "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)" : "transparent",
            color: activeTab === "MATRIX" ? "#000" : "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all 0.2s"
          }}
        >
          <Layers size={14} /> STRATEGY PERFORMANCE MATRIX & ISOLATION
        </button>

        <button
          onClick={() => setActiveTab("LEDGER")}
          style={{
            padding: isMobile ? "8px 12px" : "8px 18px",
            fontSize: isMobile ? "11px" : "12px",
            fontWeight: 800,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: activeTab === "LEDGER" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "transparent",
            color: activeTab === "LEDGER" ? "#000" : "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all 0.2s"
          }}
        >
          <Clock size={14} /> MT5 TRADE RECORD JOURNAL ({tradesData.total_trades})
        </button>

        <button
          onClick={() => setActiveTab("SETUP")}
          style={{
            padding: isMobile ? "8px 12px" : "8px 18px",
            fontSize: isMobile ? "11px" : "12px",
            fontWeight: 800,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: activeTab === "SETUP" ? "rgba(255, 255, 255, 0.15)" : "transparent",
            color: activeTab === "SETUP" ? "#fff" : "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            whiteSpace: "nowrap",
            transition: "all 0.2s"
          }}
        >
          <Zap size={14} /> MT5 TERMINAL EA SETUP
        </button>
      </div>

      {/* TAB 1: CHART & LIVE ANALYSIS */}
      {activeTab === "ANALYSIS" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.7fr 1fr", gap: "16px" }}>
          
          {/* Main Chart Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            
            {/* Chart Toolbar & Timeframe Selection */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(15, 23, 42, 0.7)",
              borderRadius: "10px",
              padding: "10px 14px",
              border: "1px solid rgba(255,255,255,0.06)",
              flexWrap: "wrap",
              gap: "8px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-dim)", marginRight: "4px" }}>
                  TIMEFRAME:
                </span>
                {["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      background: timeframe === tf ? "#f59e0b" : "rgba(255,255,255,0.05)",
                      color: timeframe === tf ? "#000" : "#94a3b8",
                    }}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", color: "#34d399", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399" }}></span>
                  1s Live Ticks
                </span>
              </div>
            </div>

            {/* Candlestick Chart */}
            <div style={{
              height: isMobile ? "320px" : "440px",
              background: "#020617",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden"
            }}>
              <TradingViewChart
                symbol="XAUUSD"
                timeframe={timeframe}
                candles={candles}
                currentPrice={curPrice}
                indicators={indicators}
              />
            </div>

            {/* Fast & Short-Trading Strategy: Fair Value Gap (FVG) Liquidity Hunter */}
            {fvgData && (
              <div style={{
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Flame size={16} color="#38bdf8" />
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                      ⚡ FAST & SHORT STRATEGY: FAIR VALUE GAP (FVG) LIQUIDITY HUNTER
                    </span>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "#38bdf8"
                    }}>
                      ⚡ ULTRA-SHORT (1m - 5m)
                    </span>
                  </div>

                  <span style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: fvgData.signal === "BUY" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                    color: fvgData.signal === "BUY" ? "#34d399" : "#f87171",
                    border: `1px solid ${fvgData.signal === "BUY" ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`
                  }}>
                    {fvgData.signal} SIGNAL ({fvgData.confidence}% Conviction)
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: "10px", background: "#020617", padding: "12px", borderRadius: "8px" }}>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>ENTRY TARGET</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>${fvgData.entry_price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>QUICK TP (PROFIT)</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#34d399" }}>${fvgData.take_profit.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>PROTECTIVE SL</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#f87171" }}>${fvgData.stop_loss.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>REWARD : RISK</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#f59e0b" }}>{fvgData.reward_risk}x</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--text-muted)" }}>
                  <span>
                    Displacement Gap: <strong>${fvgData.gap_details?.gap_size || "1.80"} pts</strong> • Targets immediate institutional imbalance re-fill.
                  </span>
                  <button
                    onClick={() => handleManualOrder(fvgData.signal === "BUY" ? "BUY" : "SELL", "GAP_FVG")}
                    disabled={isExecuting}
                    style={{
                      padding: "6px 14px",
                      fontSize: "11px",
                      fontWeight: 800,
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      background: fvgData.signal === "BUY" ? "#10b981" : "#ef4444",
                      color: "#fff"
                    }}
                  >
                    ⚡ Fast 1-Click {fvgData.signal} (FVG Scalp)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Execution Controls & Account Telemetry */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* MT5 Demo Account Card */}
            <div style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Zap size={14} color="#f59e0b" />
                  MT5 DEMO ACCOUNT TELEMETRY
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(16,185,129,0.2)", color: "#34d399" }}>
                  MetaQuotes-Demo
                </span>
              </div>

              <div style={{ background: "#020617", borderRadius: "8px", padding: "12px", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Account Login:</span>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#fff" }}>115610153</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Server:</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8" }}>MetaQuotes-Demo</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Balance:</span>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: "#fff" }}>
                    ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Live Equity:</span>
                  <span style={{ fontSize: "14px", fontWeight: 900, color: "#34d399" }}>
                    ${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Hedge Leverage:</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b" }}>1:500 Direct</span>
                </div>
              </div>

              {/* Dynamic Lot Sizing & Bulk Micro-Scalp Optimizer */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                
                {/* Sizing Mode Toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Sliders size={13} color="#f59e0b" />
                    ORDER VOLUME OPTIMIZER:
                  </span>
                  <div style={{ display: "flex", gap: "4px", background: "#020617", padding: "2px", borderRadius: "6px" }}>
                    <button
                      onClick={() => handleToggleVolumeMode("DYNAMIC_AUTO")}
                      style={{
                        padding: "3px 8px",
                        fontSize: "10px",
                        fontWeight: 800,
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        background: volumeData?.mode === "DYNAMIC_AUTO" ? "#f59e0b" : "transparent",
                        color: volumeData?.mode === "DYNAMIC_AUTO" ? "#000" : "#94a3b8"
                      }}
                    >
                      ⚡ Dynamic Auto
                    </button>
                    <button
                      onClick={() => handleToggleVolumeMode("MANUAL_FIXED")}
                      style={{
                        padding: "3px 8px",
                        fontSize: "10px",
                        fontWeight: 800,
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        background: volumeData?.mode === "MANUAL_FIXED" ? "#38bdf8" : "transparent",
                        color: volumeData?.mode === "MANUAL_FIXED" ? "#000" : "#94a3b8"
                      }}
                    >
                      🔒 Manual Fixed
                    </button>
                  </div>
                </div>

                {/* Sizing Details Card */}
                <div style={{ background: "#020617", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                      {volumeData?.mode === "DYNAMIC_AUTO" ? "Optimal Scalp Volume:" : "Selected Manual Volume:"}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 900, color: "#f59e0b" }}>
                      {(volumeData?.mode === "DYNAMIC_AUTO" ? volumeData.recommended_lots : lotSize) || 0.05} Lots
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "6px", borderRadius: "4px" }}>
                      <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>Margin Required: </span>
                      <strong style={{ color: "#fff" }}>
                        ${volumeData?.margin_required_usd || (lotSize * 35.20).toFixed(2)} USD
                      </strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "6px", borderRadius: "4px" }}>
                      <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>Quick Target: </span>
                      <strong style={{ color: "#34d399" }}>
                        +${volumeData?.projected_profit_usd || 17.28} USD
                      </strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "6px", borderRadius: "4px" }}>
                      <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>Target Move: </span>
                      <strong style={{ color: "#38bdf8" }}>
                        +{volumeData?.target_move_points || 2.16} pts
                      </strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "6px", borderRadius: "4px" }}>
                      <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>Risk / Stop: </span>
                      <strong style={{ color: "#f87171" }}>
                        -${volumeData?.projected_risk_usd || 9.60} USD
                      </strong>
                    </div>
                  </div>

                  {volumeData?.mode === "MANUAL_FIXED" ? (
                    <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                      {[0.01, 0.05, 0.10, 0.25, 0.50].map((size) => (
                        <button
                          key={size}
                          onClick={() => setLotSize(size)}
                          style={{
                            flex: 1,
                            padding: "4px",
                            fontSize: "10px",
                            fontWeight: 700,
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            background: lotSize === size ? "#38bdf8" : "rgba(255,255,255,0.05)",
                            color: lotSize === size ? "#000" : "#94a3b8"
                          }}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic", lineHeight: 1.3 }}>
                      {volumeData?.sizing_reasoning || "Dynamic sizing calibrated to live Gold volatility and conviction."}
                    </div>
                  )}
                </div>

                {/* SUB-DOLLAR MILLISECOND MICRO-BURST SCALPER & REAL-TIME ORDER FLOW TAPE */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  padding: "12px",
                  borderRadius: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 900, color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Zap size={13} color="#f59e0b" />
                      SUB-DOLLAR MICRO-BURST SCALPER (+$0.50-$1.00 MULTI-TRADE)
                    </span>
                    <span style={{
                      fontSize: "9px",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.3)"
                    }}>
                      ⚡ Level {marketFlowData?.burst_config?.compounding_level || 2} Auto-Compounding
                    </span>
                  </div>

                  {/* Real-Time Order Flow Tape & Delivery Bar */}
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                      <span style={{ color: "#34d399", fontWeight: 800 }}>
                        🟢 Buyers: {marketFlowData?.buyer_volume_pct || 78}%
                      </span>
                      <span style={{ color: "var(--text-dim)", fontWeight: 700 }}>
                        Tape: {marketFlowData?.imbalance_ratio || 3.5}x Imbalance • {marketFlowData?.tick_velocity_per_sec || 32.4} t/s
                      </span>
                      <span style={{ color: "#f87171", fontWeight: 800 }}>
                        🔴 Sellers: {marketFlowData?.seller_volume_pct || 22}%
                      </span>
                    </div>

                    {/* Dual Color Tape Imbalance Progress Bar */}
                    <div style={{ height: "6px", width: "100%", background: "#ef4444", borderRadius: "3px", overflow: "hidden", display: "flex" }}>
                      <div style={{
                        width: `${marketFlowData?.buyer_volume_pct || 78}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                        borderRadius: "3px 0 0 3px",
                        transition: "width 0.4s ease"
                      }} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9px", color: "var(--text-muted)" }}>
                      <span>
                        Delivery: <strong style={{ color: "#fff" }}>{marketFlowData?.delivery_bias?.replace(/_/g, " ") || "INSTITUTIONAL BUYER AGGRESSION"}</strong>
                      </span>
                      <span style={{ color: marketFlowData?.spread_compressed !== false ? "#34d399" : "#f59e0b" }}>
                        Spread: {marketFlowData?.spread_points || 0.15} pts ({marketFlowData?.spread_compressed !== false ? "COMPRESSED" : "NORMAL"})
                      </span>
                      <span>
                        Burst Readiness: <strong style={{ color: "#38bdf8" }}>{marketFlowData?.burst_readiness_score || 94}/100</strong>
                      </span>
                    </div>
                  </div>

                  {/* Burst Sizing & Target Controls */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-dim)", fontWeight: 700 }}>Tickets:</span>
                      {[10, 25, 50].map((count) => (
                        <button
                          key={count}
                          onClick={() => setBurstCount(count)}
                          style={{
                            padding: "3px 7px",
                            fontSize: "10px",
                            fontWeight: 800,
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            background: burstCount === count ? "#f59e0b" : "rgba(255,255,255,0.06)",
                            color: burstCount === count ? "#000" : "#94a3b8"
                          }}
                        >
                          {count}x
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-dim)", fontWeight: 700 }}>Target:</span>
                      {[0.50, 1.00].map((tgt) => (
                        <button
                          key={tgt}
                          onClick={() => setBurstProfitTarget(tgt)}
                          style={{
                            padding: "3px 7px",
                            fontSize: "10px",
                            fontWeight: 800,
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            background: burstProfitTarget === tgt ? "#10b981" : "rgba(255,255,255,0.06)",
                            color: burstProfitTarget === tgt ? "#000" : "#94a3b8"
                          }}
                        >
                          +${tgt.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Projection Strip */}
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                    <span>
                      {burstCount} tickets @ 0.02 lots • Target Move: +{marketFlowData?.burst_config?.target_pts_move || 0.25} pts
                    </span>
                    <strong style={{ color: "#34d399" }}>
                      Projected Gain: +${(burstCount * burstProfitTarget).toFixed(2)} USD in ms
                    </strong>
                  </div>

                  {/* Burst Fire Buttons */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => handleFireMicroBurst("BUY")}
                      disabled={isExecuting}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 900,
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                        color: "#fff",
                        boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)"
                      }}
                    >
                      ⚡ Fire {burstCount}x BUY Burst (+${(burstCount * burstProfitTarget).toFixed(2)})
                    </button>
                    <button
                      onClick={() => handleFireMicroBurst("SELL")}
                      disabled={isExecuting}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 900,
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                        color: "#fff",
                        boxShadow: "0 2px 10px rgba(239, 68, 68, 0.3)"
                      }}
                    >
                      ⚡ Fire {burstCount}x SELL Burst (+${(burstCount * burstProfitTarget).toFixed(2)})
                    </button>
                  </div>
                </div>

                {/* Bulk Wave Scalping Section */}
                <div style={{
                  background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  padding: "10px",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Flame size={12} color="#38bdf8" />
                      BULK MICRO-SCALP HARVESTER (FAST SMALL WINS)
                    </span>
                    <span style={{ fontSize: "9px", fontWeight: 800, padding: "1px 5px", borderRadius: "3px", background: "rgba(56,189,248,0.2)", color: "#38bdf8" }}>
                      3x Waves
                    </span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    Fires 3 rapid staggered micro-entries to capture quick bulk profit without holding long:
                    <strong style={{ color: "#34d399", marginLeft: "4px" }}>
                      Cumulative Target: +${volumeData?.bulk_cumulative_profit_target_usd || 51.84} USD
                    </strong>
                  </div>

                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <button
                      onClick={() => handleBulkWaves("BUY")}
                      disabled={isExecuting}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 900,
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "#fff",
                        boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)"
                      }}
                    >
                      🌊 Bulk BUY Wave (3x)
                    </button>
                    <button
                      onClick={() => handleBulkWaves("SELL")}
                      disabled={isExecuting}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "11px",
                        fontWeight: 900,
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                        color: "#fff",
                        boxShadow: "0 2px 8px rgba(239, 68, 68, 0.25)"
                      }}
                    >
                      🌊 Bulk SELL Wave (3x)
                    </button>
                  </div>
                </div>

                {/* Single 1-Click Execution */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleManualOrder("BUY")}
                    disabled={isExecuting}
                    style={{
                      flex: 1,
                      padding: "10px",
                      fontSize: "12px",
                      fontWeight: 900,
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                      border: "1px solid rgba(16, 185, 129, 0.4)"
                    }}
                  >
                    ⚡ Fast 1-Click BUY
                  </button>
                  <button
                    onClick={() => handleManualOrder("SELL")}
                    disabled={isExecuting}
                    style={{
                      flex: 1,
                      padding: "10px",
                      fontSize: "12px",
                      fontWeight: 900,
                      borderRadius: "6px",
                      cursor: "pointer",
                      background: "rgba(239, 68, 68, 0.2)",
                      color: "#f87171",
                      border: "1px solid rgba(239, 68, 68, 0.4)"
                    }}
                  >
                    ⚡ Fast 1-Click SELL
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Strategy Isolation Controller in Sidebar */}
            <div style={{
              background: "rgba(15, 23, 42, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                <Target size={14} color="#38bdf8" />
                ACTIVE STRATEGY ISOLATION
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                Test each strategy individually to observe its solo win-rate and PnL:
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                <button
                  onClick={() => handleIsolateStrategy("ALL")}
                  style={{
                    padding: "6px 10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    background: isolatedStrategyId === "ALL" ? "rgba(245, 158, 11, 0.2)" : "rgba(255,255,255,0.03)",
                    color: isolatedStrategyId === "ALL" ? "#f59e0b" : "#94a3b8",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <span>🚀 Run All 6 Strategies Together</span>
                  {isolatedStrategyId === "ALL" && <CheckCircle2 size={12} color="#f59e0b" />}
                </button>

                {[
                  { id: "GAP_FVG", name: "⚡ Fair Value Gap Hunter", horizon: "Ultra-Short (1m-5m)" },
                  { id: "SCALPER_EMA", name: "⚡ High-Volume EMA Scalper", horizon: "Ultra-Short (1m-5m)" },
                  { id: "BOLLINGER_REV", name: "🎯 Bollinger Mean Reversion", horizon: "Medium (15m-1h)" },
                  { id: "ORDER_BLOCK", name: "🎯 Order Block Breakout", horizon: "Medium (15m-1h)" },
                  { id: "CONSENSUS_ML", name: "🎯 Machine Learning Consensus", horizon: "Medium (15m-1h)" },
                  { id: "SWING_FLOW", name: "🌊 Trend Swing Flow", horizon: "Long Swing (4h-1D)" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleIsolateStrategy(s.id)}
                    style={{
                      padding: "6px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      background: isolatedStrategyId === s.id ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.03)",
                      color: isolatedStrategyId === s.id ? "#38bdf8" : "#94a3b8",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div>{s.name}</div>
                      <div style={{ fontSize: "9px", color: "var(--text-dim)" }}>{s.horizon}</div>
                    </div>
                    {isolatedStrategyId === s.id && <Lock size={12} color="#38bdf8" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STRATEGY PERFORMANCE MATRIX */}
      {activeTab === "MATRIX" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Header Card */}
          <div style={{
            background: "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff" }}>
                QUANTITATIVE STRATEGY PERFORMANCE MATRIX & ISOLATION
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-dim)", marginTop: "2px" }}>
                Real-time breakdown of profit, loss, win rate, and profit factor for each individual strategy running on XAUUSD MT5.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Allocation Mode:</span>
              <span style={{
                fontSize: "12px",
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: "6px",
                background: allocationsData?.mode === "DYNAMIC_WEIGHTED" ? "rgba(16, 185, 129, 0.2)" : allocationsData?.mode === "SOLO_ISOLATION_100" ? "rgba(56, 189, 248, 0.2)" : "rgba(245, 158, 11, 0.2)",
                color: allocationsData?.mode === "DYNAMIC_WEIGHTED" ? "#34d399" : allocationsData?.mode === "SOLO_ISOLATION_100" ? "#38bdf8" : "#f59e0b"
              }}>
                {allocationsData?.mode === "DYNAMIC_WEIGHTED" ? "⚡ 80/20 DYNAMIC PROFIT-WEIGHTED" : allocationsData?.mode === "SOLO_ISOLATION_100" ? `🎯 100% SOLO: ${isolatedStrategyId}` : "⚖️ EQUAL BALANCED (16.7%)"}
              </span>
            </div>
          </div>

          {/* DYNAMIC 80/20 & PERFORMANCE CAPITAL ALLOCATION ENGINE */}
          <div style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Flame size={16} color="#34d399" />
                  DYNAMIC 80/20 CAPITAL & STRATEGY ALLOCATION ENGINE
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {allocationsData?.summary || "Automatically weights capital & trade frequency by live win-rates. The dominant strategy gets 80% allocation, while runner-ups share 20%."}
                </div>
              </div>

              {/* Mode Switcher Buttons */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => handleToggleAllocationMode("DYNAMIC_WEIGHTED")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: allocationsData?.mode === "DYNAMIC_WEIGHTED" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "rgba(255,255,255,0.06)",
                    color: allocationsData?.mode === "DYNAMIC_WEIGHTED" ? "#fff" : "#94a3b8"
                  }}
                >
                  ⚡ 80/20 Dynamic Auto
                </button>
                <button
                  onClick={() => handleToggleAllocationMode("BALANCED_EQUAL")}
                  style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: allocationsData?.mode === "BALANCED_EQUAL" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" : "rgba(255,255,255,0.06)",
                    color: allocationsData?.mode === "BALANCED_EQUAL" ? "#000" : "#94a3b8"
                  }}
                >
                  ⚖️ Balanced Equal
                </button>
                <button
                  onClick={() => handleToggleAllocationMode("SOLO_ISOLATION_100", isolatedStrategyId === "ALL" ? "GAP_FVG" : isolatedStrategyId)}
                  style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    background: allocationsData?.mode === "SOLO_ISOLATION_100" ? "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)" : "rgba(255,255,255,0.06)",
                    color: allocationsData?.mode === "SOLO_ISOLATION_100" ? "#000" : "#94a3b8"
                  }}
                >
                  🎯 100% Solo Mode
                </button>
              </div>
            </div>

            {/* Allocation Breakdown Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {allocationsData?.allocations?.map((item) => (
                <div
                  key={item.strategy_id}
                  style={{
                    background: item.is_top_performer ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.02)",
                    border: item.is_top_performer ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>
                        {item.name}
                      </span>
                      <span style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: item.horizon.includes("Ultra-Short") ? "rgba(245, 158, 11, 0.2)" : item.horizon.includes("Medium") ? "rgba(56, 189, 248, 0.2)" : "rgba(168, 85, 247, 0.2)",
                        color: item.horizon.includes("Ultra-Short") ? "#f59e0b" : item.horizon.includes("Medium") ? "#38bdf8" : "#c084fc"
                      }}>
                        {item.horizon}
                      </span>
                      {item.is_top_performer && (
                        <span style={{
                          fontSize: "9px",
                          fontWeight: 900,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(16, 185, 129, 0.25)",
                          color: "#34d399",
                          border: "1px solid rgba(16, 185, 129, 0.4)"
                        }}>
                          👑 TOP WINNER (80% ALLOCATED)
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontSize: "11px" }}>
                        <span style={{ color: "var(--text-dim)" }}>Win Rate: </span>
                        <strong style={{ color: "#34d399" }}>{item.win_rate}%</strong>
                      </div>
                      <div style={{ fontSize: "11px" }}>
                        <span style={{ color: "var(--text-dim)" }}>Net PnL: </span>
                        <strong style={{ color: item.net_pnl >= 0 ? "#34d399" : "#f87171" }}>
                          ${item.net_pnl.toFixed(2)}
                        </strong>
                      </div>
                      <div style={{ fontSize: "11px" }}>
                        <span style={{ color: "var(--text-dim)" }}>Lots: </span>
                        <strong style={{ color: "#38bdf8" }}>{item.recommended_lot} Lots</strong>
                      </div>
                      <div style={{ fontSize: "11px" }}>
                        <span style={{ color: "var(--text-dim)" }}>Target / Stop: </span>
                        <strong style={{ color: "#fff" }}>+${item.target_tp_move} / -${item.protective_sl_move}</strong>
                      </div>

                      <button
                        onClick={() => handleToggleAllocationMode("SOLO_ISOLATION_100", item.strategy_id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "10px",
                          fontWeight: 800,
                          borderRadius: "4px",
                          border: "none",
                          cursor: "pointer",
                          background: isolatedStrategyId === item.strategy_id && allocationsData?.mode === "SOLO_ISOLATION_100" ? "#38bdf8" : "rgba(255,255,255,0.08)",
                          color: isolatedStrategyId === item.strategy_id && allocationsData?.mode === "SOLO_ISOLATION_100" ? "#000" : "#fff"
                        }}
                      >
                        {isolatedStrategyId === item.strategy_id && allocationsData?.mode === "SOLO_ISOLATION_100" ? "✓ Active 100% Solo" : "Test 100% Solo"}
                      </button>
                    </div>
                  </div>

                  {/* Percentage Progress Bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      flex: 1,
                      height: "6px",
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: "3px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        width: `${item.allocation_pct}%`,
                        height: "100%",
                        background: item.is_top_performer ? "linear-gradient(90deg, #10b981 0%, #34d399 100%)" : "linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)",
                        borderRadius: "3px",
                        transition: "width 0.4s ease"
                      }} />
                    </div>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 900,
                      color: item.is_top_performer ? "#34d399" : "#38bdf8",
                      minWidth: "45px",
                      textAlign: "right"
                    }}>
                      {item.allocation_pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategy Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px" }}>
            {strategyMatrix.map((s) => (
              <div
                key={s.strategy_id}
                style={{
                  background: "rgba(15, 23, 42, 0.75)",
                  border: s.is_isolated ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  boxShadow: s.is_isolated ? "0 0 20px rgba(56, 189, 248, 0.15)" : "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#fff" }}>{s.name}</div>
                    <div style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: s.horizon.includes("Ultra-Short") ? "#f59e0b" : s.horizon.includes("Medium") ? "#38bdf8" : "#a855f7",
                      marginTop: "2px"
                    }}>
                      {s.horizon} • Base: {s.default_tf}
                    </div>
                  </div>

                  <span style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: s.is_active ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                    color: s.is_active ? "#34d399" : "#64748b"
                  }}>
                    {s.is_active ? "ACTIVE" : "STANDBY"}
                  </span>
                </div>

                <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {s.description}
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "6px",
                  background: "#020617",
                  padding: "10px",
                  borderRadius: "8px"
                }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "var(--text-dim)" }}>TRADES</div>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#fff" }}>{s.total_trades}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "var(--text-dim)" }}>WIN RATE</div>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: "#34d399" }}>{s.win_rate}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "var(--text-dim)" }}>NET PNL</div>
                    <div style={{ fontSize: "12px", fontWeight: 800, color: s.net_pnl >= 0 ? "#34d399" : "#f87171" }}>
                      ${s.net_pnl.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                  <button
                    onClick={() => handleIsolateStrategy(s.strategy_id)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      fontSize: "11px",
                      fontWeight: 800,
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      background: s.is_isolated ? "#38bdf8" : "rgba(255,255,255,0.08)",
                      color: s.is_isolated ? "#000" : "#fff",
                      transition: "all 0.2s"
                    }}
                  >
                    {s.is_isolated ? "✓ Isolating Solo" : "Isolate & Test Solo"}
                  </button>
                  <button
                    onClick={() => handleManualOrder("BUY", s.strategy_id)}
                    style={{
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 800,
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      background: "rgba(16,185,129,0.2)",
                      color: "#34d399"
                    }}
                  >
                    Test BUY
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: MT5 TRADE RECORD JOURNAL */}
      {activeTab === "LEDGER" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Filters Bar: Timeframes, Periods, Strategies */}
          <div style={{
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                <Filter size={15} color="#f59e0b" />
                FILTER MT5 TRADES BY TIMEFRAME & PERIOD
              </div>

              {/* Summary Stats Strip */}
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Total: </span>
                  <strong style={{ color: "#fff" }}>{tradesData.total_trades}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Wins: </span>
                  <strong style={{ color: "#34d399" }}>{tradesData.wins}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Losses: </span>
                  <strong style={{ color: "#f87171" }}>{tradesData.losses}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Win Rate: </span>
                  <strong style={{ color: "#38bdf8" }}>{tradesData.win_rate}%</strong>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Net PnL: </span>
                  <strong style={{ color: tradesData.net_pnl >= 0 ? "#34d399" : "#f87171" }}>
                    ${tradesData.net_pnl.toFixed(2)} USD
                  </strong>
                </div>
              </div>
            </div>

            {/* Filter Pills */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: "12px", background: "#020617", padding: "12px", borderRadius: "8px" }}>
              
              {/* Timeframe Filter */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-dim)", marginBottom: "6px" }}>
                  TIMEFRAME (M1, M5, H1, H4, DAYS, MONTH, WEEK):
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {["all", "m1", "m5", "15m", "h1", "h4", "days", "week", "month"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setLedgerTimeframe(tf)}
                      style={{
                        padding: "3px 8px",
                        fontSize: "10px",
                        fontWeight: 700,
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        background: ledgerTimeframe === tf ? "#f59e0b" : "rgba(255,255,255,0.05)",
                        color: ledgerTimeframe === tf ? "#000" : "#94a3b8"
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Period Filter */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-dim)", marginBottom: "6px" }}>
                  PERIOD HORIZON:
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {["all", "today", "week", "month"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setLedgerPeriod(p)}
                      style={{
                        padding: "3px 8px",
                        fontSize: "10px",
                        fontWeight: 700,
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        textTransform: "uppercase",
                        background: ledgerPeriod === p ? "#38bdf8" : "rgba(255,255,255,0.05)",
                        color: ledgerPeriod === p ? "#000" : "#94a3b8"
                      }}
                    >
                      {p === "all" ? "All Time" : p === "today" ? "Today (Day)" : p === "week" ? "This Week" : "This Month"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Strategy Filter */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-dim)", marginBottom: "6px" }}>
                  STRATEGY FILTER:
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "6px" }}>
                  {[
                    { id: "all", label: "ALL" },
                    { id: "GAP_FVG", label: "FVG" },
                    { id: "SCALPER_EMA", label: "EMA" },
                    { id: "BOLLINGER_REV", label: "BB" },
                    { id: "ORDER_BLOCK", label: "OB" },
                    { id: "CONSENSUS_ML", label: "ML" },
                    { id: "SWING_FLOW", label: "SWING" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setLedgerStrategy(item.id)}
                      style={{
                        padding: "3px 6px",
                        fontSize: "9px",
                        fontWeight: 800,
                        borderRadius: "4px",
                        border: "none",
                        cursor: "pointer",
                        background: ledgerStrategy === item.id ? "#10b981" : "rgba(255,255,255,0.05)",
                        color: ledgerStrategy === item.id ? "#000" : "#94a3b8"
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <select
                  value={ledgerStrategy}
                  onChange={(e) => setLedgerStrategy(e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    color: "#fff",
                    padding: "4px 8px",
                    fontSize: "11px"
                  }}
                >
                  <option value="all">All Strategies</option>
                  <option value="GAP_FVG">Fair Value Gap Hunter (Ultra-Short)</option>
                  <option value="SCALPER_EMA">High-Volume EMA Scalper (Ultra-Short)</option>
                  <option value="BOLLINGER_REV">Bollinger Mean-Reversion (Medium)</option>
                  <option value="ORDER_BLOCK">Order Block Breakout (Medium)</option>
                  <option value="CONSENSUS_ML">ML Consensus (Medium)</option>
                  <option value="SWING_FLOW">Macro Swing Flow (Long)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recorded Trades Table */}
          <div style={{
            background: "rgba(15, 23, 42, 0.75)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            overflow: "hidden"
          }}>
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: isMobile ? "720px" : "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(30, 41, 59, 0.8)", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "var(--text-dim)" }}>
                    <th style={{ padding: "10px 12px" }}>TICKET #</th>
                    <th style={{ padding: "10px 12px" }}>EXEC TIME</th>
                    <th style={{ padding: "10px 12px" }}>SYMBOL</th>
                    <th style={{ padding: "10px 12px" }}>SIDE</th>
                    <th style={{ padding: "10px 12px" }}>LOTS</th>
                    <th style={{ padding: "10px 12px" }}>ENTRY PRICE</th>
                    <th style={{ padding: "10px 12px" }}>CURRENT SPOT</th>
                    <th style={{ padding: "10px 12px" }}>SL / TP</th>
                    <th style={{ padding: "10px 12px" }}>STRATEGY</th>
                    <th style={{ padding: "10px 12px" }}>TIME HORIZON</th>
                    <th style={{ padding: "10px 12px", textAlign: "right" }}>NET PNL ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {tradesData.trades.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: "32px", textAlign: "center", color: "var(--text-dim)" }}>
                        No trades found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    tradesData.trades.map((t) => (
                      <tr key={t.ticket} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: "#38bdf8", fontFamily: "monospace" }}>
                          #{t.ticket}
                        </td>
                        <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>
                          {t.executed_at}
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: "#fff" }}>
                          {t.symbol}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontWeight: 800,
                            fontSize: "10px",
                            background: t.side === "BUY" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                            color: t.side === "BUY" ? "#34d399" : "#f87171"
                          }}>
                            {t.side}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                          {t.lots.toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>
                          ${t.executed_price.toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#fff" }}>
                          ${t.current_price.toFixed(2)}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: "10px", color: "var(--text-dim)" }}>
                          ${t.sl.toFixed(1)} / ${t.tp.toFixed(1)}
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#f59e0b" }}>
                          {t.strategy_name || t.strategy}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "9px",
                            fontWeight: 700,
                            background: t.horizon.includes("Ultra-Short") ? "rgba(245,158,11,0.15)" : "rgba(56,189,248,0.15)",
                            color: t.horizon.includes("Ultra-Short") ? "#f59e0b" : "#38bdf8"
                          }}>
                            {t.horizon}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, fontFamily: "monospace", color: t.pnl >= 0 ? "#34d399" : "#f87171" }}>
                          {t.pnl >= 0 ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SETUP GUIDE */}
      {activeTab === "SETUP" && (
        <div style={{ background: "rgba(15, 23, 42, 0.75)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)", padding: "20px" }}>
          <div style={{ fontSize: "15px", fontWeight: 900, color: "#f59e0b", marginBottom: "8px" }}>
            MetaTrader 5 Expert Advisor Connection & Setup Instructions
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "16px" }}>
            1. Ensure the top MT5 toolbar <strong>Algo Trading</strong> button is <strong>GREEN</strong> (Play icon).<br />
            2. The EA reads direct file signals from <code>MQL5/Files/autobot_orders.txt</code> with zero network dependency.<br />
            3. WebRequest URL is also configured at:
            <div style={{ display: "flex", gap: "8px", marginTop: "6px", alignItems: "center" }}>
              <code style={{ background: "#020617", padding: "6px 12px", borderRadius: "6px", color: "#38bdf8", fontSize: "12px" }}>
                http://127.0.0.1:8000
              </code>
              <button onClick={handleCopyServerUrl} className="btn btn-outline" style={{ padding: "6px 10px", fontSize: "11px" }}>
                {copiedUrl ? "✅ Copied" : "Copy URL"}
              </button>
            </div>
            4. Drag <strong>AutoBot_MT5_BridgeNew</strong> onto your <strong>XAUUSD, M1</strong> chart.<br />
            5. In the Common tab, ensure <strong>Allow Algo Trading</strong> is checked.
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <a
              href="/AutoBot_MT5_BridgeNew.ex5"
              download
              className="btn btn-outline"
              style={{ padding: "8px 14px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}
            >
              <Download size={13} /> Download AutoBot_MT5_BridgeNew.ex5
            </a>
            <a
              href="/AutoBot_MT5_BridgeNew.mq5"
              download
              className="btn btn-outline"
              style={{ padding: "8px 14px", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={13} /> Download Source Code (.mq5)
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
