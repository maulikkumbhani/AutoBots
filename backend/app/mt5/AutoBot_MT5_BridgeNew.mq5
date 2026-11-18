//+------------------------------------------------------------------+
//|                                         AutoBot_MT5_Bridge.mq5   |
//|                    AutoBot Quantitative Intelligence Terminal    |
//|              Automated Buy/Sell Trade Execution from Predictions |
//+------------------------------------------------------------------+
#property copyright "AutoBot Quant Engine"
#property link      "http://localhost:8000"
#property version   "1.10"
#property strict

#include <Trade\Trade.mqh>

//--- Input Parameters
input group "=== AutoBot Server Connection ==="
input string   InpServerUrl       = "http://127.0.0.1:8000"; // InpServerUrl (AutoBot Server URL)
input int      InpPollIntervalSec = 2;                       // Poll Interval (Seconds)
input ulong    InpMagicNumber     = 888999;                  // Unique Magic Number
input double   InpDefaultLots     = 0.05;                    // Default Lot Size (e.g. 0.05 for Gold)
input ulong    InpDeviationPoints = 20;                      // Slippage Tolerance (Points)

//--- Global Objects
CTrade         ExtTrade;
datetime       ExtLastPollTime = 0;
int            ExtExecutedCount = 0;
string         ExtLastStatus = "Initializing...";

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
//| Dynamically sets supported order filling mode for current broker |
//+------------------------------------------------------------------+
void SetOptimalFillingMode(string sym)
{
   uint filling = (uint)SymbolInfoInteger(sym, SYMBOL_FILLING_MODE);
   if ((filling & SYMBOL_FILLING_FOK) != 0)
   {
      ExtTrade.SetTypeFilling(ORDER_FILLING_FOK);
   }
   else if ((filling & SYMBOL_FILLING_IOC) != 0)
   {
      ExtTrade.SetTypeFilling(ORDER_FILLING_IOC);
   }
   else
   {
      ExtTrade.SetTypeFilling(ORDER_FILLING_RETURN);
   }
}

// Forward declarations
void SendHeartbeat();
void PollAndExecuteSignals();
void ParseAndExecuteSignals(string jsonStr);
void ReportExecution(string sigId, ulong ticket, string sym, string side, double lots, double price, double sl, double tp, bool success, int errCode, string errMsg);
string ExtractJsonString(string src, string key);
double ExtractJsonDouble(string src, string key);

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("==================================================================");
   Print("[AutoBot] Initializing AutoBot MT5 Execution Bridge v1.10...");
   PrintFormat("[AutoBot] Server URL: %s | Target Chart: %s", InpServerUrl, _Symbol);

   ExtTrade.SetExpertMagicNumber(InpMagicNumber);
   ExtTrade.SetDeviationInPoints(InpDeviationPoints);
   SetOptimalFillingMode(_Symbol);

   // Check if Algo Trading is enabled globally in MT5
   if (!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("⚠️ [AutoBot WARNING] 'Algo Trading' button at top MT5 toolbar is OFF (Red)!");
      Print("👉 Please CLICK the 'Algo Trading' button in MT5 to turn it GREEN!");
   }
   if (!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("⚠️ [AutoBot WARNING] Automated trading is not permitted for this EA!");
      Print("👉 Right-click Chart -> Expert List -> AutoBot_MT5_Bridge -> Properties -> Common tab -> CHECK 'Allow Algo Trading'!");
   }

   // Set timer for periodic polling of AutoBot prediction signals
   EventSetTimer(InpPollIntervalSec);

   // Send initial registration heartbeat
   SendHeartbeat();

   Print("[AutoBot] AutoBot MT5 Bridge Successfully Started!");
   Print("==================================================================");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
   Print("[AutoBot] AutoBot MT5 Bridge Stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function (Instant execution on live price change)    |
//+------------------------------------------------------------------+
void OnTick()
{
   datetime now = TimeCurrent();
   if (now - ExtLastPollTime >= InpPollIntervalSec)
   {
      ExtLastPollTime = now;
      PollAndExecuteSignals();
   }
}

//+------------------------------------------------------------------+
//| Expert timer function (Periodically polls AutoBot backend)       |
//+------------------------------------------------------------------+
void OnTimer()
{
   // 1. Send live account telemetry (Balance, Equity, Free Margin)
   SendHeartbeat();

   // 2. Poll and execute pending prediction signals
   PollAndExecuteSignals();
}

//+------------------------------------------------------------------+
//| Sends Heartbeat and Account Telemetry to AutoBot Backend         |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string base = CleanUrl(InpServerUrl);
   string url = base + "/api/v1/mt5/bridge/heartbeat";
   string headers = "Content-Type: application/json\r\n";
   
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double free_margin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   long leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
   string server = AccountInfoString(ACCOUNT_SERVER);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);

   // Extract real live broker quotes from current chart
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double price = (bid > 0.0 && ask > 0.0) ? ((bid + ask) / 2.0) : (bid > 0.0 ? bid : ask);

   double day_open = iOpen(_Symbol, PERIOD_D1, 0);
   double day_high = iHigh(_Symbol, PERIOD_D1, 0);
   double day_low = iLow(_Symbol, PERIOD_D1, 0);
   double prev_close = iClose(_Symbol, PERIOD_D1, 1);
   if (prev_close <= 0.0) prev_close = day_open > 0 ? day_open : price;

   // Extract latest 30 OHLCV candles to stream directly to AutoBot web terminal
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int copied = CopyRates(_Symbol, _Period, 0, 30, rates);
   string candlesJson = "[";
   for(int i = 0; i < copied; i++)
   {
      string cStr = StringFormat(
         "{\"timestamp\":\"%s\",\"open\":%.5f,\"high\":%.5f,\"low\":%.5f,\"close\":%.5f,\"volume\":%.1f}",
         TimeToString(rates[i].time, TIME_DATE|TIME_SECONDS),
         rates[i].open, rates[i].high, rates[i].low, rates[i].close, (double)rates[i].tick_volume
      );
      candlesJson += (i > 0 ? "," : "") + cStr;
   }
   candlesJson += "]";

   string json = StringFormat(
      "{\"account\":\"%d\",\"server\":\"%s\",\"balance\":%.2f,\"equity\":%.2f,\"margin\":%.2f,\"free_margin\":%.2f,\"leverage\":%d,\"currency\":\"%s\",\"symbol\":\"%s\",\"bid\":%.5f,\"ask\":%.5f,\"price\":%.5f,\"day_open\":%.5f,\"day_high\":%.5f,\"day_low\":%.5f,\"prev_close\":%.5f,\"candles\":%s}",
      login, server, balance, equity, margin, free_margin, leverage, currency,
      _Symbol, bid, ask, price, day_open, day_high, day_low, prev_close, candlesJson
   );

   char postData[];
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1); // remove null terminator

   char result[];
   string resultHeaders;
   int res = WebRequest("POST", url, headers, 3000, postData, result, resultHeaders);

   bool algoBtnOn = (bool)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED);
   bool eaTradeOn = (bool)MQLInfoInteger(MQL_TRADE_ALLOWED);

   if (res == 200)
   {
      ExtLastStatus = "LIVE STREAMING";
      Comment(StringFormat(
         "⚡ AutoBot MT5 Bridge: CONNECTED (OK 200)\n" +
         "--------------------------------------------------\n" +
         "Server: %s\n" +
         "Account: %d | Server: %s\n" +
         "Symbol: %s | Live Price: %.2f\n" +
         "Balance: $%.2f | Free Margin: $%.2f\n" +
         "Total Orders Executed: %d\n" +
         "--------------------------------------------------\n" +
         "Algo Trading Button: %s\n" +
         "EA Trade Allowed: %s",
         base, login, server, _Symbol, price, balance, free_margin, ExtExecutedCount,
         algoBtnOn ? "✅ ON (Green)" : "❌ OFF (Click 'Algo Trading' at top!)",
         eaTradeOn ? "✅ ENABLED" : "❌ DISABLED (Check EA Common Tab!)"
      ));
   }
   else
   {
      int err = GetLastError();
      string hint = "";
      if (err == 4060)
      {
         ExtLastStatus = "BLOCKED (Error 4060)";
         hint = "⚠️ ERROR 4060: WebRequest Blocked by MT5 Security!\n" +
                "Fix in 3 clicks:\n" +
                "1. MT5 Menu -> Tools -> Options (Cmd+, / Ctrl+O)\n" +
                "2. Click 'Expert Advisors' tab\n" +
                "3. Check 'Allow WebRequest for listed URL'\n" +
                "4. Add: " + base + "\n" +
                "5. Also add: http://localhost:8000";
      }
      else
      {
         ExtLastStatus = StringFormat("HTTP %d (Err %d)", res, err);
         hint = StringFormat("⚠️ Connection Failed (HTTP %d, Error %d)\nMake sure AutoBot backend is running on %s", res, err, base);
      }

      Comment(StringFormat(
         "⚡ AutoBot MT5 Bridge: %s\n" +
         "--------------------------------------------------\n" +
         "%s\n" +
         "--------------------------------------------------\n" +
         "Server Target: %s",
         ExtLastStatus, hint, base
      ));
      PrintFormat("[AutoBot] Heartbeat WebRequest failed: HTTP %d, Error %d. %s", res, err, hint);
   }
}

//+------------------------------------------------------------------+
//| Polls pending BUY/SELL signals and executes them via CTrade      |
//+------------------------------------------------------------------+
void PollAndExecuteSignals()
{
   string base = CleanUrl(InpServerUrl);
   string url = base + "/api/v1/mt5/bridge/pending-signals";
   char postData[];
   char result[];
   string resultHeaders;

   int res = WebRequest("GET", url, "", 3000, postData, result, resultHeaders);
   if (res == 200 && ArraySize(result) > 2)
   {
      string responseJson = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      if (StringFind(responseJson, "\"signal_id\"") >= 0)
      {
         PrintFormat("[AutoBot] Received pending trade signals: %s", responseJson);
         ParseAndExecuteSignals(responseJson);
      }
   }
   else if (res != 200)
   {
      int err = GetLastError();
      if (err == 4060)
      {
         Print("[AutoBot ERROR 4060] Add '", base, "' to MT5 -> Tools -> Options -> Expert Advisors -> Allow WebRequest!");
      }
   }
}

//+------------------------------------------------------------------+
//| Parses signal array and triggers MT5 OrderSend                   |
//+------------------------------------------------------------------+
void ParseAndExecuteSignals(string jsonStr)
{
   if (StringFind(jsonStr, "\"signal_id\"") < 0) return;

   // Pre-check Algo Trading permissions before executing
   if (!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("❌ [AutoBot CANNOT EXECUTE] Algo Trading button at top MT5 toolbar is OFF! Please click it to turn GREEN.");
      return;
   }
   if (!MQLInfoInteger(MQL_TRADE_ALLOWED))
   {
      Print("❌ [AutoBot CANNOT EXECUTE] 'Allow Algo Trading' is unchecked in EA Properties Common tab!");
      return;
   }

   // Resilient JSON object extractor
   int pos = 0;
   while ((pos = StringFind(jsonStr, "{", pos)) >= 0)
   {
      int endPos = StringFind(jsonStr, "}", pos);
      if (endPos < 0) break;

      string objStr = StringSubstr(jsonStr, pos, endPos - pos + 1);
      pos = endPos + 1;

      if (StringFind(objStr, "\"signal_id\"") < 0) continue;

      string signalId = ExtractJsonString(objStr, "signal_id");
      string symbol   = ExtractJsonString(objStr, "symbol");
      string side     = ExtractJsonString(objStr, "side");
      double lots     = ExtractJsonDouble(objStr, "lots");
      double sl       = ExtractJsonDouble(objStr, "stop_loss");
      double tp       = ExtractJsonDouble(objStr, "take_profit");
      string comment  = ExtractJsonString(objStr, "comment");
      double magicNum = ExtractJsonDouble(objStr, "magic_number");

      if (lots <= 0.0) lots = InpDefaultLots;
      if (symbol == "") symbol = (_Symbol != "" ? _Symbol : "XAUUSD");

      // Isolate trades per strategy via magic number
      if (magicNum > 0) ExtTrade.SetExpertMagicNumber((ulong)magicNum);
      else ExtTrade.SetExpertMagicNumber(InpMagicNumber);

      // Ensure symbol is active in Market Watch
      SymbolSelect(symbol, true);

      // Set optimal filling mode (FOK / IOC / RETURN) for this specific symbol
      SetOptimalFillingMode(symbol);

      // Extract fresh live tick
      MqlTick tick;
      if (!SymbolInfoTick(symbol, tick))
      {
         SymbolSelect(symbol, true);
         SymbolInfoTick(symbol, tick);
      }

      // Check broker stop levels to prevent 10016 TRADE_RETCODE_INVALID_STOPS
      long stopsLevel = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      double minDistance = (stopsLevel + 5) * point;

      bool success = false;
      ulong ticket = 0;
      double execPrice = 0.0;
      int errCode = 0;
      string errMsg = "";

      if (side == "BUY")
      {
         execPrice = tick.ask > 0.0 ? tick.ask : SymbolInfoDouble(symbol, SYMBOL_ASK);
         if (minDistance > 0.0)
         {
            if (sl > 0.0 && (execPrice - sl) < minDistance) sl = execPrice - minDistance;
            if (tp > 0.0 && (tp - execPrice) < minDistance) tp = execPrice + minDistance;
         }
         PrintFormat("[AutoBot EXEC] Placing BUY %.2f lots %s @ %.5f (SL: %.5f, TP: %.5f)...", lots, symbol, execPrice, sl, tp);
         success = ExtTrade.Buy(lots, symbol, execPrice, sl, tp, comment);
         ticket = ExtTrade.ResultOrder();
      }
      else if (side == "SELL")
      {
         execPrice = tick.bid > 0.0 ? tick.bid : SymbolInfoDouble(symbol, SYMBOL_BID);
         if (minDistance > 0.0)
         {
            if (sl > 0.0 && (sl - execPrice) < minDistance) sl = execPrice + minDistance;
            if (tp > 0.0 && (execPrice - tp) < minDistance) tp = execPrice - minDistance;
         }
         PrintFormat("[AutoBot EXEC] Placing SELL %.2f lots %s @ %.5f (SL: %.5f, TP: %.5f)...", lots, symbol, execPrice, sl, tp);
         success = ExtTrade.Sell(lots, symbol, execPrice, sl, tp, comment);
         ticket = ExtTrade.ResultOrder();
      }

      if (!success)
      {
         errCode = (int)ExtTrade.ResultRetcode();
         errMsg = ExtTrade.ResultRetcodeDescription();
         PrintFormat("❌ [AutoBot EXEC FAILED] %s %s: Code %d - %s", side, symbol, errCode, errMsg);
      }
      else
      {
         ExtExecutedCount++;
         PrintFormat("🚀 [AutoBot SUCCESSFUL ORDER] Ticket #%d: %s %.2f lots %s @ %.5f", ticket, side, lots, symbol, execPrice);
      }

      // Report result back to AutoBot server
      ReportExecution(signalId, ticket, symbol, side, lots, execPrice, sl, tp, success, errCode, errMsg);
   }
}

//+------------------------------------------------------------------+
//| Reports order execution back to AutoBot Python backend           |
//+------------------------------------------------------------------+
void ReportExecution(string sigId, ulong ticket, string sym, string side, double lots, double price, double sl, double tp, bool success, int errCode, string errMsg)
{
   string base = CleanUrl(InpServerUrl);
   string url = base + "/api/v1/mt5/bridge/order-result";
   string headers = "Content-Type: application/json\r\n";

   string json = StringFormat(
      "{\"signal_id\":\"%s\",\"ticket\":%d,\"symbol\":\"%s\",\"side\":\"%s\",\"lots\":%.2f,\"executed_price\":%.5f,\"sl\":%.5f,\"tp\":%.5f,\"success\":%s,\"error_code\":%d,\"error_msg\":\"%s\"}",
      sigId, ticket, sym, side, lots, price, sl, tp, success ? "true" : "false", errCode, errMsg
   );

   char postData[];
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char result[];
   string resultHeaders;
   WebRequest("POST", url, headers, 3000, postData, result, resultHeaders);
}

//+------------------------------------------------------------------+
//| Helper JSON extraction functions                                 |
//+------------------------------------------------------------------+
string ExtractJsonString(string src, string key)
{
   string search1 = "\"" + key + "\":\"";
   string search2 = "\"" + key + "\": \"";
   int start = StringFind(src, search1);
   if (start >= 0)
   {
      start += StringLen(search1);
   }
   else
   {
      start = StringFind(src, search2);
      if (start >= 0)
         start += StringLen(search2);
      else
         return "";
   }
   int end = StringFind(src, "\"", start);
   if (end < 0) return "";
   return StringSubstr(src, start, end - start);
}

double ExtractJsonDouble(string src, string key)
{
   string search2 = "\"" + key + "\": ";
   string search1 = "\"" + key + "\":";
   int start = StringFind(src, search2);
   if (start >= 0)
   {
      start += StringLen(search2);
   }
   else
   {
      start = StringFind(src, search1);
      if (start >= 0)
         start += StringLen(search1);
      else
         return 0.0;
   }
   int end = StringFind(src, ",", start);
   int endBrace = StringFind(src, "}", start);
   if (end < 0 || (endBrace >= 0 && endBrace < end)) end = endBrace;
   if (end < 0) return 0.0;
   string valStr = StringSubstr(src, start, end - start);
   StringTrimLeft(valStr);
   StringTrimRight(valStr);
   return StringToDouble(valStr);
}
