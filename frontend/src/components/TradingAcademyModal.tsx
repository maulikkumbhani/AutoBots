import React, { useState } from "react";
import {
  BookOpen,
  X,
  Zap,
  Shield,
  Layers,
  Clock,
  TrendingUp,
  Cpu,
  Award,
  ExternalLink,
  Download,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Globe,
  Radio,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

interface TradingAcademyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const TradingAcademyModal: React.FC<TradingAcademyModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [activeSection, setActiveSection] = useState<
    "overview" | "market_hours" | "strategies" | "risk_management" | "mt4_mt5" | "faq"
  >("overview");

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1040px",
          maxHeight: "90vh",
          backgroundColor: "#0d1322",
          border: "1px solid rgba(99, 102, 241, 0.35)",
          borderRadius: "16px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.9)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(90deg, rgba(30, 27, 75, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#f8fafc" }}>
                AutoBots Academy & Interactive Trading Guide
              </h2>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                Learn how automated quant models, market hours, risk control, and MT4/MT5 bridges work together
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Sub-Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(10, 15, 26, 0.7)",
            padding: "8px 16px",
            gap: "8px",
            overflowX: "auto",
          }}
        >
          {[
            { id: "overview", label: "1. How AutoBots Works", icon: <Cpu size={14} /> },
            { id: "market_hours", label: "2. Market Hours (NSE vs 24/7)", icon: <Clock size={14} /> },
            { id: "strategies", label: "3. The 6 Quant Strategies", icon: <Zap size={14} /> },
            { id: "risk_management", label: "4. Auto-Exit & Risk Protection", icon: <Shield size={14} /> },
            { id: "mt4_mt5", label: "5. OctaFX MT4 / MT5 Setup", icon: <Globe size={14} /> },
            { id: "faq", label: "6. Frequently Asked Questions", icon: <HelpCircle size={14} /> },
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background:
                  activeSection === sec.id
                    ? "linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(139, 92, 246, 0.35))"
                    : "transparent",
                color: activeSection === sec.id ? "#38bdf8" : "var(--text-muted)",
                boxShadow:
                  activeSection === sec.id
                    ? "inset 0 0 0 1px rgba(99, 102, 241, 0.5)"
                    : "none",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {sec.icon}
              <span>{sec.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", color: "var(--text-main)" }}>
          {/* SECTION 1: OVERVIEW */}
          {activeSection === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(16, 185, 129, 0.1))",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  borderRadius: "12px",
                  padding: "18px",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 8px 0", color: "#38bdf8" }}>
                  💡 What is AutoBots?
                </h3>
                <p style={{ fontSize: "13px", lineHeight: "1.6", margin: 0, color: "#cbd5e1" }}>
                  AutoBots is an institutional-grade quantitative trading platform. It runs autonomous server daemons 
                  that monitor market data 24/7 across <strong>Indian indices (NIFTY 50, BANKNIFTY)</strong>, 
                  <strong>Global Commodities (Gold, Silver)</strong>, <strong>Forex (USD/INR, EUR/USD)</strong>, and <strong>Crypto (Bitcoin)</strong>.
                  It executes trades automatically in simulated virtual cash (Paper Trading) and syncs live orders directly to your broker through MetaTrader 4 and 5.
                </p>
              </div>

              {/* 5-Step Visual Pipeline */}
              <h4 style={{ fontSize: "14px", fontWeight: 700, margin: "10px 0 0 0", color: "#94a3b8" }}>
                THE COMPLETE 5-STEP TRADING LIFECYCLE
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                {[
                  {
                    step: "STEP 1",
                    title: "Live Data Feed",
                    desc: "Streams sub-second candles & quotes from official market feeds with ATR volatility validation.",
                    color: "#38bdf8",
                  },
                  {
                    step: "STEP 2",
                    title: "Quant & SMC AI",
                    desc: "6 algorithms + Order Block detection analyze liquidity sweeps, volume deltas, and FVGs.",
                    color: "#a855f7",
                  },
                  {
                    step: "STEP 3",
                    title: "Strict Risk Control",
                    desc: "Every trade is armed with dynamic Stop Loss, Target TP, and auto-closing Time Horizon (90s-1h).",
                    color: "#10b981",
                  },
                  {
                    step: "STEP 4",
                    title: "Instant Execution",
                    desc: "Fires paper trade instantly, or transmits via HTTP bridge to your OctaFX MT4/MT5 demo account.",
                    color: "#f59e0b",
                  },
                  {
                    step: "STEP 5",
                    title: "Audit Recording",
                    desc: "Permanently writes entry, exit, duration, win/loss, and P&L to Master Audit store (downloadable CSV).",
                    color: "#ec4899",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <span style={{ fontSize: "10px", fontWeight: 800, color: item.color, letterSpacing: "0.5px" }}>
                      {item.step}
                    </span>
                    <strong style={{ fontSize: "13px", color: "#f8fafc" }}>{item.title}</strong>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "12px",
                  padding: "16px",
                  background: "rgba(15, 23, 42, 0.6)",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong style={{ fontSize: "13px", color: "#f8fafc" }}>Ready to test?</strong>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    You can start the 24/7 server daemon anytime with 1 click on the top HUD banner.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: "12px" }}
                    onClick={() => {
                      onClose();
                      onNavigateTab?.("multibot");
                    }}
                  >
                    Go to Multi-Stock Bot
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: "12px" }}
                    onClick={() => setActiveSection("market_hours")}
                  >
                    Next: Market Hours <ArrowRight size={13} style={{ marginLeft: "4px" }} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: MARKET HOURS */}
          {activeSection === "market_hours" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.1)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <AlertCircle size={18} color="#f59e0b" />
                  <strong style={{ fontSize: "14px", color: "#fbbf24" }}>
                    Why NIFTY 50 and Indian Markets Do NOT Run 24/7
                  </strong>
                </div>
                <p style={{ fontSize: "12px", color: "#e2e8f0", margin: 0, lineHeight: 1.5 }}>
                  The <strong>National Stock Exchange of India (NSE)</strong> and <strong>BSE</strong> only operate during official banking hours on Monday through Friday.
                  Outside these hours, real market prices cannot change. AutoBots respects real physical exchange hours and does NOT place phantom orders when the exchange is shut down!
                </p>
              </div>

              {/* Market Sessions Schedule Matrix */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🇮🇳</span>
                    <strong style={{ fontSize: "13px" }}>Indian Equities & Indices</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                    <strong>Assets:</strong> NIFTY 50, BANKNIFTY, Reliance, TCS
                  </div>
                  <div style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 700, marginBottom: "4px" }}>
                    🕒 09:15 AM - 03:30 PM IST
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                    Monday to Friday. Closed on weekends and NSE market holidays.
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "6px 8px",
                      background: "rgba(99, 102, 241, 0.1)",
                      borderRadius: "6px",
                      fontSize: "10px",
                      color: "#a5b4fc",
                    }}
                  >
                    <strong>Bot Behavior:</strong> Outside 09:15-15:30 IST, Indian trades are held safely in Standby. New entries resume automatically at market open!
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🌍</span>
                    <strong style={{ fontSize: "13px" }}>Global Forex Currencies</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                    <strong>Assets:</strong> EUR/USD, GBP/USD, USD/INR
                  </div>
                  <div style={{ fontSize: "12px", color: "#10b981", fontWeight: 700, marginBottom: "4px" }}>
                    🕒 24 Hours / 5 Days a Week
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                    Opens Sunday 21:00 UTC (02:30 AM IST Mon), Closes Friday 21:00 UTC.
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "6px 8px",
                      background: "rgba(16, 185, 129, 0.1)",
                      borderRadius: "6px",
                      fontSize: "10px",
                      color: "#6ee7b7",
                    }}
                  >
                    <strong>Bot Behavior:</strong> Runs continuously day and night during the work week without stopping!
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "18px" }}>🟡</span>
                    <strong style={{ fontSize: "13px" }}>Global Commodities</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                    <strong>Assets:</strong> GOLD (XAU/USD), SILVER (XAG/USD)
                  </div>
                  <div style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700, marginBottom: "4px" }}>
                    🕒 09:00 AM - 11:30 PM IST
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                    COMEX / MCX extended global session.
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "6px 8px",
                      background: "rgba(245, 158, 11, 0.1)",
                      borderRadius: "6px",
                      fontSize: "10px",
                      color: "#fde68a",
                    }}
                  >
                    <strong>Bot Behavior:</strong> Excellent for evening trading after the Indian stock market closes!
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "18px" }}>⚡</span>
                    <strong style={{ fontSize: "13px" }}>Cryptocurrency</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
                    <strong>Assets:</strong> BTC/USD (Bitcoin), ETH/USD
                  </div>
                  <div style={{ fontSize: "12px", color: "#ec4899", fontWeight: 700, marginBottom: "4px" }}>
                    🕒 24/7/365 — NEVER CLOSES
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                    Open Saturdays, Sundays, holidays, midnight, and daytime.
                  </div>
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "6px 8px",
                      background: "rgba(236, 72, 153, 0.1)",
                      borderRadius: "6px",
                      fontSize: "10px",
                      color: "#fbcfe8",
                    }}
                  >
                    <strong>Bot Behavior:</strong> The bot can be tested and run any time, day or night, 365 days a year!
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "10px",
                  padding: "14px",
                  fontSize: "12px",
                  color: "#d1fae5",
                }}
              >
                <strong>Pro-Tip for Evening / Weekend Testing:</strong> When Indian markets are closed, switch to{" "}
                <strong>BTC/USD</strong>, <strong>GOLD</strong>, or <strong>EUR/USD</strong> to watch the live bot analyze and take trades in real time!
              </div>
            </div>
          )}

          {/* SECTION 3: STRATEGIES */}
          {activeSection === "strategies" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 6px 0", color: "#38bdf8" }}>
                  ⚡ The 6 Algorithmic Strategies Tested in Parallel
                </h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                  Instead of guessing with 1 indicator, AutoBots tests 6 distinct mathematical strategies simultaneously on the same stock:
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  {
                    name: "1. High-Volume Micro Scalper",
                    magic: "10101",
                    horizon: "90 Seconds",
                    tp_sl: "TP: +0.8% | SL: -0.4%",
                    desc: "Snipes instant breakouts when volume surges 1.8x above the 20-period moving average. Designed for quick profits with minimal market exposure.",
                    color: "#38bdf8",
                  },
                  {
                    name: "2. Bollinger Mean-Reversion",
                    magic: "10202",
                    horizon: "180 Seconds (3 mins)",
                    tp_sl: "TP: +1.2% | SL: -0.6%",
                    desc: "Exploits mathematical overextension. When price pierces the outer 2-sigma Bollinger band and RSI is oversold (<30) or overbought (>70), it trades the reversion back to the 20-period mean.",
                    color: "#a855f7",
                  },
                  {
                    name: "3. Breakout Liquidity Hunt",
                    magic: "10303",
                    horizon: "360 Seconds (6 mins)",
                    tp_sl: "TP: +1.8% | SL: -0.85%",
                    desc: "Detects institutional stop runs. When price breaks out of the 20-bar session High/Low with an aggressive volume spike, it enters the breakout momentum direction.",
                    color: "#f59e0b",
                  },
                  {
                    name: "4. 100% Directional Consensus",
                    magic: "10404",
                    horizon: "600 Seconds (10 mins)",
                    tp_sl: "TP: +1.5% | SL: -0.5%",
                    desc: "High-conviction sniper mode: Only takes a position when ALL 4 predictive engines (Ensemble, Statistical Rules, Machine Learning, and Trend Flow) vote in 100% unanimous agreement.",
                    color: "#10b981",
                  },
                  {
                    name: "5. Qlib GBDT Machine Learning Alpha",
                    magic: "10505",
                    horizon: "900 Seconds (15 mins)",
                    tp_sl: "TP: +1.6% | SL: -0.7%",
                    desc: "Microsoft Qlib-inspired Gradient Boosted Decision Tree model evaluating 168 quantitative factors (volatility rank, momentum rank, return skewness, and volume profiles).",
                    color: "#06b6d4",
                  },
                  {
                    name: "6. Macro Trend Swing with Trailing Stop",
                    magic: "10606",
                    horizon: "3600 Seconds (1 Hour)",
                    tp_sl: "TP: +2.5% | Dynamic Trailing SL: 0.5%",
                    desc: "Rides sustained trends identified by EMA-9 > EMA-20 > EMA-50 alignment. Employs a dynamic trailing stop that ratchets upward as profit expands.",
                    color: "#ec4899",
                  },
                ].map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: `1px solid rgba(255, 255, 255, 0.07)`,
                      borderRadius: "10px",
                      padding: "14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                      <strong style={{ fontSize: "14px", color: s.color }}>{s.name}</strong>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <span style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "4px" }}>
                          MT4 Magic: {s.magic}
                        </span>
                        <span style={{ fontSize: "10px", padding: "2px 6px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderRadius: "4px" }}>
                          Max Hold: {s.horizon}
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                      {s.desc}
                    </p>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      🎯 {s.tp_sl}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 4: RISK MANAGEMENT */}
          {activeSection === "risk_management" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.15))",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <Shield size={20} color="#10b981" />
                  <strong style={{ fontSize: "15px", color: "#34d399" }}>
                    Why Trades Never Stay Stuck Open (Auto-Exit Rules)
                  </strong>
                </div>
                <p style={{ fontSize: "12px", color: "#e2e8f0", margin: 0, lineHeight: 1.5 }}>
                  A common failure in retail bots is leaving losing trades open indefinitely hoping they recover. 
                  AutoBots enforces <strong>3 strict mathematical exit guarantees</strong> on every single trade:
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                    <strong style={{ fontSize: "13px" }}>1. Dynamic Take Profit (TP)</strong>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                    Automatically calculated based on the asset's Average True Range (ATR) and strategy target (+0.8% to +2.5%). 
                    When price reaches the target, the bot instantly locks in realized profit.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                    <strong style={{ fontSize: "13px" }}>2. Strict Stop Loss (SL)</strong>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                    Placed beyond structural swing points or order block wicks (-0.4% to -0.85%). 
                    Protects the portfolio from unexpected market flash crashes.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#38bdf8" }} />
                    <strong style={{ fontSize: "13px" }}>3. Time-Horizon Expiration</strong>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                    If a trade does not reach TP or SL within its optimal statistical window (e.g. 90s for scalpers, 6 mins for breakouts), 
                    the bot automatically closes the trade at market price. Your capital is never frozen!
                  </p>
                </div>
              </div>

              {/* 1-Click Close All Emergency Button */}
              <div
                style={{
                  padding: "14px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "#fca5a5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <span>
                  <strong>Manual Override:</strong> You can liquidate all open positions instantly anytime with the red{" "}
                  <strong>"Close All Trades"</strong> button located in the top Mission Control HUD and Portfolio Blotter.
                </span>
              </div>
            </div>
          )}

          {/* SECTION 5: MT4 / MT5 SETUP */}
          {activeSection === "mt4_mt5" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.15))",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 6px 0", color: "#38bdf8" }}>
                  🌐 How to Connect AutoBots to OctaFX MT4 or MT5
                </h3>
                <p style={{ fontSize: "12px", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                  The AutoBots backend exposes an ultra-fast REST API bridge. An Expert Advisor (EA) running inside MetaTrader 
                  polls the server every 1,000ms, executing trades automatically in your demo or live broker account.
                </p>
              </div>

              {/* Download Buttons */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a
                  href="/AutoBots_MultiStrategy_MT4.mq4"
                  download="AutoBots_MultiStrategy_MT4.mq4"
                  className="btn btn-primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
                    textDecoration: "none",
                  }}
                >
                  <Download size={14} /> Download MT4 EA (.mq4)
                </a>
                <a
                  href="/AutoBot_MT5_Bridge.mq5"
                  download="AutoBot_MT5_Bridge.mq5"
                  className="btn btn-primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    textDecoration: "none",
                  }}
                >
                  <Download size={14} /> Download MT5 EA (.mq5)
                </a>
              </div>

              {/* 4 Steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  {
                    step: "1",
                    title: "Open Data Folder in MetaTrader",
                    desc: "In your MT4 or MT5 window, click 'File' in the top-left menu ➔ click 'Open Data Folder'. (Do not use the Help menu).",
                  },
                  {
                    step: "2",
                    title: "Paste the File into Experts",
                    desc: "Open the 'MQL5' (or 'MQL4') folder ➔ open the 'Experts' folder ➔ paste the downloaded .mq5 or .mq4 file here.",
                  },
                  {
                    step: "3",
                    title: "Refresh Navigator in MetaTrader",
                    desc: "Press Ctrl+N (or View ➔ Navigator). Expand 'Expert Advisors', right-click on it and select 'Refresh'. The bot will appear!",
                  },
                  {
                    step: "4",
                    title: "Attach to Chart & Enable Algo Trading",
                    desc: "Drag the bot onto any chart (e.g. XAUUSD). Check the box 'Allow Algo Trading' (or Allow Live Trading). Click the 'Algo Trading' button on the top toolbar so it turns green!",
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "10px",
                      padding: "12px 16px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(99, 102, 241, 0.3)",
                        color: "#818cf8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {s.step}
                    </div>
                    <div>
                      <strong style={{ fontSize: "13px", color: "#f8fafc" }}>{s.title}</strong>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.4 }}>
                        {s.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6: FAQ */}
          {activeSection === "faq" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 6px 0", color: "#38bdf8" }}>
                ❓ Frequently Asked Questions
              </h3>

              {[
                {
                  q: "Does the bot trade when my browser or computer is shut down?",
                  a: "YES. The trading engine runs entirely on the backend server daemon. As long as your server is running, the bot scans markets, opens trades, and manages risk 24/7 without requiring any open browser tabs.",
                },
                {
                  q: "Why do Indian stock prices stay static in the evening?",
                  a: "The National Stock Exchange of India (NSE) is physically closed after 3:30 PM IST until 9:15 AM IST the next trading day. Real market prices cannot change when the exchange is closed. Global markets (Crypto and Forex) continue to move 24 hours.",
                },
                {
                  q: "How can I test the bot right now if the Indian market is closed?",
                  a: "Select BTC/USD (Bitcoin), GOLD (XAUUSD), or EUR/USD from the instrument selector dropdown. These markets trade 24/7 or 24/5 with live ticking order flows and immediate signals.",
                },
                {
                  q: "Where is my trading data saved?",
                  a: "Every trade is stored permanently in the Master Audit store and Trade Analytics Ledger on disk. Even if you clear your browser cookies or reset paper cash, your historical analytics remain intact and exportable to CSV/Excel.",
                },
                {
                  q: "Can I run multiple strategies on the same stock at the same time?",
                  a: "YES! Head to the '6-Strategy Lab & MT4/MT5' tab. All 6 algorithms trade the same stock concurrently using distinct Magic Numbers (10101 - 10606) so you can directly compare which strategy produces the highest win rate.",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "10px",
                    padding: "14px 16px",
                  }}
                >
                  <strong style={{ fontSize: "13px", color: "#f8fafc", display: "block", marginBottom: "6px" }}>
                    {item.q}
                  </strong>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(10, 15, 26, 0.8)",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            AutoBots v2.4 • Institutional Algorithmic Quant Terminal
          </span>
          <button
            className="btn btn-outline"
            style={{ fontSize: "12px", padding: "6px 14px" }}
            onClick={onClose}
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
