import React, { useState, useEffect, useCallback } from "react";
import {
  fetchMultiStrategyMatrix,
  MultiStrategyMatrixResponse,
  MultiStrategyItem,
  fetchMT4Status,
  updateMT4Config,
  getMT4EADownloadUrl,
  fetchMT5Status,
} from "../api";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Activity,
  Award,
  Layers,
  Download,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Cpu,
  Clock,
  Sliders,
  DollarSign,
  BarChart2,
  Terminal,
  Code,
  Copy,
  Check,
} from "lucide-react";

const MQL4_SOURCE_CODE = `//+------------------------------------------------------------------+
//|                                  AutoBots_MultiStrategy_MT4.mq4  |
//|               Copyright 2026, AutoBots Quantitative Intelligence |
//|                                   https://github.com/maulikkumbhani|
//+------------------------------------------------------------------+
#property copyright "AutoBots AI Market Intelligence"
#property link      "https://mt4.octafx.com/"
#property version   "2.00"
#property strict

//--- Input Parameters
input string   InpServerUrl       = "http://localhost:8000"; // AutoBots Server Base URL (or your deployed cloud domain)
input int      InpPollIntervalMs  = 1000;                     // Polling Interval (Milliseconds)
input double   InpDefaultLots     = 0.05;                     // Default Lot Size (OctaFX Demo)
input int      InpMaxSlippage     = 20;                       // Max Slippage (Points)
input bool     InpAutoTrade       = true;                     // Enable Auto-Trading Execution
input string   InpOctaAccount     = "OctaFX-Demo-01";         // Account Identifier

//--- Global Variables
datetime g_last_poll_time = 0;

int OnInit()
{
   Print(">>> AutoBots MT4 Multi-Strategy Bridge Initialized for OctaFX");
   Print(">>> Target Server: ", InpServerUrl);
   EventSetMillisecondTimer(InpPollIntervalMs);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print(">>> AutoBots MT4 Bridge Deinitialized.");
}

void OnTimer()
{
   if(!InpAutoTrade) return;
   PollAndExecuteSignals();
   SendAccountTelemetry();
}

void PollAndExecuteSignals()
{
   string url = InpServerUrl + "/api/v1/mt4/bridge/poll-signals";
   string headers = "User-Agent: AutoBots-MT4-Bridge\\r\\nContent-Type: application/json\\r\\n";
   char post_data[];
   char result[];
   string result_headers;
   
   ResetLastError();
   int res = WebRequest("GET", url, headers, 3000, post_data, result, result_headers);
   
   if(res == 200)
   {
      string response = CharArrayToString(result);
      if(StringLen(response) > 5 && StringFind(response, "signal_id") >= 0)
      {
         ParseAndExecuteJsonSignals(response);
      }
   }
   else if(res == -1)
   {
      int err = GetLastError();
      if(err == 4060)
      {
         Print(">>> ERROR 4060: Add '", InpServerUrl, "' to Tools -> Options -> Expert Advisors -> Allow WebRequest!");
      }
   }
}

void ParseAndExecuteJsonSignals(string json_str)
{
   int pos = 0;
   while((pos = StringFind(json_str, "{\\"signal_id\\"", pos)) >= 0)
   {
      int end_pos = StringFind(json_str, "}", pos);
      if(end_pos < 0) break;
      
      string item = StringSubstr(json_str, pos, end_pos - pos + 1);
      ExecuteSingleSignal(item);
      pos = end_pos + 1;
   }
}

void ExecuteSingleSignal(string item)
{
   string sig_id  = ExtractJsonValue(item, "signal_id");
   string sym     = ExtractJsonValue(item, "symbol");
   string side    = ExtractJsonValue(item, "side");
   double lots    = StrToDouble(ExtractJsonValue(item, "lots"));
   double sl      = StrToDouble(ExtractJsonValue(item, "stop_loss"));
   double tp      = StrToDouble(ExtractJsonValue(item, "take_profit"));
   int    magic   = (int)StrToInteger(ExtractJsonValue(item, "magic_number"));
   string comment = ExtractJsonValue(item, "comment");

   if(lots <= 0.0) lots = InpDefaultLots;
   if(magic <= 0) magic = 10101;
   if(StringLen(sym) == 0) sym = Symbol();

   double ask = MarketInfo(sym, MODE_ASK);
   double bid = MarketInfo(sym, MODE_BID);
   
   if(ask == 0.0 && bid == 0.0)
   {
      sym = Symbol();
      ask = MarketInfo(sym, MODE_ASK);
      bid = MarketInfo(sym, MODE_BID);
   }

   int cmd = (side == "BUY") ? OP_BUY : OP_SELL;
   double price = (cmd == OP_BUY) ? ask : bid;
   color  clr   = (cmd == OP_BUY) ? clrLimeGreen : clrRed;

   int ticket = OrderSend(sym, cmd, lots, price, InpMaxSlippage, sl, tp, comment, magic, 0, clr);

   if(ticket > 0)
   {
      Print(">>> [SUCCESS] Executed MT4 Order #", ticket, " (", side, " ", lots, " ", sym, " @ ", price, ")");
      ReportExecution(sig_id, ticket, "FILLED", price, sym, side, lots, magic);
   }
   else
   {
      int err = GetLastError();
      Print(">>> [FAILED] OrderSend failed. Error: ", err);
      ReportExecution(sig_id, 0, "FAILED_" + IntegerToString(err), price, sym, side, lots, magic);
   }
}

void ReportExecution(string sig_id, int ticket, string status, double price, string sym, string side, double lots, int magic)
{
   string url = InpServerUrl + "/api/v1/mt4/bridge/report-execution";
   string headers = "User-Agent: AutoBots-MT4-Bridge\\r\\nContent-Type: application/json\\r\\n";
   
   string payload = StringConcatenate(
      "{\\"signal_id\\":\\"", sig_id, "\\",",
      "\\"ticket\\":", ticket, ",",
      "\\"status\\":\\"", status, "\\",",
      "\\"fill_price\\":", price, ",",
      "\\"symbol\\":\\"", sym, "\\",",
      "\\"side\\":\\"", side, "\\",",
      "\\"lots\\":", lots, ",",
      "\\"magic_number\\":", magic, ",",
      "\\"account\\":\\"", InpOctaAccount, "\\"}"
   );
   
   char post_data[];
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   char result[];
   string result_headers;
   WebRequest("POST", url, headers, 3000, post_data, result, result_headers);
}

void SendAccountTelemetry()
{
   string url = InpServerUrl + "/api/v1/mt4/bridge/telemetry";
   string headers = "User-Agent: AutoBots-MT4-Bridge\\r\\nContent-Type: application/json\\r\\n";
   
   string payload = StringConcatenate(
      "{\\"balance\\":", AccountBalance(), ",",
      "\\"equity\\":", AccountEquity(), ",",
      "\\"margin\\":", AccountMargin(), ",",
      "\\"free_margin\\":", AccountFreeMargin(), ",",
      "\\"open_orders_count\\":", OrdersTotal(), ",",
      "\\"server\\":\\"", AccountServer(), "\\",",
      "\\"account\\":\\"", IntegerToString(AccountNumber()), "\\"}"
   );
   
   char post_data[];
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   char result[];
   string result_headers;
   WebRequest("POST", url, headers, 2000, post_data, result, result_headers);
}

string ExtractJsonValue(string json, string key)
{
   string search = "\\"" + key + "\\":";
   int start = StringFind(json, search);
   if(start < 0) return("");
   start += StringLen(search);
   
   while(StringSubstr(json, start, 1) == " ") start++;
   
   if(StringSubstr(json, start, 1) == "\\"")
   {
      start++;
      int end_q = StringFind(json, "\\"", start);
      if(end_q < 0) return("");
      return(StringSubstr(json, start, end_q - start));
   }
   else
   {
      int end_c = StringFind(json, ",", start);
      int end_b = StringFind(json, "}", start);
      int end = end_c;
      if(end < 0 || (end_b >= 0 && end_b < end)) end = end_b;
      if(end < 0) end = StringLen(json);
      return(StringSubstr(json, start, end - start));
   }
}`;

interface MultiStrategyLabProps {
  initialSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
}

export const MultiStrategyLab: React.FC<MultiStrategyLabProps> = ({
  initialSymbol = "NIFTY 50",
  onSelectSymbol,
}) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
  const [matrixData, setMatrixData] = useState<MultiStrategyMatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState<boolean>(true);

  // MT4 Bridge State
  const [mt4Status, setMt4Status] = useState<any>(null);
  const [mt5Status, setMt5Status] = useState<any>(null);
  const [mt4LotSize, setMt4LotSize] = useState<number>(0.05);
  const [isUpdatingMt4, setIsUpdatingMt4] = useState<boolean>(false);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const availableSymbols = [
    { symbol: "NIFTY 50", label: "NIFTY 50", class: "INDEX", flag: "🇮🇳" },
    { symbol: "BANKNIFTY", label: "BANK NIFTY", class: "INDEX", flag: "🇮🇳" },
    { symbol: "GOLD", label: "GOLD (XAU/USD)", class: "COMMODITY", flag: "🪙" },
    { symbol: "SILVER", label: "SILVER (XAG/USD)", class: "COMMODITY", flag: "🪙" },
    { symbol: "USD/INR", label: "USD/INR", class: "FOREX", flag: "💱" },
    { symbol: "RELIANCE", label: "RELIANCE", class: "EQUITY", flag: "🇮🇳" },
    { symbol: "TCS", label: "TCS", class: "EQUITY", flag: "🇮🇳" },
    { symbol: "CRUDE OIL", label: "CRUDE OIL", class: "COMMODITY", flag: "🛢️" },
  ];

  const loadMatrix = useCallback(async (sym: string = selectedSymbol) => {
    try {
      setError(null);
      const res = await fetchMultiStrategyMatrix(sym);
      setMatrixData(res);
    } catch (err: any) {
      console.error("Failed to load multi-strategy matrix:", err);
      setError(err?.message || "Failed to fetch multi-strategy matrix");
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  const loadBridges = useCallback(async () => {
    try {
      const [m4, m5] = await Promise.allSettled([fetchMT4Status(), fetchMT5Status()]);
      if (m4.status === "fulfilled") {
        setMt4Status(m4.value);
        if (m4.value.config?.default_lot_size) {
          setMt4LotSize(m4.value.config.default_lot_size);
        }
      }
      if (m5.status === "fulfilled") {
        setMt5Status(m5.value);
      }
    } catch (e) {
      console.warn("Bridge status check error:", e);
    }
  }, []);

  useEffect(() => {
    loadMatrix(selectedSymbol);
    loadBridges();
  }, [selectedSymbol, loadMatrix, loadBridges]);

  // Live auto-refresh polling every 3.5s
  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      loadMatrix(selectedSymbol);
      loadBridges();
    }, 3500);
    return () => clearInterval(interval);
  }, [isAutoRefresh, selectedSymbol, loadMatrix, loadBridges]);

  const handleToggleMT4 = async () => {
    if (!mt4Status) return;
    setIsUpdatingMt4(true);
    try {
      const newEnabled = !mt4Status.config?.enabled;
      await updateMT4Config({
        enabled: newEnabled,
        default_lot_size: mt4LotSize,
      });
      setToastMessage(`OctaFX MT4 Auto-Bridge ${newEnabled ? "ENABLED" : "PAUSED"}!`);
      await loadBridges();
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert("Failed to toggle MT4 Bridge: " + err?.message);
    } finally {
      setIsUpdatingMt4(false);
    }
  };

  const handleUpdateLotSize = async (newLot: number) => {
    setMt4LotSize(newLot);
    try {
      await updateMT4Config({ default_lot_size: newLot });
      setToastMessage(`Default MT4 Order Size updated to ${newLot} Lots`);
      setTimeout(() => setToastMessage(null), 2500);
    } catch (err: any) {
      console.error(err);
    }
  };

  const champion = matrixData?.strategies.find((s) => s.is_champion) || matrixData?.strategies[0];

  return (
    <div className="multi-strategy-lab-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Toast Alert */}
      {toastMessage && (
        <div
          style={{
            background: "linear-gradient(90deg, rgba(16, 185, 129, 0.25), rgba(99, 102, 241, 0.25))",
            border: "1px solid rgba(16, 185, 129, 0.5)",
            padding: "10px 16px",
            borderRadius: "8px",
            color: "#a7f3d0",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Layers size={20} color="var(--accent-primary)" />
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                Multi-Strategy Testing Engine & OctaFX MT4 / MT5 Auto-Bot
              </h2>
              <span
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "var(--bullish-green)",
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  fontWeight: 700,
                }}
              >
                ● 24/7 SERVER DAEMON ACTIVE
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: 0, maxWidth: "880px", lineHeight: "1.5" }}>
              Simultaneously test 5 distinct quantitative architectures (High-Volume Scalper, Qlib Factor GBDT, PatchTST Transformer, FinRL Actor-Critic PPO, and Mean-Reversion Bollinger) on each stock. All trades execute in isolated magic numbers to evaluate real-time win rates without ticket collisions. Continues recording and paper/live trading on the server even if the browser is closed.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              className="btn btn-outline"
              style={{
                borderColor: isAutoRefresh ? "var(--bullish-green)" : "var(--border-subtle)",
                color: isAutoRefresh ? "var(--bullish-green)" : "var(--text-muted)",
                fontSize: "11px",
                padding: "6px 12px",
              }}
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              title="Toggle Live 3.5s Matrix Auto-Refresh"
            >
              <Zap size={13} className={isAutoRefresh ? "animate-pulse" : ""} />
              <span>{isAutoRefresh ? "LIVE REFRESH: ON" : "REFRESH: OFF"}</span>
            </button>

            <button
              className="btn btn-outline"
              style={{ fontSize: "11px", padding: "6px 12px" }}
              onClick={() => loadMatrix(selectedSymbol)}
              disabled={loading}
              title="Force Refresh Strategy Matrix"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stock Selector Pills */}
        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", fontWeight: 700 }}>
            Select Stock to Evaluate Multi-Strategy Performance & Signals:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {availableSymbols.map((item) => {
              const isSelected = selectedSymbol === item.symbol;
              return (
                <button
                  key={item.symbol}
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    if (onSelectSymbol) onSelectSymbol(item.symbol);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    borderRadius: "6px",
                    border: isSelected ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                    background: isSelected ? "rgba(99, 102, 241, 0.2)" : "rgba(15, 23, 42, 0.4)",
                    color: isSelected ? "#fff" : "var(--text-muted)",
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>{item.flag}</span>
                  <span>{item.label}</span>
                  <span
                    style={{
                      fontSize: "9px",
                      opacity: 0.7,
                      padding: "1px 4px",
                      borderRadius: "3px",
                      background: "rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    {item.class}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Champion Callout Bar */}
        {matrixData && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 14px",
              background: champion && champion.trades_count > 0
                ? "linear-gradient(90deg, rgba(234, 179, 8, 0.12), rgba(99, 102, 241, 0.12))"
                : "linear-gradient(90deg, rgba(56, 189, 248, 0.08), rgba(99, 102, 241, 0.08))",
              border: champion && champion.trades_count > 0
                ? "1px solid rgba(234, 179, 8, 0.35)"
                : "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {champion && champion.trades_count > 0 ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      background: "rgba(234, 179, 8, 0.2)",
                      color: "#fbbf24",
                      padding: "6px",
                      borderRadius: "6px",
                      display: "flex",
                    }}
                  >
                    <Award size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      🏆 Current Champion Model for {selectedSymbol}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>
                      {champion.name} ({champion.strategy_id})
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>WIN RATE</div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--bullish-green)" }}>
                      {champion.win_rate_pct.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>TRADES</div>
                    <div style={{ fontSize: "13px", fontWeight: 700 }}>
                      {champion.trades_count} ({champion.wins}W / {champion.losses}L)
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>NET REALIZED P&L</div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 800,
                        color: champion.net_pnl >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {champion.net_pnl >= 0 ? "+" : ""}
                      {selectedSymbol.includes("GOLD") || selectedSymbol.includes("SILVER") || selectedSymbol.includes("CRUDE")
                        ? `$${champion.net_pnl.toFixed(2)}`
                        : `₹${champion.net_pnl.toFixed(2)}`}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                <Activity size={18} color="#38bdf8" />
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  <strong style={{ color: "#38bdf8" }}>24/7 Server Quantitative Matrix Active:</strong> Testing 5 algorithmic models concurrently on {selectedSymbol}. Zero dummy data active — Win rates and Champion badges will dynamically calculate as live/paper trades complete.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5 Strategies Comparison Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
        {matrixData?.strategies.map((strat: MultiStrategyItem) => {
          const isChamp = strat.is_champion;
          const pos = strat.active_position;

          return (
            <div
              key={strat.strategy_id}
              className="glass-card"
              style={{
                padding: "16px",
                position: "relative",
                border: isChamp ? "1px solid rgba(234, 179, 8, 0.5)" : "1px solid var(--border-subtle)",
                background: isChamp
                  ? "linear-gradient(180deg, rgba(234, 179, 8, 0.05), rgba(15, 23, 42, 0.6))"
                  : "var(--card-bg)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              {/* Badge row */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: 700,
                      background: "rgba(99, 102, 241, 0.15)",
                      color: "var(--accent-primary)",
                      border: "1px solid rgba(99, 102, 241, 0.3)",
                      textTransform: "uppercase",
                    }}
                  >
                    {strat.type}
                  </span>

                  {isChamp ? (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        color: "#fbbf24",
                        background: "rgba(234, 179, 8, 0.2)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        border: "1px solid rgba(234, 179, 8, 0.4)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      🏆 CHAMPION
                    </span>
                  ) : (
                    <span style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      MT4 Magic: {strat.magic_number}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", lineHeight: "1.3" }}>
                  {strat.name}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "3px", lineHeight: "1.4" }}>
                  {strat.description}
                </div>
              </div>

              {/* Performance Metrics */}
              <div style={{ background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>WIN RATE</span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: strat.win_rate_pct >= 65 ? "var(--bullish-green)" : strat.win_rate_pct >= 50 ? "#38bdf8" : "var(--bearish-red)",
                    }}
                  >
                    {strat.win_rate_pct.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: "5px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden", marginBottom: "8px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(strat.win_rate_pct, 100)}%`,
                      background: strat.win_rate_pct >= 65 ? "var(--bullish-green)" : "#38bdf8",
                      borderRadius: "3px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                  <div>
                    <span style={{ color: "var(--text-dim)" }}>Trades: </span>
                    <span style={{ fontWeight: 700 }}>
                      {strat.trades_count} ({strat.wins}W / {strat.losses}L)
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "var(--text-dim)" }}>Net P&L: </span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: strat.net_pnl >= 0 ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {strat.net_pnl >= 0 ? "+" : ""}
                      {selectedSymbol.includes("GOLD") || selectedSymbol.includes("SILVER") || selectedSymbol.includes("CRUDE")
                        ? `$${strat.net_pnl.toFixed(2)}`
                        : `₹${strat.net_pnl.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Position / Current State */}
              <div style={{ fontSize: "11px", borderTop: "1px dashed var(--border-subtle)", paddingTop: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ color: "var(--text-dim)" }}>Active Server Position:</span>
                  {pos ? (
                    <span
                      style={{
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: pos.side === "BUY" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                        color: pos.side === "BUY" ? "var(--bullish-green)" : "var(--bearish-red)",
                      }}
                    >
                      {pos.side === "BUY" ? "LONG" : "SHORT"} (
                      {pos.unrealized_pnl >= 0 ? "+" : ""}
                      {selectedSymbol.includes("GOLD") || selectedSymbol.includes("SILVER") || selectedSymbol.includes("CRUDE")
                        ? `$${pos.unrealized_pnl.toFixed(2)}`
                        : `₹${pos.unrealized_pnl.toFixed(2)}`}
                      )
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-dim)" }}>FLAT (Scanning)</span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)", fontSize: "10px" }}>
                  <span>SL: {(strat.stop_loss_pct * 100).toFixed(2)}%</span>
                  <span>TP: {(strat.take_profit_pct * 100).toFixed(2)}%</span>
                  <span>Horizon: {strat.max_hold_seconds}s</span>
                </div>
              </div>

              {/* MT4/MT5 Signal Routing Tag */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(15, 23, 42, 0.5)",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  color: "var(--text-dim)",
                }}
              >
                <span>MT4/MT5 Signal Queue:</span>
                <span style={{ color: "var(--bullish-green)", fontWeight: 600 }}>● ARMED</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* OctaFX MT4 & MT5 Bridge Controller Section */}
      <div className="glass-card" style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={18} color="#38bdf8" />
              <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                MetaTrader 4 (MT4) & MT5 Automated Execution Bridge
              </h3>
              <span
                style={{
                  background: mt4Status?.config?.enabled ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)",
                  color: mt4Status?.config?.enabled ? "var(--bullish-green)" : "var(--text-muted)",
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  border: mt4Status?.config?.enabled ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-subtle)",
                }}
              >
                {mt4Status?.config?.enabled ? "● MT4 BRIDGE ACTIVE" : "○ MT4 STANDBY"}
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "4px 0 0 0" }}>
              Connect directly with OctaFX MT4 (<a href="https://mt4.octafx.com/" target="_blank" rel="noreferrer" style={{ color: "#38bdf8", textDecoration: "underline" }}>https://mt4.octafx.com/</a>) or desktop MetaTrader 4 & MT5 terminals. Run multi-stock, multi-strategy signals simultaneously with independent ticket management.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {/* OctaFX WebTrader Link */}
            <a
              href="https://mt4.octafx.com/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
              style={{
                fontSize: "11px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                borderColor: "#38bdf8",
                color: "#38bdf8",
              }}
            >
              <ExternalLink size={13} />
              <span>Open OctaFX WebTrader</span>
            </a>

            {/* Download MQL4 EA directly from static storage */}
            <a
              href="/AutoBots_MultiStrategy_MT4.mq4"
              download="AutoBots_MultiStrategy_MT4.mq4"
              className="btn btn-primary"
              style={{
                fontSize: "11px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
              }}
              title="Download AutoBots_MultiStrategy_MT4.mq4 file"
            >
              <Download size={13} />
              <span>Download MT4 EA (.mq4)</span>
            </a>

            {/* View & Copy Source Code Button */}
            <button
              className="btn btn-outline"
              style={{
                fontSize: "11px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                borderColor: "#818cf8",
                color: "#a5b4fc",
              }}
              onClick={() => setShowCodeModal(!showCodeModal)}
              title="View or Copy the complete MQL4 source code"
            >
              <Code size={13} />
              <span>{showCodeModal ? "Hide Code" : "💻 View / Copy Code"}</span>
            </button>

            {/* Setup Instructions Toggle */}
            <button
              className="btn btn-outline"
              style={{ fontSize: "11px" }}
              onClick={() => setShowSetupModal(!showSetupModal)}
            >
              <span>{showSetupModal ? "Hide Setup Guide" : "📖 OctaFX Setup Guide"}</span>
            </button>
          </div>
        </div>

        {/* In-Browser MQL4 Code Viewer & Copy Drawer */}
        {showCodeModal && (
          <div
            style={{
              background: "rgba(10, 15, 30, 0.95)",
              border: "1px solid rgba(129, 140, 248, 0.4)",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Terminal size={16} color="#818cf8" />
                <span style={{ fontWeight: 800, fontSize: "13px", color: "#e2e8f0" }}>
                  AutoBots_MultiStrategy_MT4.mq4 (MQL4 Source Code)
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "11px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => {
                    navigator.clipboard.writeText(MQL4_SOURCE_CODE);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2500);
                  }}
                >
                  {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedCode ? "Copied to Clipboard!" : "Copy Code to Clipboard"}</span>
                </button>

                <a
                  href="/AutoBots_MultiStrategy_MT4.mq4"
                  download="AutoBots_MultiStrategy_MT4.mq4"
                  className="btn btn-outline"
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                >
                  <Download size={13} />
                  <span>Download .mq4</span>
                </a>
              </div>
            </div>

            <pre
              style={{
                background: "rgba(0, 0, 0, 0.5)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                padding: "12px",
                maxHeight: "260px",
                overflowY: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "#94a3b8",
                lineHeight: "1.45",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {MQL4_SOURCE_CODE}
            </pre>
          </div>
        )}

        {/* Setup Guide Accordion */}
        {showSetupModal && (
          <div
            style={{
              background: "rgba(15, 23, 42, 0.75)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
              fontSize: "12px",
              lineHeight: "1.6",
            }}
          >
            <div style={{ fontWeight: 800, color: "#38bdf8", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldAlert size={16} /> Quick Setup Guide for OctaFX Demo Account in MetaTrader 4:
            </div>
            <ol style={{ paddingLeft: "18px", margin: 0, color: "var(--text-secondary)" }}>
              <li>
                <strong>Create Demo Account:</strong> Sign in or create a demo account at{" "}
                <a href="https://mt4.octafx.com/" target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>
                  OctaFX MT4 WebTrader
                </a>{" "}
                or install the OctaFX MT4 Desktop terminal.
              </li>
              <li>
                <strong>Download Expert Advisor:</strong> Click <strong>"Download MT4 EA (.mq4)"</strong> above to get{" "}
                <code>AutoBots_MultiStrategy_MT4.mq4</code>.
              </li>
              <li>
                <strong>Install in MT4:</strong> In MT4, go to <strong>File &gt; Open Data Folder &gt; MQL4 &gt; Experts/</strong> and paste the file there. Restart MT4 or right-click "Experts" in Navigator and click <strong>Refresh</strong>.
              </li>
              <li>
                <strong>Authorize WebRequest:</strong> In MT4, open <strong>Tools &gt; Options &gt; Expert Advisors</strong> tab. Check <strong>"Allow WebRequest for listed URL"</strong> and add:
                <div style={{ margin: "4px 0", background: "rgba(0,0,0,0.4)", padding: "4px 8px", borderRadius: "4px", fontFamily: "var(--font-mono)", color: "var(--bullish-green)" }}>
                  http://localhost:8000
                </div>
                <em>(Or your deployed cloud domain if running remotely).</em>
              </li>
              <li>
                <strong>Attach to Chart:</strong> Drag <code>AutoBots_MultiStrategy_MT4</code> onto any chart (e.g. <code>XAUUSD</code>, <code>INDIA50</code>). Ensure <strong>"Allow Live Trading"</strong> is checked. The EA will poll every 1s and automatically place/close orders using Magic Numbers (<code>10101</code> - <code>10505</code>) matching the 5 strategies!
              </li>
            </ol>
          </div>
        )}

        {/* Bridge Controls Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {/* MT4 Toggle Card */}
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>OCTAFX MT4 EXECUTION</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "13px" }}>
                {mt4Status?.config?.enabled ? "AUTO-TRADING ON" : "AUTO-TRADING OFF"}
              </span>
              <button
                className={`btn ${mt4Status?.config?.enabled ? "btn-outline" : "btn-primary"}`}
                style={{ fontSize: "11px", padding: "4px 10px" }}
                onClick={handleToggleMT4}
                disabled={isUpdatingMt4}
              >
                {mt4Status?.config?.enabled ? "Pause" : "Enable"}
              </button>
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
              Broker: {mt4Status?.config?.broker_name || "OctaFX / MetaQuotes"}
            </div>
          </div>

          {/* Lot Size Card */}
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>DEFAULT ORDER LOTS</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="10.0"
                value={mt4LotSize}
                onChange={(e) => handleUpdateLotSize(parseFloat(e.target.value) || 0.01)}
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-subtle)",
                  color: "#fff",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  width: "80px",
                  fontFamily: "var(--font-mono)",
                }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Lots per trade</span>
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
              Recommended: 0.01 - 0.05 for Micro / Demo
            </div>
          </div>

          {/* Telemetry / Queue Card */}
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>SIGNAL TELEMETRY</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700 }}>
              <span>Signals Queued:</span>
              <span style={{ color: "#38bdf8" }}>{mt4Status?.queued_signals_count || 0}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginTop: "2px" }}>
              <span>Signals Executed:</span>
              <span style={{ color: "var(--bullish-green)" }}>{mt4Status?.executed_signals_count || 0}</span>
            </div>
          </div>

          {/* MT5 Status Companion */}
          <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", marginBottom: "4px" }}>MT5 SOCKET BRIDGE</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "13px" }}>
                {mt5Status?.enabled ? "MT5 READY" : "MT5 STANDBY"}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: mt5Status?.connected ? "var(--bullish-green)" : "var(--text-muted)",
                }}
              >
                {mt5Status?.connected ? "● Connected" : "○ Local Socket"}
              </span>
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)", marginTop: "4px" }}>
              Dual MT4 + MT5 execution simultaneously active
            </div>
          </div>
        </div>

        {/* Strategy Magic Numbers & Multi-Trade Isolation Map */}
        <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", fontWeight: 700, marginBottom: "6px" }}>
            HOW MULTI-STRATEGY CONCURRENT TRADES RUN ON OCTAFX MT4 WITHOUT COLLISION:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px", fontSize: "11px" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-dim)" }}>Magic </span>
              <code style={{ color: "#38bdf8", fontWeight: 700 }}>10101</code>: Scalper
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-dim)" }}>Magic </span>
              <code style={{ color: "#38bdf8", fontWeight: 700 }}>10202</code>: Qlib GBDT
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-dim)" }}>Magic </span>
              <code style={{ color: "#38bdf8", fontWeight: 700 }}>10303</code>: PatchTST
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-dim)" }}>Magic </span>
              <code style={{ color: "#38bdf8", fontWeight: 700 }}>10404</code>: FinRL PPO
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.4)", padding: "6px 8px", borderRadius: "4px", border: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-dim)" }}>Magic </span>
              <code style={{ color: "#38bdf8", fontWeight: 700 }}>10505</code>: Mean-Reversion
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
