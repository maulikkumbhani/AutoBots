import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export const App: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY 50");
  const [timeframe, setTimeframe] = useState("15m");
  const [activeTab, setActiveTab] = useState<"replay" | "portfolio" | "accuracy">("replay");

  // State
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<IndicatorValues[]>([]);
  const [currentForecast, setCurrentForecast] = useState<ForecastResponse | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [accuracyData, setAccuracyData] = useState<AccuracyDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Chart Overlay toggles
  const [showEma9, setShowEma9] = useState(true);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);

  // Load market data & forecast
  const loadMarketData = async () => {
    setLoading(true);
    try {
      const [cData, indData] = await Promise.all([
        fetchCandles(selectedSymbol, timeframe),
        fetchIndicators(selectedSymbol, timeframe),
      ]);
      setCandles(cData);
      setIndicators(indData);

      // Generate forecast for current cutoff
      const nowIso = new Date().toISOString();
      const pred = await generatePrediction(selectedSymbol, nowIso, "60m", "ENSEMBLE");
      setCurrentForecast(pred);
    } catch (err) {
      console.error("Error loading market data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load trading portfolio & bot status
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

  useEffect(() => {
    loadMarketData();
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    loadSystemState();
    // Poll system state every 10 seconds for real-time paper trading updates
    const interval = setInterval(loadSystemState, 10000);
    return () => clearInterval(interval);
  }, []);

  // Handle replay execution
  const handleReplayExecuted = (result: ReplayResult) => {
    if (result.forecast) {
      setCurrentForecast(result.forecast);
    }
    // If replay provides indicators snapshot, we can focus on it
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

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

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
            <span style={{ fontWeight: 700 }}>22,345.20</span>
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

          <button className="btn btn-outline" onClick={loadMarketData} disabled={loading} title="Refresh Live Data">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
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
                <span style={{ fontSize: "14px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                  ₹{lastPrice > 0 ? lastPrice.toFixed(2) : "Loading..."}
                </span>
                <span className="pill-badge pill-neutral">
                  <Activity size={12} /> {timeframe} INTERACTIVE
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
              className={`tab-btn ${activeTab === "replay" ? "active" : ""}`}
              onClick={() => setActiveTab("replay")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <History size={14} /> Historical Replay Testing
              </div>
            </button>
            <button
              className={`tab-btn ${activeTab === "portfolio" ? "active" : ""}`}
              onClick={() => setActiveTab("portfolio")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Wallet size={14} /> Paper Portfolio & Blotter ({positions.filter((p) => p.status === "OPEN").length})
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
          {activeTab === "replay" && (
            <ReplayControlPanel symbol={selectedSymbol} onReplayExecuted={handleReplayExecuted} />
          )}
          {activeTab === "portfolio" && (
            <PortfolioBlotter portfolio={portfolio} positions={positions} />
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
