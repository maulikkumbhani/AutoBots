//+------------------------------------------------------------------+
//|                                     AutoBot_MT5_BridgeNew.mq5    |
//|                    AutoBot Quantitative Intelligence Terminal    |
//|         Direct Local File IPC + Autonomous Scalper + HTTP Bridge |
//+------------------------------------------------------------------+
#property copyright "AutoBot Quant Engine"
#property link      "http://localhost:8000"
#property version   "2.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input Parameters
input group "=== AutoBot Server Connection ==="
input string   InpServerUrl           = "http://127.0.0.1:8000"; // Server URL (HTTP Fallback)
input int      InpPollIntervalSec     = 2;                       // Polling Interval (Seconds)
input ulong    InpMagicNumber         = 888999;                  // Unique Magic Number
input double   InpDefaultLots         = 0.05;                    // Default Lot Size (XAUUSD Gold)
input ulong    InpDeviationPoints     = 20;                      // Slippage Tolerance (Points)

input group "=== Autonomous Algorithmic Execution ==="
input bool     InpAutonomousScalper   = true;                    // Enable Autonomous Quant Scalper (Zero-Lag)
input int      InpFastEmaPeriod       = 9;                       // Fast EMA Period
input int      InpSlowEmaPeriod       = 21;                      // Slow EMA Period
input double   InpTakeProfitPoints    = 800;                     // Take Profit in Points ($8.00 on Gold)
input double   InpStopLossPoints      = 400;                     // Stop Loss in Points ($4.00 on Gold)
input int      InpCooldownSeconds     = 60;                      // Minimum cooldown between auto-trades

//--- Global Objects & State
CTrade         ExtTrade;
datetime       ExtLastPollTime = 0;
datetime       ExtLastAutoTradeTime = 0;
int            ExtExecutedCount = 0;
string         ExtLastStatus = "Initializing...";
string         ExtLastExecutedTicket = "None";
int            ExtFastEmaHandle = INVALID_HANDLE;
int            ExtSlowEmaHandle = INVALID_HANDLE;

// File Names in MQL5/Files (Local Direct IPC)
const string FILE_ORDERS    = "autobot_orders.txt";
const string FILE_RESULTS   = "autobot_results.txt";
const string FILE_TELEMETRY = "autobot_telemetry.txt";

//+------------------------------------------------------------------+
//| Utility to clean and normalize base server URL                   |
//+------------------------------------------------------------------+
string CleanUrl(string url)
{
   string cleaned = url;
   StringTrimLeft(cleaned);
   StringTrimRight(cleaned);
   while (StringLen(cleaned) > 0 && StringSubstr(cleaned, StringLen(cleaned) - 1, 1) == "/")
   {
      cleaned = StringSubstr(cleaned, 0, StringLen(cleaned) - 1);
   }
   return cleaned;
}

//+------------------------------------------------------------------+
//| Sets optimal filling mode for broker                             |
//+------------------------------------------------------------------+
void SetOptimalFillingMode(string sym)
{
   uint filling = (uint)SymbolInfoInteger(sym, SYMBOL_FILLING_MODE);
   if ((filling & SYMBOL_FILLING_FOK) != 0)
      ExtTrade.SetTypeFilling(ORDER_FILLING_FOK);
   else if ((filling & SYMBOL_FILLING_IOC) != 0)
      ExtTrade.SetTypeFilling(ORDER_FILLING_IOC);
   else
      ExtTrade.SetTypeFilling(ORDER_FILLING_RETURN);
}

//+------------------------------------------------------------------+
//| Creates on-chart 1-click execution buttons                       |
//+------------------------------------------------------------------+
void CreateChartButtons()
{
   // Buy Button
   ObjectCreate(0, "BtnAutoBotBuy", OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_XDISTANCE, 20);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_YDISTANCE, 225);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_XSIZE, 155);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_YSIZE, 32);
   ObjectSetString(0, "BtnAutoBotBuy", OBJPROP_TEXT, "⚡ BUY 0.05 XAUUSD");
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_BGCOLOR, clrDarkGreen);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_CORNER, CORNER_LEFT_UPPER);

   // Sell Button
   ObjectCreate(0, "BtnAutoBotSell", OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_XDISTANCE, 185);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_YDISTANCE, 225);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_XSIZE, 155);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_YSIZE, 32);
   ObjectSetString(0, "BtnAutoBotSell", OBJPROP_TEXT, "⚡ SELL 0.05 XAUUSD");
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_BGCOLOR, clrMaroon);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_CORNER, CORNER_LEFT_UPPER);

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Writes live telemetry to local file for Python backend           |
//+------------------------------------------------------------------+
void WriteLocalTelemetry()
{
   int handle = FileOpen(FILE_TELEMETRY, FILE_WRITE|FILE_TXT|FILE_ANSI);
   if (handle != INVALID_HANDLE)
   {
      double bal = AccountInfoDouble(ACCOUNT_BALANCE);
      double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
      double mar = AccountInfoDouble(ACCOUNT_MARGIN);
      double fmar= AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      long logn  = AccountInfoInteger(ACCOUNT_LOGIN);
      string srv = AccountInfoString(ACCOUNT_SERVER);
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      bool algoOn= (bool)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED);

      string data = StringFormat("%d|%s|%.2f|%.2f|%.2f|%.2f|%s|%.5f|%.5f|%d|%d|%s",
         logn, srv, bal, eq, mar, fmar, _Symbol, bid, ask, algoOn ? 1 : 0, ExtExecutedCount, TimeToString(TimeCurrent())
      );
      FileWriteString(handle, data);
      FileClose(handle);
   }
}

// Forward declarations
void ExecuteMarketOrder(string sym, string side, double lots, double sl_pts, double tp_pts, string comment, string sigId);
void CheckAndExecuteLocalOrders();
void CheckAutonomousStrategy();
void UpdateChartHUD();

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("==================================================================");
   Print("[AutoBot v2.00] Initializing Direct File IPC + Autonomous Bridge...");
   PrintFormat("[AutoBot] Target Symbol: %s | Magic: %d | Default Lots: %.2f", _Symbol, InpMagicNumber, InpDefaultLots);

   ExtTrade.SetExpertMagicNumber(InpMagicNumber);
   ExtTrade.SetDeviationInPoints(InpDeviationPoints);
   SetOptimalFillingMode(_Symbol);

   // Create Indicators for autonomous scalper
   ExtFastEmaHandle = iMA(_Symbol, _Period, InpFastEmaPeriod, 0, MODE_EMA, PRICE_CLOSE);
   ExtSlowEmaHandle = iMA(_Symbol, _Period, InpSlowEmaPeriod, 0, MODE_EMA, PRICE_CLOSE);

   CreateChartButtons();
   EventSetTimer(InpPollIntervalSec);

   WriteLocalTelemetry();
   UpdateChartHUD();

   Print("[AutoBot v2.00] Initialization Complete. Direct File Bridge READY.");
   Print("==================================================================");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectDelete(0, "BtnAutoBotBuy");
   ObjectDelete(0, "BtnAutoBotSell");
   if (ExtFastEmaHandle != INVALID_HANDLE) IndicatorRelease(ExtFastEmaHandle);
   if (ExtSlowEmaHandle != INVALID_HANDLE) IndicatorRelease(ExtSlowEmaHandle);
   Comment("");
   Print("[AutoBot] Stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();
   if (now - ExtLastPollTime >= InpPollIntervalSec)
   {
      ExtLastPollTime = now;
      CheckAndExecuteLocalOrders();
      if (InpAutonomousScalper)
         CheckAutonomousStrategy();
      WriteLocalTelemetry();
      UpdateChartHUD();
   }
}

//+------------------------------------------------------------------+
//| Expert timer function                                            |
//+------------------------------------------------------------------+
void OnTimer()
{
   CheckAndExecuteLocalOrders();
   if (InpAutonomousScalper)
      CheckAutonomousStrategy();
   WriteLocalTelemetry();
   UpdateChartHUD();
}

//+------------------------------------------------------------------+
//| Chart event handler (Handles 1-Click Buy/Sell Buttons)           |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if (id == CHARTEVENT_OBJECT_CLICK)
   {
      if (sparam == "BtnAutoBotBuy")
      {
         Print("[AutoBot 1-CLICK] Buy button clicked on chart!");
         ExecuteMarketOrder(_Symbol, "BUY", InpDefaultLots, InpStopLossPoints, InpTakeProfitPoints, "AutoBot_1Click_BUY", "MANUAL_UI");
         ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_STATE, false);
         ChartRedraw(0);
      }
      else if (sparam == "BtnAutoBotSell")
      {
         Print("[AutoBot 1-CLICK] Sell button clicked on chart!");
         ExecuteMarketOrder(_Symbol, "SELL", InpDefaultLots, InpStopLossPoints, InpTakeProfitPoints, "AutoBot_1Click_SELL", "MANUAL_UI");
         ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_STATE, false);
         ChartRedraw(0);
      }
   }
}

//+------------------------------------------------------------------+
//| Checks and executes orders written to local file by Python       |
//+------------------------------------------------------------------+
void CheckAndExecuteLocalOrders()
{
   if (!FileIsExist(FILE_ORDERS)) return;

   int handle = FileOpen(FILE_ORDERS, FILE_READ|FILE_TXT|FILE_ANSI);
   if (handle == INVALID_HANDLE) return;

   string lines[];
   int count = 0;
   while (!FileIsEnding(handle))
   {
      string line = FileReadString(handle);
      StringTrimLeft(line);
      StringTrimRight(line);
      if (StringLen(line) > 5)
      {
         ArrayResize(lines, count + 1);
         lines[count] = line;
         count++;
      }
   }
   FileClose(handle);

   if (count == 0) return;

   bool updated = false;
   for (int i = 0; i < count; i++)
   {
      string parts[];
      int n = StringSplit(lines[i], '|', parts);
      // Format: signal_id|symbol|side|lots|sl_pts|tp_pts|comment|status
      if (n >= 8 && parts[7] == "QUEUED")
      {
         string sigId = parts[0];
         string sym   = parts[1];
         string side  = parts[2];
         double lots  = StringToDouble(parts[3]);
         double slPts = StringToDouble(parts[4]);
         double tpPts = StringToDouble(parts[5]);
         string cmt   = parts[6];

         if (lots <= 0.0) lots = InpDefaultLots;
         if (sym == "") sym = _Symbol;

         PrintFormat("[AutoBot IPC] Found pending signal %s: %s %.2f lots %s", sigId, side, lots, sym);
         ExecuteMarketOrder(sym, side, lots, slPts, tpPts, cmt, sigId);

         parts[7] = "PROCESSED";
         lines[i] = StringFormat("%s|%s|%s|%.2f|%.1f|%.1f|%s|%s", parts[0], parts[1], parts[2], lots, slPts, tpPts, cmt, parts[7]);
         updated = true;
      }
   }

   // Write back updated status to prevent duplicate execution
   if (updated)
   {
      int outHandle = FileOpen(FILE_ORDERS, FILE_WRITE|FILE_TXT|FILE_ANSI);
      if (outHandle != INVALID_HANDLE)
      {
         for (int i = 0; i < count; i++)
            FileWriteString(outHandle, lines[i] + "\r\n");
         FileClose(outHandle);
      }
   }
}

//+------------------------------------------------------------------+
//| Autonomous Scalping Engine (EMA Cross on XAUUSD)                 |
//+------------------------------------------------------------------+
void CheckAutonomousStrategy()
{
   datetime now = TimeCurrent();
   if (now - ExtLastAutoTradeTime < InpCooldownSeconds) return;

   // Check if we already have an open position on current symbol
   int openCount = 0;
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if (PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         openCount++;
   }
   if (openCount >= 2) return; // Maximum 2 concurrent positions per strategy

   double fastEma[], slowEma[];
   ArraySetAsSeries(fastEma, true);
   ArraySetAsSeries(slowEma, true);

   if (CopyBuffer(ExtFastEmaHandle, 0, 0, 3, fastEma) < 3) return;
   if (CopyBuffer(ExtSlowEmaHandle, 0, 0, 3, slowEma) < 3) return;

   // Bullish EMA crossover: Fast crossed above Slow
   bool bullishCross = (fastEma[1] > slowEma[1] && fastEma[2] <= slowEma[2]);
   // Bearish EMA crossover: Fast crossed below Slow
   bool bearishCross = (fastEma[1] < slowEma[1] && fastEma[2] >= slowEma[2]);

   if (bullishCross)
   {
      Print("[AutoBot Autonomous] Bullish EMA crossover detected on ", _Symbol, "! Executing BUY...");
      ExecuteMarketOrder(_Symbol, "BUY", InpDefaultLots, InpStopLossPoints, InpTakeProfitPoints, "AutoBot_AutoScalp_BUY", "AUTONOMOUS");
      ExtLastAutoTradeTime = now;
   }
   else if (bearishCross)
   {
      Print("[AutoBot Autonomous] Bearish EMA crossover detected on ", _Symbol, "! Executing SELL...");
      ExecuteMarketOrder(_Symbol, "SELL", InpDefaultLots, InpStopLossPoints, InpTakeProfitPoints, "AutoBot_AutoScalp_SELL", "AUTONOMOUS");
      ExtLastAutoTradeTime = now;
   }
}

//+------------------------------------------------------------------+
//| Executes Market Order via CTrade                                 |
//+------------------------------------------------------------------+
void ExecuteMarketOrder(string sym, string side, double lots, double sl_pts, double tp_pts, string comment, string sigId)
{
   if (!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("❌ [AutoBot EXECUTION BLOCKED] Algo Trading button at top MT5 toolbar is OFF (Red)!");
      Print("👉 Please CLICK the top 'Algo Trading' button in MT5 to turn it GREEN!");
      ExtLastStatus = "BLOCKED: Algo Trading button is RED";
      return;
   }

   if (!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("❌ [AutoBot EXECUTION BLOCKED] EA automated trading disabled in Common tab!");
      ExtLastStatus = "BLOCKED: Check Common tab -> Allow Algo Trading";
      return;
   }

   SymbolSelect(sym, true);
   SetOptimalFillingMode(sym);

   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   int digits   = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);

   double execPrice = 0.0;
   double sl = 0.0;
   double tp = 0.0;
   bool success = false;

   if (side == "BUY")
   {
      execPrice = SymbolInfoDouble(sym, SYMBOL_ASK);
      if (sl_pts > 0) sl = NormalizeDouble(execPrice - (sl_pts * point), digits);
      if (tp_pts > 0) tp = NormalizeDouble(execPrice + (tp_pts * point), digits);
      success = ExtTrade.Buy(lots, sym, execPrice, sl, tp, comment);
   }
   else if (side == "SELL")
   {
      execPrice = SymbolInfoDouble(sym, SYMBOL_BID);
      if (sl_pts > 0) sl = NormalizeDouble(execPrice + (sl_pts * point), digits);
      if (tp_pts > 0) tp = NormalizeDouble(execPrice - (tp_pts * point), digits);
      success = ExtTrade.Sell(lots, sym, execPrice, sl, tp, comment);
   }

   ulong ticket = ExtTrade.ResultOrder();
   int errCode = (int)ExtTrade.ResultRetcode();
   string errMsg = ExtTrade.ResultRetcodeDescription();

   if (success)
   {
      ExtExecutedCount++;
      ExtLastExecutedTicket = StringFormat("#%d", ticket);
      ExtLastStatus = StringFormat("FILLED %s %.2f @ %.2f (Ticket %s)", side, lots, execPrice, ExtLastExecutedTicket);
      PrintFormat("✅ [AutoBot TRADE SUCCESS] %s %.2f lots %s @ %.2f | Ticket #%d | TP: %.2f, SL: %.2f",
         side, lots, sym, execPrice, ticket, tp, sl
      );
   }
   else
   {
      ExtLastStatus = StringFormat("ERROR: %d - %s", errCode, errMsg);
      PrintFormat("❌ [AutoBot TRADE ERROR] %s failed! Code: %d (%s)", side, errCode, errMsg);
   }

   // Record result to local results file for Python backend
   int resHandle = FileOpen(FILE_RESULTS, FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI);
   if (resHandle != INVALID_HANDLE)
   {
      FileSeek(resHandle, 0, SEEK_END);
      string resLine = StringFormat("%s|%d|%s|%s|%.2f|%.5f|%.5f|%.5f|%s|%d|%s|%s",
         sigId, ticket, sym, side, lots, execPrice, sl, tp, success ? "1" : "0", errCode, errMsg, TimeToString(TimeCurrent())
      );
      FileWriteString(resHandle, resLine + "\r\n");
      FileClose(resHandle);
   }

   WriteLocalTelemetry();
}

//+------------------------------------------------------------------+
//| Updates on-chart HUD diagnostics                                 |
//+------------------------------------------------------------------+
void UpdateChartHUD()
{
   bool algoBtn = (bool)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED);
   bool eaTrade = (bool)MQLInfoInteger(MQL_TRADE_ALLOWED);

   double bal = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   double fmar= AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string srv = AccountInfoString(ACCOUNT_SERVER);

   string algoWarning = "";
   if (!algoBtn)
   {
      algoWarning = "\n⚠️ ACTION REQUIRED: Click the top 'Algo Trading' button in MT5 to make it GREEN!";
   }

   string hud = StringFormat(
      "⚡ AutoBot MT5 Execution Engine v2.00 (DIRECT LOCAL FILE IPC)\n" +
      "----------------------------------------------------------------\n" +
      "Account: %d | Server: %s\n" +
      "Symbol: %s | Live Price: %.2f\n" +
      "Balance: $%.2f | Equity: $%.2f | Free Margin: $%.2f\n" +
      "Orders Executed This Session: %d | Last Ticket: %s\n" +
      "Autonomous Scalper: %s | Mode: Direct Local File Bridge\n" +
      "----------------------------------------------------------------\n" +
      "Top Algo Trading Button: %s\n" +
      "EA Trade Allowed: %s%s\n" +
      "Status: %s\n" +
      "----------------------------------------------------------------\n" +
      "Click [BUY] or [SELL] buttons below for instant 1-click execution",
      login, srv, _Symbol, SymbolInfoDouble(_Symbol, SYMBOL_BID),
      bal, eq, fmar, ExtExecutedCount, ExtLastExecutedTicket,
      InpAutonomousScalper ? "✅ ACTIVE (EMA 9/21 Auto-Scalp)" : "MANUAL ONLY",
      algoBtn ? "✅ ON (Green)" : "❌ OFF (RED - TRADES BLOCKED!)",
      eaTrade ? "✅ ENABLED" : "❌ DISABLED",
      algoWarning, ExtLastStatus
   );

   Comment(hud);
}
