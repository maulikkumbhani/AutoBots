//+------------------------------------------------------------------+
//|                                        AutoBot_MT5_BridgeNew.mq5 |
//|                                  Copyright 2026, AutoBot Systems |
//|                                      https://autobots-quant.com/ |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, AutoBot Systems"
#property link        "https://autobots-quant.com/"
#property version     "2.10"
#property description "AutoBot MT5 High-Frequency Scalper & Risk Harvester"
#property strict

#include <Trade\Trade.mqh>

//--- Input Parameters
input group "=== AutoBot Server & IPC Settings ==="
input string   InpServerUrl         = "http://127.0.0.1:8000"; // AutoBot Backend URL
input int      InpPollIntervalSec   = 1;                       // Fast Poll Interval (Seconds)
input ulong    InpMagicNumber       = 888999;                  // Unique Magic Number
input double   InpDefaultLots       = 0.05;                    // Default Lot Size
input int      InpDeviationPoints   = 20;                      // Slippage Tolerance (Points)
input int      InpMaxOpenPositions  = 50;                      // Max Open Positions (supports up to 50x micro-bursts)

input group "=== Micro-Profit Scalping & Risk Guards ==="
input double   InpTakeProfitPts     = 2.20;                    // Micro-Scalp TP in USD ($2.20 on Gold)
input double   InpStopLossPts       = 1.50;                    // Micro-Scalp SL in USD ($1.50 on Gold)
input double   InpSubDollarProfit   = 0.50;                    // Sub-Dollar Micro-Burst Quick Profit Harvest ($0.50)
input double   InpQuickProfitClose  = 1.50;                    // Standard Auto-Harvest Profit in USD per trade ($1.50)
input double   InpMaxLossClose      = 8.00;                    // Hard Stop Loss in USD per trade ($8.00)
input bool     InpTrailingStop      = true;                    // Enable Dynamic Trailing & Break-Even
input bool     InpAutonomousScalper = true;                    // Autonomous EMA 9/21 Micro Scalper

//--- Constants
const string FILE_ORDERS    = "autobot_orders.txt";
const string FILE_RESULTS   = "autobot_results.txt";
const string FILE_TELEMETRY = "autobot_telemetry.txt";

//--- Global Variables
CTrade         ExtTrade;
datetime       ExtLastPollTime        = 0;
datetime       ExtLastAutoTradeTime   = 0;
int            ExtExecutedCount       = 0;
string         ExtLastStatus          = "STANDBY: Ready";
string         ExtLastExecutedTicket  = "None";
int            ExtFastEmaHandle       = INVALID_HANDLE;
int            ExtSlowEmaHandle       = INVALID_HANDLE;

//--- Function Prototypes
void CheckAndExecuteLocalOrders();
void CheckAutonomousStrategy();
void ManageOpenPositions();
void CloseAllPositions(string reason);
void UpdateChartHUD();
void WriteLocalTelemetry();
void SetOptimalFillingMode(string sym);
void CreateChartButtons();
void ExecuteMarketOrder(string sym, string side, double lots, double sl_val, double tp_val, string comment, string sigId);

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
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_XSIZE, 110);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_YSIZE, 30);
   ObjectSetString(0, "BtnAutoBotBuy", OBJPROP_TEXT, "⚡ BUY 0.05");
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_BGCOLOR, clrDarkGreen);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_CORNER, CORNER_LEFT_UPPER);

   // Sell Button
   ObjectCreate(0, "BtnAutoBotSell", OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_XDISTANCE, 135);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_YDISTANCE, 225);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_XSIZE, 110);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_YSIZE, 30);
   ObjectSetString(0, "BtnAutoBotSell", OBJPROP_TEXT, "⚡ SELL 0.05");
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_BGCOLOR, clrMaroon);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_CORNER, CORNER_LEFT_UPPER);

   // Emergency Close All Button
   ObjectCreate(0, "BtnAutoBotCloseAll", OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_XDISTANCE, 250);
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_YDISTANCE, 225);
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_XSIZE, 130);
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_YSIZE, 30);
   ObjectSetString(0, "BtnAutoBotCloseAll", OBJPROP_TEXT, "🚨 CLOSE ALL");
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_BGCOLOR, clrCrimson);
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_CORNER, CORNER_LEFT_UPPER);

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
      int openCount = PositionsTotal();

      string data = StringFormat("%d|%s|%.2f|%.2f|%.2f|%.2f|%s|%.5f|%.5f|%d|%d|%s|%d",
         logn, srv, bal, eq, mar, fmar, _Symbol, bid, ask, algoOn ? 1 : 0, ExtExecutedCount, TimeToString(TimeCurrent()), openCount
      );
      FileWriteString(handle, data);
      FileClose(handle);
   }
}

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("==================================================================");
   Print("[AutoBot v2.10] Initializing High-Frequency Scalper & Risk Harvester...");
   PrintFormat("[AutoBot] Target Symbol: %s | Magic: %d | Max Open Positions: %d", _Symbol, InpMagicNumber, InpMaxOpenPositions);

   ExtTrade.SetExpertMagicNumber(InpMagicNumber);
   ExtTrade.SetDeviationInPoints(InpDeviationPoints);
   SetOptimalFillingMode(_Symbol);

   ExtFastEmaHandle = iMA(_Symbol, _Period, 9, 0, MODE_EMA, PRICE_CLOSE);
   ExtSlowEmaHandle = iMA(_Symbol, _Period, 21, 0, MODE_EMA, PRICE_CLOSE);

   CreateChartButtons();
   EventSetTimer(InpPollIntervalSec);

   WriteLocalTelemetry();
   UpdateChartHUD();

   Print("[AutoBot v2.10] Ready. Automatic Profit Harvester & Risk Guard Active.");
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
   ObjectDelete(0, "BtnAutoBotCloseAll");
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
   ManageOpenPositions();
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
   ManageOpenPositions();
   CheckAndExecuteLocalOrders();
   if (InpAutonomousScalper)
      CheckAutonomousStrategy();
   WriteLocalTelemetry();
   UpdateChartHUD();
}

//+------------------------------------------------------------------+
//| Closes all open positions immediately                            |
//+------------------------------------------------------------------+
void CloseAllPositions(string reason)
{
   Print("🚨 [AutoBot RISK GUARD] Closing all open positions! Reason: ", reason);
   int closed = 0;
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if (ticket > 0)
      {
         if (ExtTrade.PositionClose(ticket))
         {
            closed++;
         }
      }
   }
   ExtLastStatus = StringFormat("CLOSED ALL %d POSITIONS (%s)", closed, reason);
   PrintFormat("✅ Successfully closed %d positions.", closed);
   WriteLocalTelemetry();
   UpdateChartHUD();
}

//+------------------------------------------------------------------+
//| Actively manages open positions (TP/SL, Trailing & Risk Limits)  |
//+------------------------------------------------------------------+
void ManageOpenPositions()
{
   int total = PositionsTotal();
   if (total == 0) return;

   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);

   for (int i = total - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if (ticket <= 0) continue;

      if (!PositionSelectByTicket(ticket)) continue;

      string sym = PositionGetString(POSITION_SYMBOL);
      if (sym != _Symbol) continue;

      long posType   = PositionGetInteger(POSITION_TYPE);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double currentSL = PositionGetDouble(POSITION_SL);
      double currentTP = PositionGetDouble(POSITION_TP);
      double profit    = PositionGetDouble(POSITION_PROFIT);

      // 1. AUTO-HARVEST QUICK PROFIT: Sub-dollar ($0.50) for Burst orders; $1.50 for standard scalps
      string posComment = PositionGetString(POSITION_COMMENT);
      double harvestThreshold = (StringFind(posComment, "Burst") >= 0) ? InpSubDollarProfit : InpQuickProfitClose;

      if (profit >= harvestThreshold)
      {
         PrintFormat("💰 [AutoBot PROFIT HARVEST] Position #%I64u (%s) reached +$%.2f profit! Locking in profit now.", ticket, posComment, profit);
         ExtTrade.PositionClose(ticket);
         continue;
      }

      // 1b. EXPLICIT TP & SL PRICE REACHED CHECK
      if (currentTP > 0)
      {
         if ((posType == POSITION_TYPE_BUY && bid >= currentTP) ||
             (posType == POSITION_TYPE_SELL && ask <= currentTP))
         {
            PrintFormat("💰 [AutoBot TP REACHED] Position #%I64u reached TP %.2f! Locking in profit now.", ticket, currentTP);
            ExtTrade.PositionClose(ticket);
            continue;
         }
      }
      if (currentSL > 0)
      {
         if ((posType == POSITION_TYPE_BUY && bid <= currentSL) ||
             (posType == POSITION_TYPE_SELL && ask >= currentSL))
         {
            PrintFormat("🛑 [AutoBot SL HIT] Position #%I64u reached SL %.2f! Cutting loss.", ticket, currentSL);
            ExtTrade.PositionClose(ticket);
            continue;
         }
      }

      // 2. HARD STOP LOSS: If loss exceeds -$12.50, close to prevent large drawdown
      if (profit <= -InpMaxLossClose)
      {
         PrintFormat("🛑 [AutoBot RISK STOP] Position #%I64u floating loss -$%.2f exceeded limit. Cutting loss now.", ticket, MathAbs(profit));
         ExtTrade.PositionClose(ticket);
         continue;
      }

      // 3. BREAK-EVEN LOCK & TRAILING STOP
      if (InpTrailingStop)
      {
         if (posType == POSITION_TYPE_BUY)
         {
            double gainPts = bid - openPrice;
            // If in profit by $1.20, move SL to openPrice + $0.30
            if (gainPts >= 1.20)
            {
               double newSL = NormalizeDouble(openPrice + 0.30, 2);
               if (currentSL < newSL)
               {
                  ExtTrade.PositionModify(ticket, newSL, currentTP);
               }
            }
         }
         else if (posType == POSITION_TYPE_SELL)
         {
            double gainPts = openPrice - ask;
            if (gainPts >= 1.20)
            {
               double newSL = NormalizeDouble(openPrice - 0.30, 2);
               if (currentSL == 0.0 || currentSL > newSL)
               {
                  ExtTrade.PositionModify(ticket, newSL, currentTP);
               }
            }
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Chart event handler                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if (id == CHARTEVENT_OBJECT_CLICK)
   {
      if (sparam == "BtnAutoBotBuy")
      {
         Print("[AutoBot 1-CLICK] Buy button clicked on chart!");
         ExecuteMarketOrder(_Symbol, "BUY", InpDefaultLots, InpStopLossPts, InpTakeProfitPts, "AutoBot_1Click_BUY", "MANUAL_UI");
         ObjectSetInteger(0, "BtnAutoBotBuy", OBJPROP_STATE, false);
         ChartRedraw(0);
      }
      else if (sparam == "BtnAutoBotSell")
      {
         Print("[AutoBot 1-CLICK] Sell button clicked on chart!");
         ExecuteMarketOrder(_Symbol, "SELL", InpDefaultLots, InpStopLossPts, InpTakeProfitPts, "AutoBot_1Click_SELL", "MANUAL_UI");
         ObjectSetInteger(0, "BtnAutoBotSell", OBJPROP_STATE, false);
         ChartRedraw(0);
      }
      else if (sparam == "BtnAutoBotCloseAll")
      {
         Print("[AutoBot 1-CLICK] Close All button clicked on chart!");
         CloseAllPositions("Manual On-Chart Button");
         ObjectSetInteger(0, "BtnAutoBotCloseAll", OBJPROP_STATE, false);
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
      if (n >= 8 && parts[7] == "QUEUED")
      {
         string sigId = parts[0];
         string sym   = parts[1];
         string side  = parts[2];
         double lots  = StringToDouble(parts[3]);
         double slVal = StringToDouble(parts[4]);
         double tpVal = StringToDouble(parts[5]);
         string cmt   = parts[6];

         // Handle Emergency Close Command
         if (side == "CLOSE_ALL")
         {
            CloseAllPositions("Remote UI Command");
            lines[i] = sigId + "|" + sym + "|CLOSE_ALL|0|0|0|" + cmt + "|DONE";
            updated = true;
            continue;
         }

         // Handle Individual Ticket Remote Close Command
         if (side == "CLOSE_TICKET" || side == "CLOSE")
         {
            ulong targetTicket = (ulong)StringToInteger(cmt);
            if (targetTicket > 0)
            {
               if (ExtTrade.PositionClose(targetTicket))
                  PrintFormat("✅ [AutoBot REMOTE CLOSE] Successfully closed ticket #%I64u", targetTicket);
               else
                  PrintFormat("⚠️ [AutoBot REMOTE CLOSE] Ticket #%I64u not found or already closed on broker.", targetTicket);
            }
            lines[i] = sigId + "|" + sym + "|" + side + "|0|0|0|" + cmt + "|DONE";
            updated = true;
            continue;
         }

         // STRICT RISK CAP: Maximum open positions guard
         int currentOpen = PositionsTotal();
         if (currentOpen >= InpMaxOpenPositions)
         {
            PrintFormat("[AutoBot RISK GUARD] Max open positions (%d) reached. Skipping order %s to protect capital.", InpMaxOpenPositions, sigId);
            lines[i] = sigId + "|" + sym + "|" + side + "|0|0|0|" + cmt + "|SKIPPED_MAX_POS";
            updated = true;
            continue;
         }

         ExecuteMarketOrder(sym, side, lots, slVal, tpVal, cmt, sigId);
         lines[i] = sigId + "|" + sym + "|" + side + "|" + DoubleToString(lots, 2) + "|" + DoubleToString(slVal, 2) + "|" + DoubleToString(tpVal, 2) + "|" + cmt + "|EXECUTED";
         updated = true;
      }
   }

   if (updated)
   {
      int writeHandle = FileOpen(FILE_ORDERS, FILE_WRITE|FILE_TXT|FILE_ANSI);
      if (writeHandle != INVALID_HANDLE)
      {
         for (int j = 0; j < ArraySize(lines); j++)
         {
            FileWriteString(writeHandle, lines[j] + "\r\n");
         }
         FileClose(writeHandle);
      }
   }
}

//+------------------------------------------------------------------+
//| Autonomous Scalper Strategy (EMA 9/21 Micro-Momentum)            |
//+------------------------------------------------------------------+
void CheckAutonomousStrategy()
{
   datetime now = TimeCurrent();
   if (now - ExtLastAutoTradeTime < 60) return; // 60s cooldown

   // Strict Cap: Only 1 autonomous position at a time
   int openCount = 0;
   for (int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if (PositionGetSymbol(i) == _Symbol && PositionGetInteger(POSITION_MAGIC) == InpMagicNumber)
         openCount++;
   }
   if (openCount >= 1) return;

   double fastEma[], slowEma[];
   ArraySetAsSeries(fastEma, true);
   ArraySetAsSeries(slowEma, true);

   if (CopyBuffer(ExtFastEmaHandle, 0, 0, 3, fastEma) < 3) return;
   if (CopyBuffer(ExtSlowEmaHandle, 0, 0, 3, slowEma) < 3) return;

   bool bullishCross = (fastEma[1] > slowEma[1] && fastEma[2] <= slowEma[2]);
   bool bearishCross = (fastEma[1] < slowEma[1] && fastEma[2] >= slowEma[2]);

   if (bullishCross)
   {
      Print("[AutoBot Autonomous] Bullish EMA crossover on ", _Symbol, "! Executing BUY...");
      ExecuteMarketOrder(_Symbol, "BUY", InpDefaultLots, InpStopLossPts, InpTakeProfitPts, "Auto_Scalp_BUY", "AUTONOMOUS");
      ExtLastAutoTradeTime = now;
   }
   else if (bearishCross)
   {
      Print("[AutoBot Autonomous] Bearish EMA crossover on ", _Symbol, "! Executing SELL...");
      ExecuteMarketOrder(_Symbol, "SELL", InpDefaultLots, InpStopLossPts, InpTakeProfitPts, "Auto_Scalp_SELL", "AUTONOMOUS");
      ExtLastAutoTradeTime = now;
   }
}

//+------------------------------------------------------------------+
//| Executes Market Order via CTrade with Precise Micro-TP/SL        |
//+------------------------------------------------------------------+
void ExecuteMarketOrder(string sym, string side, double lots, double sl_val, double tp_val, string comment, string sigId)
{
   if (!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("❌ [AutoBot EXECUTION BLOCKED] Algo Trading button at top MT5 toolbar is OFF (Red)!");
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

   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double bid = SymbolInfoDouble(sym, SYMBOL_BID);
   double ask = SymbolInfoDouble(sym, SYMBOL_ASK);

   double execPrice = 0.0;
   double sl = 0.0;
   double tp = 0.0;
   bool success = false;

   // Standardize Gold Micro-Scalp Distances: TP = $2.20, SL = $1.50
   double defaultTpMove = InpTakeProfitPts;
   double defaultSlMove = InpStopLossPts;

   // Mandatory broker stop distance safety check: GUARANTEES HARD NON-ZERO SL ON BROKER
   long stopLevel = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
   double pt = SymbolInfoDouble(sym, SYMBOL_POINT);
   double minStopDist = MathMax(defaultSlMove, (stopLevel + 10) * pt);
   if (minStopDist < 1.50) minStopDist = 1.50;

   if (side == "BUY")
   {
      execPrice = ask;
      if (sl_val > 1000.0 && sl_val < execPrice - 0.50) sl = NormalizeDouble(sl_val, digits);
      else sl = NormalizeDouble(execPrice - minStopDist, digits);

      if (tp_val > 1000.0 && tp_val > execPrice + 0.50) tp = NormalizeDouble(tp_val, digits);
      else tp = NormalizeDouble(execPrice + defaultTpMove, digits);

      success = ExtTrade.Buy(lots, sym, execPrice, sl, tp, comment);
   }
   else if (side == "SELL")
   {
      execPrice = bid;
      if (sl_val > 1000.0 && sl_val > execPrice + 0.50) sl = NormalizeDouble(sl_val, digits);
      else sl = NormalizeDouble(execPrice + minStopDist, digits);

      if (tp_val > 1000.0 && tp_val < execPrice - 0.50) tp = NormalizeDouble(tp_val, digits);
      else tp = NormalizeDouble(execPrice - defaultTpMove, digits);

      success = ExtTrade.Sell(lots, sym, execPrice, sl, tp, comment);
   }

   ulong ticket = ExtTrade.ResultOrder();
   int errCode = (int)ExtTrade.ResultRetcode();
   string errMsg = ExtTrade.ResultRetcodeDescription();

   if (success)
   {
      ExtExecutedCount++;
      ExtLastExecutedTicket = StringFormat("#%I64u", ticket);
      ExtLastStatus = StringFormat("FILLED %s %.2f @ %.2f (Ticket %s)", side, lots, execPrice, ExtLastExecutedTicket);
      PrintFormat("✅ [AutoBot TRADE SUCCESS] %s %.2f lots %s @ %.2f | Ticket #%I64u | TP: %.2f, SL: %.2f",
         side, lots, sym, execPrice, ticket, tp, sl
      );
   }
   else
   {
      ExtLastStatus = StringFormat("ERROR: %d - %s", errCode, errMsg);
      PrintFormat("❌ [AutoBot TRADE ERROR] %s failed! Code: %d (%s)", side, errCode, errMsg);
   }

   // Record result to local results file
   int resHandle = FileOpen(FILE_RESULTS, FILE_READ|FILE_WRITE|FILE_TXT|FILE_ANSI);
   if (resHandle != INVALID_HANDLE)
   {
      FileSeek(resHandle, 0, SEEK_END);
      string resLine = StringFormat("%s|%I64u|%s|%s|%.2f|%.5f|%.5f|%.5f|%s|%d|%s|%s",
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
   int openCount = PositionsTotal();

   string algoWarning = "";
   if (!algoBtn)
   {
      algoWarning = "\n⚠️ ACTION REQUIRED: Click the top 'Algo Trading' button in MT5 to make it GREEN!";
   }

   string hud = StringFormat(
      "⚡ AutoBot MT5 Execution Engine v2.10 (DIRECT FILE IPC + RISK GUARD)\n" +
      "----------------------------------------------------------------\n" +
      "Account: %d | Server: %s\n" +
      "Symbol: %s | Live Price: %.2f\n" +
      "Balance: $%.2f | Equity: $%.2f | Free Margin: $%.2f\n" +
      "Active Positions: %d / %d Max | Session Executed: %d\n" +
      "Profit Harvester: Auto-Close @ +$%.2f | Hard Risk Guard: -$%.2f\n" +
      "----------------------------------------------------------------\n" +
      "Top Algo Trading Button: %s\n" +
      "EA Trade Allowed: %s%s\n" +
      "Status: %s\n" +
      "----------------------------------------------------------------\n" +
      "[BUY] [SELL] or [🚨 CLOSE ALL] buttons below",
      login, srv, _Symbol, SymbolInfoDouble(_Symbol, SYMBOL_BID),
      bal, eq, fmar, openCount, InpMaxOpenPositions, ExtExecutedCount,
      InpQuickProfitClose, InpMaxLossClose,
      algoBtn ? "✅ ON (Green)" : "❌ OFF (RED - TRADES BLOCKED!)",
      eaTrade ? "✅ ENABLED" : "❌ DISABLED",
      algoWarning, ExtLastStatus
   );

   Comment(hud);
}
