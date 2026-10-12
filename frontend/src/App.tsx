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
  TickerItem,
} from "./types";
import {
  fetchInstruments,
  fetchCandles,
  fetchLiveTick,
  fetchTickerStrip,
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
  Calendar,
} from "lucide-react";

export const App: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY 50");
  const [timeframe, setTimeframe] = useState("15m");
  const [activeTab, setActiveTab] = useState<"portfolio" | "replay" | "accuracy">("portfolio");

  // State
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
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

  // Clock & countdown
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [countdownSecs, setCountdownSecs] = useState<number>(180);

  // Chart Overlay toggles
  const [showEma9, setShowEma9] = useState(true);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);

  // Candle timeframe duration in seconds
  const getCandlePeriodSecs = (tf: string): number => {
    switch (tf.toLowerCase()) {
      case "1m": return 60;
      case "5m": return 300;
      case "15m": return 900;
      case "30m": return 1800;
      case "1h": return 3600;
      case "4h": return 14400;
      case "1d": return 86400;
      case "1w": return 604800;
      default: return 900;
    }
  };

  // Market session detector
  const getMarketSession = (symbol: string) => {
    const isIndian = symbol.includes("NIFTY") || symbol.includes(".NS");
    const now = new Date();
    
    if (isIndian) {
      const utcHours = now.getUTCHours();
      const utcMins = now.getUTCMinutes();
      const istTotalMins = (utcHours * 60 + utcMins + 330) % 1440;
      const nseOpen = 9 * 60 + 15; // 09:15 IST
      const nseClose = 15 * 60 + 30; // 15:30 IST
      const day = now.getUTCDay();
      const isWeekend = day === 0 || day === 6;
      
      if (isWeekend) {
        return { status: "CLOSED", label: "NSE Closed (Weekend)", isLive: false };
      } else if (istTotalMins >= nseOpen && istTotalMins <= nseClose) {
        return { status: "OPEN", label: "NSE Live Market Session", isLive: true };
      } else {
        return { status: "POST_MARKET", label: "NSE Post-Market (Official Close: ₹22,363.35)", isLive: false };
      }
    } else {
      const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const usOpen = 13 * 60 + 30;
      const usClose = 20 * 60;
      const day = now.getUTCDay();
      const isWeekend = day === 0 || day === 6;
      if (isWeekend) {
        return { status: "CLOSED", label: "US Market Closed (Weekend)", isLive: false };
      } else if (utcMinutes >= usOpen && utcMinutes <= usClose) {
        return { status: "OPEN", label: "US Regular Session (Live)", isLive: true };
      } else {
        return { status: "PRE_POST", label: "US Pre/Post Session", isLive: false };
      }
    }
  };

  // Update clock and exact candle countdown every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
          " • " +
          now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }) +
          " IST"
      );
      const period = getCandlePeriodSecs(timeframe);
      const nowSec = Math.floor(now.getTime() / 1000);
      const remaining = period - (nowSec % period);
      setCountdownSecs(remaining);
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, [timeframe]);

  // Load market data & forecast
  const loadMarketData = async () => {
    setLoading(true);
    try {
      const [cData, indData, tickers] = await Promise.all([
        fetchCandles(selectedSymbol, timeframe),
        fetchIndicators(selectedSymbol, timeframe),
        fetchTickerStrip(),
      ]);
      setCandles(cData);
      setIndicators(indData);
      setTickerItems(tickers);

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
      const [tick, tickers] = await Promise.all([
        fetchLiveTick(selectedSymbol),
        fetchTickerStrip(),
      ]);
      if (tickers && tickers.length > 0) {
        setTickerItems(tickers);
      }
      if (tick && tick.price) {
        const prevP = lastPriceRef.current;
        if (tick.price > prevP) setPriceChangeDir("up");
        else if (tick.price < prevP) setPriceChangeDir("down");
        lastPriceRef.current = tick.price;

        // Dynamically update active candle in chart without reload
        setCandles((prevCandles) => {
          if (!prevCandles || prevCandles.length === 0) return prevCandles;
          const updated = [...prevCandles];
          const lastIdx = updated.length - 1;
          const last = { ...updated[lastIdx] };

          last.close = tick.price;
          last.high = Math.max(last.high, tick.price);
          last.low = Math.min(last.low, tick.price);
          last.volume = (last.volume || 1000) + 12;
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
      text: `${p.side} @ ₹${p.entry_price.toFixed(1)}`,
    }));

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : lastPriceRef.current;
  const currentTicker = tickerItems.find((t) => t.symbol === selectedSymbol);

  // Format countdown mm:ss
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  };

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

        {/* Live Real Ticker Strip */}
        <div className="ticker-strip">
          {tickerItems.length > 0 ? (
            tickerItems.map((item) => (
              <div
                key={item.symbol}
                className="ticker-item"
                style={{
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: selectedSymbol === item.symbol ? "rgba(99, 102, 241, 0.2)" : "transparent",
                }}
                onClick={() => setSelectedSymbol(item.symbol)}
                title={`Click to switch chart to ${item.symbol}`}
              >
                <span style={{ color: "var(--text-dim)" }}>{item.symbol}:</span>
                <span style={{ fontWeight: 700 }}>
                  {item.currency === "USD" ? "$" : "₹"}
                  {item.price.toFixed(2)}
                </span>
                <span
                  style={{
                    color: item.change >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                    fontWeight: 600,
                  }}
                >
                  {item.change >= 0 ? "+" : ""}
                  {item.change_pct.toFixed(2)}%
                </span>
              </div>
            ))
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: "11px" }}>Loading live market quotes...</div>
          )}
        </div>

        {/* Controls */}
        <div className="nav-controls">
          {/* Auto-Sync Toggle */}
          <button
            className="btn btn-outline"
            style={{
              borderColor: autoSync ? "var(--bullish-green)" : "var(--border-subtle)",
              background: autoSync ? "rgba(16, 185, 129, 0.1)" : "transparent",
              color: autoSync ? "var(--bullish-green)" : "var(--text-muted)",
            }}
            onClick={() => setAutoSync(!autoSync)}
            title="Toggle Live Continuous Auto-Sync (3s)"
          >
            <Zap size={14} className={autoSync ? "animate-pulse" : ""} />
            <span>{autoSync ? "LIVE AUTO-SYNC: ON" : "AUTO-SYNC: PAUSED"}</span>
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
            {/* Top Bar of Chart: Instrument, Live Price, Day Change & Exchange Clock */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.3px" }}>{selectedSymbol}</span>
                <span
                  style={{
                    fontSize: "18px",
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
                  {selectedSymbol.startsWith("^") || selectedSymbol === "AAPL" || selectedSymbol === "MSFT" || selectedSymbol === "GC=F" ? "$" : "₹"}
                  {lastPrice > 0 ? lastPrice.toFixed(2) : "Loading..."}
                </span>

                {/* Real Day Change Badge */}
                {currentTicker && (
                  <span
                    className={`pill-badge ${currentTicker.change >= 0 ? "pill-bullish" : "pill-bearish"}`}
                    style={{ fontSize: "11px", fontWeight: 700 }}
                  >
                    {currentTicker.change >= 0 ? "+" : ""}
                    {currentTicker.change.toFixed(2)} ({currentTicker.change >= 0 ? "+" : ""}
                    {currentTicker.change_pct.toFixed(2)}%)
                  </span>
                )}
              </div>

              {/* Exchange Clock & Session Status */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <Clock size={13} color="var(--accent-primary)" />
                  <span style={{ color: "var(--text-main)", fontWeight: 600 }}>{currentTimeStr}</span>
                </div>
              </div>
            </div>

            {/* Real Market Stats Ribbon: Open, High, Low, Prev Close, Range Bar */}
            {(() => {
              const curSym = selectedSymbol.startsWith("^") || selectedSymbol === "AAPL" || selectedSymbol === "MSFT" || selectedSymbol === "GC=F" ? "$" : "₹";
              const sessionInfo = getMarketSession(selectedSymbol);
              const pLow = currentTicker?.low || (lastPrice > 0 ? lastPrice * 0.995 : 0);
              const pHigh = currentTicker?.high || (lastPrice > 0 ? lastPrice * 1.005 : 0);
              const rangePct = pHigh > pLow ? Math.min(100, Math.max(0, ((lastPrice - pLow) / (pHigh - pLow)) * 100)) : 50;

              return (
                <div className="market-stats-ribbon">
                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Prev Close</span>
                    <span className="ribbon-metric-value">
                      {curSym}{currentTicker?.prev_close?.toFixed(2) || (lastPrice ? lastPrice.toFixed(2) : "—")}
                    </span>
                  </div>

                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Day Open</span>
                    <span className="ribbon-metric-value">
                      {curSym}{currentTicker?.open?.toFixed(2) || (lastPrice ? lastPrice.toFixed(2) : "—")}
                    </span>
                  </div>

                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">24H Range (Low ───●─── High)</span>
                    <div className="range-bar-container">
                      <span style={{ color: "var(--bearish-red)" }}>{curSym}{pLow.toFixed(1)}</span>
                      <div className="range-bar-track">
                        <div className="range-bar-thumb" style={{ left: `calc(${rangePct}% - 5px)` }} />
                      </div>
                      <span style={{ color: "var(--bullish-green)" }}>{curSym}{pHigh.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Exchange Session</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: sessionInfo.isLive ? "var(--bullish-green)" : "var(--neutral-blue)",
                          boxShadow: sessionInfo.isLive ? "0 0 6px var(--bullish-green)" : "none",
                        }}
                      />
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main)" }}>
                        {sessionInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Data Feed</span>
                    <span style={{ fontSize: "11px", color: "var(--bullish-green)", fontWeight: 700 }}>
                      ● Official Real Feed
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Master Timeline & Multi-Granularity Presentation Bar */}
            <div className="timeline-master-bar">
              <div className="timeline-groups-container">
                {/* Realtime / Seconds Group */}
                <div className="timeline-segment">
                  <span className="timeline-segment-label">SEC</span>
                  <button
                    className={`timeline-btn ${autoSync ? "active" : ""}`}
                    onClick={() => setAutoSync(!autoSync)}
                    title="Toggle Live 1-Second Continuous Market Tick Auto-Sync"
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span className="pulse-indicator" style={{ width: 6, height: 6 }} />
                      1s LIVE
                    </span>
                  </button>
                </div>

                {/* Minutes Group */}
                <div className="timeline-segment">
                  <span className="timeline-segment-label">MINUTES</span>
                  {["1m", "5m", "15m", "30m"].map((tf) => (
                    <button
                      key={tf}
                      className={`timeline-btn ${timeframe === tf ? "active" : ""}`}
                      onClick={() => setTimeframe(tf)}
                      title={`Switch to ${tf} candle timeline`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Hours Group */}
                <div className="timeline-segment">
                  <span className="timeline-segment-label">HOURS</span>
                  {["1h", "4h"].map((tf) => (
                    <button
                      key={tf}
                      className={`timeline-btn ${timeframe === tf ? "active" : ""}`}
                      onClick={() => setTimeframe(tf)}
                      title={`Switch to ${tf} candle timeline`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Days & Weeks Group */}
                <div className="timeline-segment">
                  <span className="timeline-segment-label">DAYS</span>
                  {["1d", "1w"].map((tf) => (
                    <button
                      key={tf}
                      className={`timeline-btn ${timeframe === tf ? "active" : ""}`}
                      onClick={() => setTimeframe(tf)}
                      title={`Switch to ${tf.toUpperCase()} candle timeline`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Next Candle Countdown HUD */}
                <div className="timeline-hud-pill">
                  <Clock size={12} color="var(--accent-primary)" />
                  <span style={{ color: "var(--text-dim)" }}>Next Bar:</span>
                  <span style={{ color: "var(--neutral-blue)", fontWeight: 700 }}>
                    {formatCountdown(countdownSecs)}
                  </span>
                </div>
              </div>

              {/* Indicator Overlay Toggles */}
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
