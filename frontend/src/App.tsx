import React, { useState, useEffect, useRef } from "react";
import {
  Candle,
  IndicatorValues,
  ForecastResponse,
  ReplayResult,
  BotStatus,
  Position,
  PortfolioSummary,
  AccuracyDashboardData,
} from "./types";
import {
  fetchInstruments,
  fetchCandles,
  fetchLiveTick,
  fetchIndicators,
  generatePrediction,
  fetchBotStatus,
  fetchPortfolio,
  fetchPositions,
  fetchAccuracyDashboard,
} from "./api";
import { TradingViewChart } from "./components/TradingViewChart";
import { AutoBotPanel } from "./components/AutoBotPanel";
import { ReplayControlPanel } from "./components/ReplayControlPanel";
import { PredictionCard } from "./components/PredictionCard";
import { PortfolioBlotter } from "./components/PortfolioBlotter";
import { AccuracyDashboard } from "./components/AccuracyDashboard";
import {
  TrendingUp,
  RefreshCw,
  Layers,
  Activity,
  History,
  Wallet,
  Target,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";

export const App: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY 50");
  const [timeframe, setTimeframe] = useState("15m");
  const [activeTab, setActiveTab] = useState<"replay" | "portfolio" | "accuracy">("portfolio");

  // State
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<IndicatorValues[]>([]);
  const [currentForecast, setCurrentForecast] = useState<ForecastResponse | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [accuracyData, setAccuracyData] = useState<AccuracyDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-Sync state
  const [autoSync, setAutoSync] = useState(true);
  const [priceChangeDir, setPriceChangeDir] = useState<"up" | "down" | "flat">("flat");
  const lastPriceRef = useRef<number>(0);

  // Chart Overlay toggles
  const [showEma9, setShowEma9] = useState(true);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);

  // Initial load of full candles & indicators
  const loadMarketData = async () => {
    setLoading(true);
    try {
      const [cData, indData] = await Promise.all([
        fetchCandles(selectedSymbol, timeframe),
        fetchIndicators(selectedSymbol, timeframe),
      ]);
      setCandles(cData);
      setIndicators(indData);

      if (cData.length > 0) {
        lastPriceRef.current = cData[cData.length - 1].close;
      }

      // Generate forecast for current point
      const nowIso = new Date().toISOString();
      const pred = await generatePrediction(selectedSymbol, nowIso, "60m", "ENSEMBLE");
      setCurrentForecast(pred);
    } catch (err) {
      console.error("Error loading market data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync live price tick and update the chart candle
  const syncLiveTick = async () => {
    try {
      const tick = await fetchLiveTick(selectedSymbol);
      if (tick && tick.price) {
        const prevP = lastPriceRef.current;
        if (tick.price > prevP) setPriceChangeDir("up");
        else if (tick.price < prevP) setPriceChangeDir("down");
        lastPriceRef.current = tick.price;

        // Dynamically update the active candle in the candles array
        setCandles((prevCandles) => {
          if (!prevCandles || prevCandles.length === 0) return prevCandles;
          const updated = [...prevCandles];
          const lastIdx = updated.length - 1;
          const last = { ...updated[lastIdx] };

          last.close = tick.price;
          last.high = Math.max(last.high, tick.price);
          last.low = Math.min(last.low, tick.price);
          last.volume = (last.volume || 1000) + 15;
          updated[lastIdx] = last;
          return updated;
        });
      }
    } catch (err) {
      console.error("Live tick error:", err);
    }
  };

  // Sync system state (bot, orders, positions, portfolio)
  const loadSystemState = async () => {
    try {
      const [bStatus, port, pos, acc] = await Promise.all([
        fetchBotStatus(),
        fetchPortfolio(),
        fetchPositions(),
        fetchAccuracyDashboard(),
      ]);
      setBotStatus(bStatus);
      setPortfolio(port);
      setPositions(pos);
      setAccuracyData(acc);
    } catch (err) {
      console.error("Error loading system state:", err);
    }
  };

  // Initial load
  useEffect(() => {
    loadMarketData();
  }, [selectedSymbol, timeframe]);

  // Continuous Auto-Sync Loop (3 seconds interval)
  useEffect(() => {
    loadSystemState();

    if (!autoSync) return;

    const interval = setInterval(async () => {
      await syncLiveTick();
      await loadSystemState();
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedSymbol, autoSync]);

  // Handle replay execution
  const handleReplayExecuted = (result: ReplayResult) => {
    if (result.forecast) {
      setCurrentForecast(result.forecast);
    }
  };

  // Convert positions into chart signal markers
  const signalMarkers = positions
    .filter((p) => p.symbol === selectedSymbol)
    .map((p) => ({
      time: p.opened_at,
      position: (p.side === "LONG" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
      color: p.side === "LONG" ? "#10b981" : "#ef4444",
      shape: (p.side === "LONG" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
      text: `${p.side} @ ${p.entry_price.toFixed(1)}`,
    }));

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : lastPriceRef.current;

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-badge">AutoBots</div>
          <div>
            <div className="brand-title">Quantitative Market Intelligence & Alpha Trading</div>
            <div className="brand-subtitle">Point-in-Time Replay Lab • Automated Paper Trading</div>
          </div>
        </div>

        {/* Live Ticker Strip */}
        <div className="ticker-strip">
          <div className="ticker-item">
            <span style={{ color: "var(--text-dim)" }}>NIFTY 50:</span>
            <span style={{ fontWeight: 700 }}>22,363.35</span>
            <span style={{ color: "var(--bullish-green)" }}>+0.42%</span>
          </div>
          <div className="ticker-item">
            <span style={{ color: "var(--text-dim)" }}>BANK NIFTY:</span>
            <span style={{ fontWeight: 700 }}>48,110.80</span>
            <span style={{ color: "var(--bullish-green)" }}>+0.65%</span>
          </div>
          <div className="ticker-item">
            <span style={{ color: "var(--text-dim)" }}>S&P 500:</span>
            <span style={{ fontWeight: 700 }}>5,780.40</span>
            <span style={{ color: "var(--bullish-green)" }}>+0.31%</span>
          </div>
          <div className="ticker-item">
            <span style={{ color: "var(--text-dim)" }}>GOLD:</span>
            <span style={{ fontWeight: 700 }}>$2,654.10</span>
            <span style={{ color: "var(--bearish-red)" }}>-0.18%</span>
          </div>
        </div>

        {/* Controls */}
        <div className="nav-controls">
          {/* Auto-Sync Toggle */}
          <button
            className={`btn ${autoSync ? "btn-outline" : "btn-outline"}`}
            style={{
              borderColor: autoSync ? "var(--bullish-green)" : "var(--border-subtle)",
              background: autoSync ? "rgba(16, 185, 129, 0.1)" : "transparent",
              color: autoSync ? "var(--bullish-green)" : "var(--text-muted)",
            }}
            onClick={() => setAutoSync(!autoSync)}
            title="Toggle Live Continuous Auto-Sync (3s)"
          >
            <Zap size={14} className={autoSync ? "animate-pulse" : ""} />
            <span>{autoSync ? "LIVE AUTO-SYNC: ON (3s)" : "AUTO-SYNC: OFF"}</span>
          </button>

          <select
            className="select-control"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
          >
            <option value="NIFTY 50">NIFTY 50 (Index)</option>
            <option value="BANK NIFTY">BANK NIFTY (Index)</option>
            <option value="RELIANCE.NS">RELIANCE.NS (NSE)</option>
            <option value="HDFCBANK.NS">HDFCBANK.NS (NSE)</option>
            <option value="^GSPC">S&P 500 (^GSPC)</option>
            <option value="^IXIC">Nasdaq (^IXIC)</option>
            <option value="AAPL">Apple Inc. (AAPL)</option>
            <option value="MSFT">Microsoft (MSFT)</option>
            <option value="GC=F">Gold Futures (GC=F)</option>
          </select>

          <select
            className="select-control"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="1d">1d</option>
          </select>

          <button className="btn btn-outline" onClick={loadMarketData} disabled={loading} title="Manual Reload">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Reload
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="main-content">
        {/* Left Panel: Chart & Analysis Tabs */}
        <section className="left-panel">
          {/* Chart Card */}
          <div className="glass-card" style={{ padding: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800 }}>{selectedSymbol}</span>
                <span
                  style={{
                    fontSize: "16px",
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    color:
                      priceChangeDir === "up"
                        ? "var(--bullish-green)"
                        : priceChangeDir === "down"
                        ? "var(--bearish-red)"
                        : "var(--text-main)",
                    transition: "color 0.2s ease",
                  }}
                >
                  ₹{lastPrice > 0 ? lastPrice.toFixed(2) : "Loading..."}
                </span>
                <span className="pill-badge pill-neutral">
                  <span className="pulse-indicator"></span> LIVE FEED ({timeframe})
                </span>
              </div>

              {/* Indicator Toggles */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  className={`indicator-chip ${showEma9 ? "active" : ""}`}
                  onClick={() => setShowEma9(!showEma9)}
                >
                  EMA 9
                </button>
                <button
                  className={`indicator-chip ${showEma20 ? "active" : ""}`}
                  onClick={() => setShowEma20(!showEma20)}
                >
                  EMA 20
                </button>
                <button
                  className={`indicator-chip ${showEma50 ? "active" : ""}`}
                  onClick={() => setShowEma50(!showEma50)}
                >
                  EMA 50
                </button>
                <button
                  className={`indicator-chip ${showBollinger ? "active" : ""}`}
                  onClick={() => setShowBollinger(!showBollinger)}
                >
                  Bollinger
                </button>
              </div>
            </div>

            {/* TradingView Chart */}
            <TradingViewChart
              candles={candles}
              indicators={indicators}
              showEma9={showEma9}
              showEma20={showEma20}
              showEma50={showEma50}
              showBollinger={showBollinger}
              signalMarkers={signalMarkers}
            />
          </div>

          {/* Module Tabs Navigation */}
          <div className="tabs-nav">
            <button
              className={`tab-btn ${activeTab === "portfolio" ? "active" : ""}`}
              onClick={() => setActiveTab("portfolio")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Wallet size={14} /> Paper Portfolio & Blotter ({positions.filter((p) => p.status === "OPEN").length})
              </div>
            </button>
            <button
              className={`tab-btn ${activeTab === "replay" ? "active" : ""}`}
              onClick={() => setActiveTab("replay")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <History size={14} /> Historical Replay Testing
              </div>
            </button>
            <button
              className={`tab-btn ${activeTab === "accuracy" ? "active" : ""}`}
              onClick={() => setActiveTab("accuracy")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Target size={14} /> Prediction Accuracy Analytics
              </div>
            </button>
          </div>

          {/* Tab Views */}
          {activeTab === "portfolio" && (
            <PortfolioBlotter portfolio={portfolio} positions={positions} />
          )}
          {activeTab === "replay" && (
            <ReplayControlPanel symbol={selectedSymbol} onReplayExecuted={handleReplayExecuted} />
          )}
          {activeTab === "accuracy" && (
            <AccuracyDashboard accuracyData={accuracyData} />
          )}
        </section>

        {/* Right Panel: Auto-Bot & AI Prediction Cards */}
        <aside className="right-panel">
          <AutoBotPanel botStatus={botStatus} onRefresh={loadSystemState} />
          <PredictionCard forecast={currentForecast} />
        </aside>
      </main>
    </div>
  );
};
