//+------------------------------------------------------------------+
//|                                  AutoBots_MultiStrategy_MT4.mq4  |
//|               Copyright 2026, AutoBots Quantitative Intelligence |
//|                                   https://github.com/maulikkumbhani|
//+------------------------------------------------------------------+
#property copyright "AutoBots AI Market Intelligence"
#property link      "https://mt4.octafx.com/"
#property version   "2.00"
#property strict

//--- Input Parameters
input string   InpServerUrl       = "http://localhost:8000"; // AutoBots Server Base URL (or your deployed cloud URL)
input int      InpPollIntervalMs  = 1000;                     // Polling Interval (Milliseconds)
input double   InpDefaultLots     = 0.05;                     // Default Lot Size (OctaFX Demo)
input int      InpMaxSlippage     = 20;                       // Max Slippage (Points)
input bool     InpAutoTrade       = true;                     // Enable Auto-Trading Execution
input string   InpOctaAccount     = "OctaFX-Demo-01";         // Account Identifier

//--- Global Variables
datetime g_last_poll_time = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print(">>> AutoBots MT4 Multi-Strategy Bridge Initialized for OctaFX");
   Print(">>> Target Server: ", InpServerUrl);
   EventSetMillisecondTimer(InpPollIntervalMs);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print(">>> AutoBots MT4 Bridge Deinitialized.");
}

//+------------------------------------------------------------------+
//| Timer event function (Polls server for signals)                  |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!InpAutoTrade) return;
   PollAndExecuteSignals();
   SendAccountTelemetry();
}

//+------------------------------------------------------------------+
//| Polls AutoBots server for queued multi-strategy signals          |
//+------------------------------------------------------------------+
void PollAndExecuteSignals()
{
   string url = InpServerUrl + "/api/v1/mt4/bridge/poll-signals";
   string headers = "User-Agent: AutoBots-MT4-Bridge\r\nContent-Type: application/json\r\n";
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
      if(err == 4060) // ERR_WEBREQUEST_CANNOT_CONNECT
      {
         Print(">>> ERROR 4060: Add '", InpServerUrl, "' to Tools -> Options -> Expert Advisors -> Allow WebRequest!");
      }
   }
}

//+------------------------------------------------------------------+
//| Parses signals JSON and executes orders in MT4                   |
//+------------------------------------------------------------------+
void ParseAndExecuteJsonSignals(string json_str)
{
   // Fast lightweight parser for AutoBots JSON signals
   int pos = 0;
   while((pos = StringFind(json_str, "{\"signal_id\"", pos)) >= 0)
   {
      int end_pos = StringFind(json_str, "}", pos);
      if(end_pos < 0) break;
      
      string item = StringSubstr(json_str, pos, end_pos - pos + 1);
      ExecuteSingleSignal(item);
      pos = end_pos + 1;
   }
}

//+------------------------------------------------------------------+
//| Executes a single signal via OrderSend in MT4                    |
//+------------------------------------------------------------------+
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

   // Normalize symbol for current broker (check if symbol exists)
   double ask = MarketInfo(sym, MODE_ASK);
   double bid = MarketInfo(sym, MODE_BID);
   
   if(ask == 0.0 && bid == 0.0)
   {
      sym = Symbol(); // fallback to current chart symbol
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

//+------------------------------------------------------------------+
//| Reports execution back to AutoBots server                        |
//+------------------------------------------------------------------+
void ReportExecution(string sig_id, int ticket, string status, double price, string sym, string side, double lots, int magic)
{
   string url = InpServerUrl + "/api/v1/mt4/bridge/report-execution";
   string headers = "User-Agent: AutoBots-MT4-Bridge\r\nContent-Type: application/json\r\n";
   
   string payload = StringConcatenate(
      "{\"signal_id\":\"", sig_id, "\",",
      "\"ticket\":", ticket, ",",
      "\"status\":\"", status, "\",",
      "\"fill_price\":", price, ",",
      "\"symbol\":\"", sym, "\",",
      "\"side\":\"", side, "\",",
      "\"lots\":", lots, ",",
      "\"magic_number\":", magic, ",",
      "\"account\":\"", InpOctaAccount, "\"}"
   );
   
   char post_data[];
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   char result[];
   string result_headers;
   WebRequest("POST", url, headers, 3000, post_data, result, result_headers);
}

//+------------------------------------------------------------------+
//| Sends account telemetry (balance, equity) to server              |
//+------------------------------------------------------------------+
void SendAccountTelemetry()
{
   string url = InpServerUrl + "/api/v1/mt4/bridge/telemetry";
   string headers = "User-Agent: AutoBots-MT4-Bridge\r\nContent-Type: application/json\r\n";
   
   string payload = StringConcatenate(
      "{\"balance\":", AccountBalance(), ",",
      "\"equity\":", AccountEquity(), ",",
      "\"margin\":", AccountMargin(), ",",
      "\"free_margin\":", AccountFreeMargin(), ",",
      "\"open_orders_count\":", OrdersTotal(), ",",
      "\"server\":\"", AccountServer(), "\",",
      "\"account\":\"", IntegerToString(AccountNumber()), "\"}"
   );
   
   char post_data[];
   StringToCharArray(payload, post_data, 0, StringLen(payload));
   char result[];
   string result_headers;
   WebRequest("POST", url, headers, 2000, post_data, result, result_headers);
}

//+------------------------------------------------------------------+
//| Helper JSON extraction                                           |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key)
{
   string search = "\"" + key + "\":";
   int start = StringFind(json, search);
   if(start < 0) return("");
   start += StringLen(search);
   
   // Skip whitespace
   while(StringSubstr(json, start, 1) == " ") start++;
   
   if(StringSubstr(json, start, 1) == "\"")
   {
      start++;
      int end_q = StringFind(json, "\"", start);
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
}
//+------------------------------------------------------------------+
