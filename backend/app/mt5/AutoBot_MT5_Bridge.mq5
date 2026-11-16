//+------------------------------------------------------------------+
//|                                         AutoBot_MT5_Bridge.mq5   |
//|                    AutoBot Quantitative Intelligence Terminal    |
//|              Automated Buy/Sell Trade Execution from Predictions |
//+------------------------------------------------------------------+
#property copyright "AutoBot Quant Engine"
#property link      "http://localhost:8000"
#property version   "1.00"
#property strict

#include <Trade\Trade.mqh>

//--- Input Parameters
input group "=== AutoBot Server Settings ==="
input string   InpServerUrl       = "http://127.0.0.1:8000"; // AutoBot Backend URL
input int      InpPollIntervalSec = 2;                       // Poll Interval (Seconds)
input ulong    InpMagicNumber     = 888999;                  // Unique Magic Number
input double   InpDefaultLots     = 0.10;                    // Default Lot Size
input ulong    InpDeviationPoints = 20;                      // Slippage Tolerance (Points)

//--- Global Objects
CTrade         ExtTrade;
datetime       ExtLastPollTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("Initializing AutoBot MT5 Execution Bridge...");
   ExtTrade.SetExpertMagicNumber(InpMagicNumber);
   ExtTrade.SetDeviationInPoints(InpDeviationPoints);
   ExtTrade.SetTypeFilling(ORDER_FILLING_IOC);

   // Set timer for periodic polling of AutoBot prediction signals
   EventSetTimer(InpPollIntervalSec);

   // Send initial registration heartbeat
   SendHeartbeat();

   Print("AutoBot MT5 Bridge Successfully Started! Listening for signals at: ", InpServerUrl);
   Comment("⚡ AutoBot MT5 Bridge ACTIVE\nServer: ", InpServerUrl, "\nMagic: ", InpMagicNumber, "\nConnected: Yes");
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Comment("");
   Print("AutoBot MT5 Bridge Stopped.");
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
   string url = InpServerUrl + "/api/v1/mt5/bridge/heartbeat";
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
}

//+------------------------------------------------------------------+
//| Polls pending BUY/SELL signals and executes them via CTrade      |
//+------------------------------------------------------------------+
void PollAndExecuteSignals()
{
   string url = InpServerUrl + "/api/v1/mt5/bridge/pending-signals";
   char postData[];
   char result[];
   string resultHeaders;

   int res = WebRequest("GET", url, "", 3000, postData, result, resultHeaders);
   if (res == 200 && ArraySize(result) > 2)
   {
      string responseJson = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      // Process simple JSON array of signals
      ParseAndExecuteSignals(responseJson);
   }
}

//+------------------------------------------------------------------+
//| Parses signal array and triggers MT5 OrderSend                   |
//+------------------------------------------------------------------+
void ParseAndExecuteSignals(string jsonStr)
{
   if (StringFind(jsonStr, "\"signal_id\"") < 0) return;

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

      // Execute order
      bool success = false;
      ulong ticket = 0;
      double execPrice = 0.0;
      int errCode = 0;
      string errMsg = "";

      if (side == "BUY")
      {
         execPrice = SymbolInfoDouble(symbol, SYMBOL_ASK);
         success = ExtTrade.Buy(lots, symbol, execPrice, sl, tp, comment);
         ticket = ExtTrade.ResultOrder();
      }
      else if (side == "SELL")
      {
         execPrice = SymbolInfoDouble(symbol, SYMBOL_BID);
         success = ExtTrade.Sell(lots, symbol, execPrice, sl, tp, comment);
         ticket = ExtTrade.ResultOrder();
      }

      if (!success)
      {
         errCode = (int)ExtTrade.ResultRetcode();
         errMsg = ExtTrade.ResultRetcodeDescription();
         PrintFormat("AutoBot execution error for %s %s: Code %d - %s", side, symbol, errCode, errMsg);
      }
      else
      {
         PrintFormat("AutoBot SUCCESS! Ticket #%d: %s %.2f lots %s @ %.5f", ticket, side, lots, symbol, execPrice);
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
   string url = InpServerUrl + "/api/v1/mt5/bridge/order-result";
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
