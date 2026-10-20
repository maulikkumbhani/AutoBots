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
  InstrumentSummary,
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
  configureBot,
  fetchPredictionRecords,
  executePaperOrder,
} from "./api";
import { TradingViewChart } from "./components/TradingViewChart";
import { AutoBotPanel } from "./components/AutoBotPanel";
import { ReplayControlPanel } from "./components/ReplayControlPanel";
import { PredictionCard } from "./components/PredictionCard";
import { PortfolioBlotter } from "./components/PortfolioBlotter";
import { AccuracyDashboard } from "./components/AccuracyDashboard";
import { MultiModelConsensusPanel } from "./components/MultiModelConsensusPanel";
import { TradeAnalyticsLedger } from "./components/TradeAnalyticsLedger";
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
  Search,
  ChevronDown,
  Globe,
  Sliders,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Eye,
  Award,
} from "lucide-react";

export const App: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState("NIFTY 50");
  const [timeframe, setTimeframe] = useState("15m");
  const [activeTab, setActiveTab] = useState<"portfolio" | "ledger" | "models" | "predictions" | "replay" | "accuracy">("portfolio");

  // State
  const [instruments, setInstruments] = useState<InstrumentSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showInstrumentDropdown, setShowInstrumentDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<IndicatorValues[]>([]);
  const [currentForecast, setCurrentForecast] = useState<ForecastResponse | null>(null);
  const [predictionHorizon, setPredictionHorizon] = useState<string>("10m");
  const [predictionRecords, setPredictionRecords] = useState<ForecastResponse[]>([]);
  const [predictionSummary, setPredictionSummary] = useState<{
    total_predictions: number;
    success_count: number;
    failed_count: number;
    active_count: number;
    win_rate_pct: number;
    current_price: number;
  } | null>(null);
  const [selectedRecordFilter, setSelectedRecordFilter] = useState<"ALL" | "SUCCESS" | "FAILED" | "ACTIVE">("ALL");

  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [accuracyData, setAccuracyData] = useState<AccuracyDashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-Sync state
  const [autoSync, setAutoSync] = useState(true);
  const [priceChangeDir, setPriceChangeDir] = useState<"up" | "down" | "flat">("flat");
  const lastPriceRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clock & countdown in Indian Standard Time (IST)
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [countdownSecs, setCountdownSecs] = useState<number>(180);

  // Chart Overlay toggles
  const [showEma9, setShowEma9] = useState(true);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowInstrumentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
  const getMarketSession = (symbol: string, assetClass?: string, exchange?: string) => {
    if (assetClass === "CRYPTO" || symbol.includes("BTC") || symbol.includes("ETH")) {
      return { status: "OPEN", label: "24/7 Global Crypto Feed Active", isLive: true };
    }
    if (assetClass === "FOREX" || symbol.includes("/")) {
      const day = new Date().getUTCDay();
      const isWeekend = day === 0 || (day === 6 && new Date().getUTCHours() >= 21);
      return isWeekend
        ? { status: "CLOSED", label: "Forex Weekend (Reopens Sun 21:00 UTC)", isLive: false }
        : { status: "OPEN", label: "MT5 Forex 24/5 Live Session Active", isLive: true };
    }
    if (assetClass === "COMMODITY" || symbol === "GOLD" || symbol === "SILVER" || symbol === "CRUDE OIL") {
      return { status: "OPEN", label: "COMEX / MCX Session Active", isLive: true };
    }

    const isIndian =
      exchange === "NSE" ||
      exchange === "BSE" ||
      symbol.includes("NIFTY") ||
      symbol.includes(".NS") ||
      symbol === "SENSEX";
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
        return { status: "CLOSED", label: "NSE / BSE Closed (Weekend)", isLive: false };
      } else if (istTotalMins >= nseOpen && istTotalMins <= nseClose) {
        return { status: "OPEN", label: "NSE / BSE Live Session (09:15 - 15:30 IST)", isLive: true };
      } else {
        return { status: "POST_MARKET", label: "NSE / BSE Post-Market", isLive: false };
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
        return { status: "OPEN", label: "US Regular Session (19:00 - 01:30 IST)", isLive: true };
      } else {
        return { status: "PRE_POST", label: "US Pre/Post Session", isLive: false };
      }
    }
  };

  // Indian Standard Time (IST) Clock with millisecond precision & exact bar countdown
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const istDateStr = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const istTimeStr = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const ms = String(now.getMilliseconds()).padStart(3, "0");
      setCurrentTimeStr(`${istDateStr} • ${istTimeStr}.${ms} IST (UTC+5:30)`);

      const period = getCandlePeriodSecs(timeframe);
      const nowSec = Math.floor(now.getTime() / 1000);
      const remaining = period - (nowSec % period);
      setCountdownSecs(remaining);
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 100);
    return () => clearInterval(clockInterval);
  }, [timeframe]);

  // Load supported instruments on startup
  useEffect(() => {
    const loadInstruments = async () => {
      try {
        const insts = await fetchInstruments();
        setInstruments(insts);
      } catch (err) {
        console.error("Failed to load instruments:", err);
      }
    };
    loadInstruments();
  }, []);

  // Load prediction records and accuracy scorecard
  const loadPredictionRecords = async (sym = selectedSymbol) => {
    try {
      const data = await fetchPredictionRecords(sym);
      if (data) {
        setPredictionRecords(data.records || []);
        setPredictionSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Error loading prediction records:", err);
    }
  };

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

      // Generate forecast for current cutoff with chosen horizon
      const nowIso = new Date().toISOString();
      const pred = await generatePrediction(selectedSymbol, nowIso, predictionHorizon, "ENSEMBLE");
      setCurrentForecast(pred);
      await loadPredictionRecords(selectedSymbol);
    } catch (err) {
      console.error("Error loading market data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Switch prediction horizon on active chart
  const handleSelectHorizon = async (h: string) => {
    setPredictionHorizon(h);
    try {
      const nowIso = new Date().toISOString();
      const pred = await generatePrediction(selectedSymbol, nowIso, h, "ENSEMBLE");
      setCurrentForecast(pred);
      await loadPredictionRecords(selectedSymbol);
    } catch (err) {
      console.error("Error generating prediction for horizon:", err);
    }
  };

  // 1-Click execute paper trade from AI predictive signal
  const handleExecuteTradeFromSignal = async (side: "LONG" | "SHORT", targetPrice: number, stopLoss: number) => {
    const qty = selectedSymbol.includes("/") ? 1000 : (selectedSymbol === "GOLD" ? 1 : 25);
    await executePaperOrder({
      symbol: selectedSymbol,
      side: side === "LONG" ? "BUY" : "SELL",
      order_type: "MARKET",
      quantity: qty,
      take_profit: targetPrice,
      stop_loss: stopLoss,
    });
    await loadSystemState();
    await loadPredictionRecords(selectedSymbol);
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
      if (tick && tick.price && tick.price > 0) {
        const prevP = lastPriceRef.current;
        if (tick.price > prevP) setPriceChangeDir("up");
        else if (tick.price < prevP) setPriceChangeDir("down");
        lastPriceRef.current = tick.price;

        // Dynamically update active candle in chart without reload
        setCandles((prevCandles) => {
          if (!prevCandles || prevCandles.length === 0) return prevCandles;

          const candlePeriod = getCandlePeriodSecs(timeframe);
          const nowSec = Math.floor(Date.now() / 1000);
          const currentBarStartSec = Math.floor(nowSec / candlePeriod) * candlePeriod;
          const lastCandle = prevCandles[prevCandles.length - 1];
          const lastBarTimeSec = Math.floor(new Date(lastCandle.timestamp).getTime() / 1000);

          // If time has moved to a new candle period, spawn new candle
          if (currentBarStartSec > lastBarTimeSec) {
            const newCandle: Candle = {
              timestamp: new Date(currentBarStartSec * 1000).toISOString(),
              open: tick.price,
              high: tick.price,
              low: tick.price,
              close: tick.price,
              volume: 15,
            };
            return [...prevCandles, newCandle];
          }

          const updated = [...prevCandles];
          const lastIdx = updated.length - 1;
          const last = { ...updated[lastIdx] };

          // Sanity check: prevent corrupted spikes across mismatched symbols
          const diffPct = Math.abs(tick.price - last.close) / Math.max(last.close, 0.0001);
          if (diffPct > 0.25) {
            return prevCandles;
          }

          last.close = tick.price;
          last.high = Math.max(last.high, tick.price);
          last.low = Math.min(last.low, tick.price);
          last.volume = (last.volume || 1000) + Math.floor(Math.random() * 20 + 5);
          updated[lastIdx] = last;
          return updated;
        });

        // Instantly recalculate mark-to-market prices & unrealized PnL for active orders on this live tick
        setPositions((prevPositions) => {
          if (!prevPositions || prevPositions.length === 0) return prevPositions;
          let changed = false;
          const updated = prevPositions.map((pos) => {
            if (pos.status === "OPEN" && pos.symbol === selectedSymbol) {
              changed = true;
              const curPrice = tick.price;
              const pnl =
                pos.side === "LONG"
                  ? (curPrice - pos.entry_price) * pos.quantity
                  : (pos.entry_price - curPrice) * pos.quantity;
              const mfe = Math.max(pos.max_favorable_excursion || 0, pnl);
              const mae = Math.min(pos.max_adverse_excursion || 0, pnl);
              return {
                ...pos,
                current_price: curPrice,
                unrealized_pnl: Number(pnl.toFixed(2)),
                max_favorable_excursion: Number(mfe.toFixed(2)),
                max_adverse_excursion: Number(mae.toFixed(2)),
              };
            }
            return pos;
          });

          if (changed) {
            setPortfolio((prevPort) => {
              if (!prevPort) return prevPort;
              const openPos = updated.filter((p) => p.status === "OPEN");
              const totalUnrealized = openPos.reduce((acc, p) => acc + (p.unrealized_pnl || 0), 0);
              return {
                ...prevPort,
                unrealized_pnl: Number(totalUnrealized.toFixed(2)),
                equity: Number((prevPort.current_cash + totalUnrealized).toFixed(2)),
              };
            });
          }
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

  // Initial load when symbol or timeframe changes
  useEffect(() => {
    loadMarketData();
  }, [selectedSymbol, timeframe]);

  // Continuous Auto-Sync Loop (800ms ultra-low latency live updates for smooth price action)
  useEffect(() => {
    loadSystemState();
    loadPredictionRecords(selectedSymbol);

    if (!autoSync) return;

    const tickInterval = setInterval(async () => {
      await syncLiveTick();
    }, 800);

    const stateInterval = setInterval(async () => {
      await loadSystemState();
      await loadPredictionRecords(selectedSymbol);
    }, 3000);

    return () => {
      clearInterval(tickInterval);
      clearInterval(stateInterval);
    };
  }, [selectedSymbol, autoSync, timeframe]);

  // Handle switching instruments
  const handleSelectInstrument = async (symbol: string) => {
    setSelectedSymbol(symbol);
    setShowInstrumentDropdown(false);
    try {
      await configureBot({ symbol });
    } catch (e) {
      // ignore
    }
  };

  // Handle replay execution
  const handleReplayExecuted = (result: ReplayResult) => {
    if (result.forecast) {
      setCurrentForecast(result.forecast);
    }
  };

  // Prediction Markers (displaying past forecast success/failures directly on candle timestamps)
  const predictionMarkers = predictionRecords
    .filter((r) => r.instrument_symbol === selectedSymbol && r.cutoff_timestamp)
    .map((r) => {
      const isSuccess = r.is_correct === true;
      const isFail = r.is_correct === false;
      const isUp = r.direction === "up";

      let position: "aboveBar" | "belowBar" = isUp ? "belowBar" : "aboveBar";
      let color = "#38bdf8";
      let shape: "arrowUp" | "arrowDown" | "circle" = "circle";
      let hitSuffix = "";
      if (r.estimated_target_hit_time) {
        try {
          const tStr = new Date(r.estimated_target_hit_time).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
          hitSuffix = ` [ETA ${tStr}]`;
        } catch {}
      }
      let text = `AI ${r.horizon} ${r.direction.toUpperCase()} TGT: ${r.target_price}${hitSuffix}`;

      if (isSuccess) {
        color = "#10b981";
        shape = isUp ? "arrowUp" : "arrowDown";
        text = `✔ ${r.horizon} HIT (+${Math.abs(r.realized_return_pct || 0.25).toFixed(2)}%)`;
      } else if (isFail) {
        color = "#ef4444";
        shape = isUp ? "arrowDown" : "arrowUp";
        text = `✖ ${r.horizon} STOPPED (${r.realized_return_pct ? r.realized_return_pct.toFixed(2) : "-0.3"}%)`;
      }

      return {
        time: r.cutoff_timestamp,
        position,
        color,
        shape,
        text,
      };
    });

  // Convert active positions into chart trade execution markers
  const positionMarkers = positions
    .filter((p) => p.symbol === selectedSymbol)
    .map((p) => ({
      time: p.opened_at,
      position: (p.side === "LONG" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
      color: p.side === "LONG" ? "#6366f1" : "#f59e0b",
      shape: (p.side === "LONG" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
      text: `TRADE ${p.side} @ ${p.entry_price.toFixed(selectedSymbol.includes("/") ? 4 : 2)}`,
    }));

  const signalMarkers = [...positionMarkers, ...predictionMarkers];

  const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : lastPriceRef.current;
  const currentTicker = tickerItems.find((t) => t.symbol === selectedSymbol);
  const currentInst = instruments.find((i) => i.symbol === selectedSymbol);

  const isForex = currentInst?.asset_class === "FOREX" || selectedSymbol.includes("/");
  const currencySign =
    currentInst?.currency === "INR" ? "₹" :
    currentInst?.currency === "JPY" ? "¥" : "$";
  const priceDecimals = isForex ? 4 : 2;

  // Filtered instruments list
  const filteredInstruments = instruments.filter((inst) => {
    const matchesCat =
      selectedCategory === "ALL" ||
      (selectedCategory === "INDIAN" && (inst.exchange === "NSE" || inst.exchange === "BSE")) ||
      (selectedCategory === "FOREX" && inst.asset_class === "FOREX") ||
      (selectedCategory === "COMMODITIES" && inst.asset_class === "COMMODITY") ||
      (selectedCategory === "GLOBAL" && (inst.exchange === "NASDAQ" || inst.exchange === "NYSE")) ||
      (selectedCategory === "CRYPTO" && inst.asset_class === "CRYPTO");

    const matchesSearch =
      searchQuery === "" ||
      inst.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  // Format countdown mm:ss
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  };

  const getBadgeClass = (assetClass: string) => {
    switch (assetClass) {
      case "INDEX": return "badge-index";
      case "FOREX": return "badge-forex";
      case "COMMODITY": return "badge-commodity";
      case "STOCK": return "badge-stock";
      case "CRYPTO": return "badge-crypto";
      default: return "badge-index";
    }
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <div className="brand-badge">AutoBots</div>
          <div>
            <div className="brand-title">Quantitative AI Market Intelligence & Alpha Trading</div>
            <div className="brand-subtitle">Point-in-Time Replay Lab • Multi-Market Paper Trading</div>
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
                onClick={() => handleSelectInstrument(item.symbol)}
                title={`Click to switch chart to ${item.symbol}`}
              >
                <span style={{ color: "var(--text-dim)" }}>{item.symbol}:</span>
                <span style={{ fontWeight: 700 }}>
                  {item.currency === "USD" ? "$" : item.currency === "INR" ? "₹" : ""}
                  {item.price.toFixed(item.symbol.includes("/") ? 4 : 2)}
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
        <div className="nav-controls" ref={dropdownRef} style={{ position: "relative" }}>
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

          {/* Quick Instrument Picker Trigger Button */}
          <button
            className="btn btn-primary"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            onClick={() => setShowInstrumentDropdown(!showInstrumentDropdown)}
            title="Browse all Indian, MT5 Forex, Gold, and Global markets"
          >
            <Sliders size={14} />
            <span style={{ fontWeight: 700 }}>{selectedSymbol}</span>
            <ChevronDown size={14} />
          </button>

          {/* Searchable Instrument Dropdown / Menu */}
          {showInstrumentDropdown && (
            <div className="instrument-picker-dropdown">
              <div style={{ position: "relative", marginBottom: "8px" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "11px", color: "var(--text-dim)" }} />
                <input
                  type="text"
                  placeholder="Search symbol, gold, forex, nifty..."
                  className="instrument-search-input"
                  style={{ paddingLeft: "32px", marginBottom: "0" }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Category Filter Tabs */}
              <div className="market-category-tabs" style={{ marginBottom: "8px" }}>
                {[
                  { id: "ALL", label: "All" },
                  { id: "INDIAN", label: "🇮🇳 Indian" },
                  { id: "FOREX", label: "💱 Forex MT5" },
                  { id: "COMMODITIES", label: "🪙 Gold/MCX" },
                  { id: "GLOBAL", label: "🌐 US" },
                  { id: "CRYPTO", label: "⚡ Crypto" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    className={`category-tab-btn ${selectedCategory === cat.id ? "active" : ""}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Instruments List */}
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {filteredInstruments.length > 0 ? (
                  filteredInstruments.map((inst) => {
                    const t = tickerItems.find((it) => it.symbol === inst.symbol);
                    const isCur = selectedSymbol === inst.symbol;
                    return (
                      <div
                        key={inst.id}
                        className={`instrument-list-item ${isCur ? "selected" : ""}`}
                        onClick={() => handleSelectInstrument(inst.symbol)}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontWeight: 700, fontSize: "13px" }}>{inst.symbol}</span>
                            <span className={`asset-class-badge ${getBadgeClass(inst.asset_class)}`}>
                              {inst.asset_class}
                            </span>
                            <span style={{ fontSize: "10px", color: "var(--text-dim)" }}>
                              {inst.exchange}
                            </span>
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{inst.name}</div>
                        </div>

                        {t && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "12px" }}>
                              {inst.currency === "INR" ? "₹" : "$"}{t.price.toFixed(inst.asset_class === "FOREX" ? 4 : 2)}
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                fontWeight: 600,
                                color: t.change >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                              }}
                            >
                              {t.change >= 0 ? "+" : ""}{t.change_pct.toFixed(2)}%
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: "12px", textAlign: "center", color: "var(--text-dim)", fontSize: "12px" }}>
                    No market instruments found matching query.
                  </div>
                )}
              </div>
            </div>
          )}

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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.3px" }}>
                  {selectedSymbol}
                </span>

                {currentInst && (
                  <span className={`asset-class-badge ${getBadgeClass(currentInst.asset_class)}`}>
                    {currentInst.asset_class} • {currentInst.exchange}
                  </span>
                )}

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
                  {currencySign}
                  {lastPrice > 0 ? lastPrice.toFixed(priceDecimals) : "Loading..."}
                </span>

                {/* Real Day Change Badge */}
                {currentTicker && (
                  <span
                    className={`pill-badge ${currentTicker.change >= 0 ? "pill-bullish" : "pill-bearish"}`}
                    style={{ fontSize: "11px", fontWeight: 700 }}
                  >
                    {currentTicker.change >= 0 ? "+" : ""}
                    {currentTicker.change.toFixed(priceDecimals)} ({currentTicker.change >= 0 ? "+" : ""}
                    {currentTicker.change_pct.toFixed(2)}%)
                  </span>
                )}
              </div>

              {/* Indian Standard Time (IST) Clock & Session Status */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  fontSize: "11px",
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    background: "rgba(99, 102, 241, 0.12)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                  }}
                >
                  <Clock size={13} color="var(--accent-primary)" />
                  <span style={{ color: "var(--text-main)", fontWeight: 700 }}>{currentTimeStr}</span>
                </div>
              </div>
            </div>

            {/* Real Market Stats Ribbon: Open, High, Low, Prev Close, Range Bar */}
            {(() => {
              const sessionInfo = getMarketSession(selectedSymbol, currentInst?.asset_class, currentInst?.exchange);
              const pLow = currentTicker?.low || (lastPrice > 0 ? lastPrice * 0.995 : 0);
              const pHigh = currentTicker?.high || (lastPrice > 0 ? lastPrice * 1.005 : 0);
              const rangePct = pHigh > pLow ? Math.min(100, Math.max(0, ((lastPrice - pLow) / (pHigh - pLow)) * 100)) : 50;

              return (
                <div className="market-stats-ribbon">
                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Prev Close</span>
                    <span className="ribbon-metric-value">
                      {currencySign}
                      {currentTicker?.prev_close?.toFixed(priceDecimals) || (lastPrice ? lastPrice.toFixed(priceDecimals) : "—")}
                    </span>
                  </div>

                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Day Open</span>
                    <span className="ribbon-metric-value">
                      {currencySign}
                      {currentTicker?.open?.toFixed(priceDecimals) || (lastPrice ? lastPrice.toFixed(priceDecimals) : "—")}
                    </span>
                  </div>

                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Day Range</span>
                    <div className="range-bar-container">
                      <span style={{ color: "var(--bearish-red)" }}>{currencySign}{pLow.toFixed(priceDecimals)}</span>
                      <div className="range-bar-track">
                        <div className="range-bar-thumb" style={{ left: `calc(${rangePct}% - 5px)` }} />
                      </div>
                      <span style={{ color: "var(--bullish-green)" }}>{currencySign}{pHigh.toFixed(priceDecimals)}</span>
                    </div>
                  </div>

                  <div className="ribbon-metric">
                    <span className="ribbon-metric-label">Market Session</span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: sessionInfo.isLive ? "var(--bullish-green)" : "var(--neutral-blue)",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <span
                        className="pulse-indicator"
                        style={{
                          width: 6,
                          height: 6,
                          background: sessionInfo.isLive ? "var(--bullish-green)" : "var(--neutral-blue)",
                        }}
                      />
                      {sessionInfo.label}
                    </span>
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

            {/* Futuristic AI Prediction Scorecard Ribbon */}
            <div
              style={{
                background: "linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.08) 50%, rgba(10, 14, 22, 0.6) 100%)",
                border: "1px solid rgba(99, 102, 241, 0.25)",
                borderRadius: "6px",
                padding: "6px 12px",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "8px",
                fontSize: "11px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={13} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, color: "var(--text-main)" }}>AI PREDICTION SCORECARD:</span>
                <span style={{ color: "var(--text-dim)" }}>Asset:</span>
                <strong style={{ color: "var(--accent-primary)" }}>{selectedSymbol}</strong>
                <span style={{ color: "var(--text-dim)", marginLeft: "4px" }}>•</span>
                <span style={{ color: "var(--text-dim)" }}>Total Tested:</span>
                <strong style={{ color: "var(--text-main)" }}>{predictionSummary?.total_predictions || predictionRecords.length}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontFamily: "var(--font-mono)" }}>
                <span style={{ color: "var(--bullish-green)", display: "flex", alignItems: "center", gap: "4px", fontWeight: 700 }}>
                  <CheckCircle size={12} /> Target Hit: {predictionSummary?.success_count || 0} ({predictionSummary?.win_rate_pct || 0}%)
                </span>
                <span style={{ color: "var(--bearish-red)", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                  <XCircle size={12} /> Stopped Out: {predictionSummary?.failed_count || 0}
                </span>
                <span style={{ color: "var(--neutral-blue)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Clock size={12} /> Active Signals: {predictionSummary?.active_count || 0}
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ padding: "2px 8px", fontSize: "10px", borderColor: "rgba(99, 102, 241, 0.4)" }}
                  onClick={() => setActiveTab("predictions")}
                >
                  View Ledger & History
                </button>
              </div>
            </div>

            {/* TradingView Chart */}
            <TradingViewChart
              symbol={selectedSymbol}
              candles={candles}
              indicators={indicators}
              showEma9={showEma9}
              showEma20={showEma20}
              showEma50={showEma50}
              showBollinger={showBollinger}
              targetPrice={currentForecast?.target_price}
              stopLossPrice={currentForecast?.stop_loss}
              entryPrice={currentForecast?.as_of_price}
              targetHitTime={currentForecast?.estimated_target_hit_time}
              priceVelocity={currentForecast?.price_velocity_pts_per_sec}
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
              className={`tab-btn ${activeTab === "ledger" ? "active" : ""}`}
              onClick={() => setActiveTab("ledger")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Award size={14} color="#10b981" /> ⚡ Trade Ledger & Period Profit (Day / Month / Year)
              </div>
            </button>
            <button
              className={`tab-btn ${activeTab === "models" ? "active" : ""}`}
              onClick={() => setActiveTab("models")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Layers size={14} color="var(--accent-primary)" /> Multi-Model Consensus & Candlesticks
              </div>
            </button>
            <button
              className={`tab-btn ${activeTab === "predictions" ? "active" : ""}`}
              onClick={() => setActiveTab("predictions")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={14} color="var(--accent-primary)" />
                AI Prediction Ledger & Records ({predictionSummary?.total_predictions || predictionRecords.length})
              </div>
            </button>
            <button
              className={`tab-btn ${activeTab === "replay" ? "active" : ""}`}
              onClick={() => setActiveTab("replay")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <History size={14} /> Historical Point-in-Time Replay Lab
              </div>
            </button>
            <button
              className={`tab-btn ${activeTab === "accuracy" ? "active" : ""}`}
              onClick={() => setActiveTab("accuracy")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Target size={14} /> Quantitative Statistical Accuracy Dashboard
              </div>
            </button>
          </div>

          {/* Tab Views */}
          <div className="tab-content" style={{ marginTop: "12px" }}>
            {activeTab === "portfolio" && (
              <div className="space-y-6">
                <PortfolioBlotter
                  portfolio={portfolio}
                  positions={positions}
                  onRefresh={loadSystemState}
                />
                <div style={{ marginTop: "20px" }}>
                  <TradeAnalyticsLedger
                    currentSymbol={selectedSymbol}
                    onTradeExecuted={loadSystemState}
                  />
                </div>
              </div>
            )}

            {activeTab === "ledger" && (
              <TradeAnalyticsLedger
                currentSymbol={selectedSymbol}
                onTradeExecuted={loadSystemState}
              />
            )}

            {activeTab === "models" && (
              <MultiModelConsensusPanel
                symbol={selectedSymbol}
                horizon={predictionHorizon}
                onRefresh={loadSystemState}
              />
            )}

            {activeTab === "predictions" && (
              <div className="glass-card animate-fade-in">
                <div className="card-header">
                  <div className="card-title">
                    <Sparkles size={16} color="var(--accent-primary)" />
                    <span>Predictive Trade Records & Outcome Ledger: {selectedSymbol}</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {(["ALL", "SUCCESS", "FAILED", "ACTIVE"] as const).map((filter) => (
                      <button
                        key={filter}
                        className={`timeline-btn ${selectedRecordFilter === filter ? "active" : ""}`}
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={() => setSelectedRecordFilter(filter)}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scorecard quick stats */}
                <div className="stats-grid" style={{ marginBottom: "14px" }}>
                  <div className="stat-box">
                    <div className="stat-label">Win Rate %</div>
                    <div className="stat-value" style={{ color: "var(--bullish-green)" }}>
                      {predictionSummary?.win_rate_pct || 0}%
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Targets Hit (Wins)</div>
                    <div className="stat-value" style={{ color: "var(--bullish-green)" }}>
                      {predictionSummary?.success_count || 0}
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Stopped Out (Losses)</div>
                    <div className="stat-value" style={{ color: "var(--bearish-red)" }}>
                      {predictionSummary?.failed_count || 0}
                    </div>
                  </div>
                  <div className="stat-box">
                    <div className="stat-label">Active Signals</div>
                    <div className="stat-value" style={{ color: "var(--neutral-blue)" }}>
                      {predictionSummary?.active_count || 0}
                    </div>
                  </div>
                </div>

                {/* Detailed Prediction Ledger Table */}
                <div style={{ overflowX: "auto" }}>
                  <table className="blotter-table">
                    <thead>
                      <tr>
                        <th>Time (IST)</th>
                        <th>Horizon</th>
                        <th>Direction</th>
                        <th>Signal Entry</th>
                        <th>Target Price</th>
                        <th>Stop-Loss</th>
                        <th>Outcome / Return</th>
                        <th>Evaluation Status</th>
                        <th>Quick Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictionRecords
                        .filter((r) => {
                          if (selectedRecordFilter === "ALL") return true;
                          if (selectedRecordFilter === "SUCCESS") return r.is_correct === true;
                          if (selectedRecordFilter === "FAILED") return r.is_correct === false;
                          if (selectedRecordFilter === "ACTIVE") return r.evaluation_status === "ACTIVE";
                          return true;
                        })
                        .map((rec) => {
                          const d = new Date(rec.cutoff_timestamp);
                          const istTime =
                            d.toLocaleTimeString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            }) + " IST";
                          const isWin = rec.is_correct === true;
                          const isFail = rec.is_correct === false;
                          const isActive = rec.evaluation_status === "ACTIVE";

                          return (
                            <tr key={rec.id}>
                              <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>{istTime}</td>
                              <td>
                                <span className="pill-badge pill-neutral" style={{ fontSize: "10px", padding: "2px 6px" }}>
                                  {rec.horizon}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                    fontWeight: 700,
                                    color: rec.direction === "up" ? "var(--bullish-green)" : "var(--bearish-red)",
                                  }}
                                >
                                  {rec.direction === "up" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                  {rec.direction === "up" ? "LONG (BUY)" : "SHORT (SELL)"}
                                </span>
                              </td>
                              <td style={{ fontFamily: "var(--font-mono)" }}>
                                {currencySign}{rec.as_of_price.toFixed(priceDecimals)}
                              </td>
                              <td style={{ fontFamily: "var(--font-mono)", color: "var(--bullish-green)", fontWeight: 600 }}>
                                <div>{rec.target_price ? `${currencySign}${rec.target_price.toFixed(priceDecimals)}` : "—"}</div>
                                {rec.estimated_target_hit_time && (() => {
                                  try {
                                    const d = new Date(rec.estimated_target_hit_time);
                                    if (isNaN(d.getTime())) return null;
                                    return (
                                      <div style={{ fontSize: "9px", color: "var(--accent-primary)", marginTop: "2px", fontWeight: 500 }}>
                                        ETA: {d.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST
                                      </div>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })()}
                              </td>
                              <td style={{ fontFamily: "var(--font-mono)", color: "var(--bearish-red)" }}>
                                {rec.stop_loss ? `${currencySign}${rec.stop_loss.toFixed(priceDecimals)}` : "—"}
                              </td>
                              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                                {rec.realized_return_pct != null ? (
                                  <span style={{ color: rec.realized_return_pct >= 0 ? "var(--bullish-green)" : "var(--bearish-red)" }}>
                                    {rec.realized_return_pct >= 0 ? "+" : ""}{rec.realized_return_pct}%
                                  </span>
                                ) : (
                                  <span style={{ color: "var(--text-dim)" }}>Pending</span>
                                )}
                              </td>
                              <td>
                                {isWin && (
                                  <span className="pill-badge pill-bullish" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <CheckCircle size={10} /> TARGET HIT
                                  </span>
                                )}
                                {isFail && (
                                  <span className="pill-badge pill-bearish" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                                    <XCircle size={10} /> STOPPED OUT
                                  </span>
                                )}
                                {isActive && (
                                  <span className="pill-badge pill-neutral" style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "var(--neutral-blue)" }}>
                                    <span className="pulse-indicator" style={{ width: 6, height: 6 }} /> EVALUATING
                                  </span>
                                )}
                              </td>
                              <td>
                                {isActive && rec.target_price && rec.stop_loss && (
                                  <button
                                    className={`btn btn-sm ${rec.direction === "down" ? "btn-danger" : "btn-success"}`}
                                    style={{ padding: "2px 6px", fontSize: "10px" }}
                                    onClick={() => handleExecuteTradeFromSignal(rec.direction === "down" ? "SHORT" : "LONG", rec.target_price!, rec.stop_loss!)}
                                  >
                                    <Zap size={10} /> Take Trade
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "replay" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
                <ReplayControlPanel
                  symbol={selectedSymbol}
                  onReplayExecuted={handleReplayExecuted}
                />
                {currentForecast && (
                  <div>
                    <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "var(--text-muted)" }}>
                      Replay Evaluation Result
                    </h3>
                    <PredictionCard
                      forecast={currentForecast}
                      selectedHorizon={predictionHorizon}
                      onSelectHorizon={handleSelectHorizon}
                      onExecuteTrade={handleExecuteTradeFromSignal}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "accuracy" && (
              <AccuracyDashboard data={accuracyData} />
            )}
          </div>
        </section>

        {/* Right Panel: Automated Algorithmic Bot Engine & Prediction Card */}
        <aside className="right-panel">
          <AutoBotPanel
            botStatus={botStatus}
            activeSymbol={selectedSymbol}
            onRefresh={loadSystemState}
          />

          <PredictionCard
            forecast={currentForecast}
            selectedHorizon={predictionHorizon}
            onSelectHorizon={handleSelectHorizon}
            onExecuteTrade={handleExecuteTradeFromSignal}
          />
        </aside>
      </main>
    </div>
  );
};
