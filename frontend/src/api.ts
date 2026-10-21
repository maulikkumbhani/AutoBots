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

const API_BASE = "http://localhost:8000/api/v1";

export async function fetchTickerStrip(): Promise<TickerItem[]> {
  const res = await fetch(`${API_BASE}/markets/ticker-strip`);
  if (!res.ok) throw new Error("Failed to fetch ticker strip");
  return res.json();
}

export async function fetchInstruments(): Promise<InstrumentSummary[]> {
  const res = await fetch(`${API_BASE}/markets/instruments`);
  if (!res.ok) throw new Error("Failed to fetch instruments");
  return res.json();
}

export async function fetchCandles(symbol: string, timeframe: string, daysBack = 15): Promise<Candle[]> {
  const res = await fetch(
    `${API_BASE}/markets/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&days_back=${daysBack}&provider=yahoo`
  );
  if (!res.ok) throw new Error("Failed to fetch candles");
  const data = await res.json();
  return data.candles;
}
export async function fetchLiveTick(symbol: string): Promise<{ symbol: string; price: number; timestamp: string; latest_candle: Candle }> {
  const res = await fetch(`${API_BASE}/markets/live-tick?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch live tick");
  return res.json();
}
export async function fetchIndicators(symbol: string, timeframe: string, daysBack = 20): Promise<IndicatorValues[]> {
  const res = await fetch(
    `${API_BASE}/indicators/calculate?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&days_back=${daysBack}&provider=yahoo`
  );
  if (!res.ok) throw new Error("Failed to fetch indicators");
  return res.json();
}

export async function executeHistoricalReplay(
  symbol: string,
  cutoffTimestamp: string,
  horizon = "60m",
  modelType = "ENSEMBLE"
): Promise<ReplayResult> {
  const res = await fetch(`${API_BASE}/replay/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      cutoff_timestamp: cutoffTimestamp,
      horizon,
      model_type: modelType,
    }),
  });
  if (!res.ok) throw new Error("Historical replay request failed");
  return res.json();
}

export async function generatePrediction(
  symbol: string,
  cutoffTimestamp: string,
  horizon = "60m",
  modelType = "ENSEMBLE"
): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/predictions/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      cutoff_timestamp: cutoffTimestamp,
      horizon,
      model_type: modelType,
    }),
  });
  if (!res.ok) throw new Error("Prediction generation failed");
  return res.json();
}

export async function fetchBotStatus(): Promise<BotStatus> {
  const res = await fetch(`${API_BASE}/bot/status`);
  if (!res.ok) throw new Error("Failed to fetch bot status");
  return res.json();
}

export async function startBot(symbol?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/bot/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(symbol ? { symbol } : {}),
  });
  if (!res.ok) throw new Error("Failed to start bot");
  return res.json();
}

export async function stopBot(): Promise<any> {
  const res = await fetch(`${API_BASE}/bot/stop`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop bot");
  return res.json();
}

export async function triggerBotCycle(): Promise<any> {
  const res = await fetch(`${API_BASE}/bot/cycle`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to trigger bot cycle");
  return res.json();
}

export async function configureBot(config: Partial<BotStatus>): Promise<any> {
  const res = await fetch(`${API_BASE}/bot/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to configure bot");
  return res.json();
}

export async function fetchPortfolio(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE}/paper/portfolio`);
  if (!res.ok) throw new Error("Failed to fetch portfolio");
  return res.json();
}

export async function fetchPositions(): Promise<Position[]> {
  const res = await fetch(`${API_BASE}/paper/positions`);
  if (!res.ok) throw new Error("Failed to fetch positions");
  return res.json();
}

export async function closeAllPositions(): Promise<any> {
  const res = await fetch(`${API_BASE}/paper/close-all`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to close all positions");
  return res.json();
}

export async function closeSinglePosition(positionId: number): Promise<any> {
  const res = await fetch(`${API_BASE}/paper/positions/${positionId}/close`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to close position");
  return res.json();
}

export async function resetPaperTrading(): Promise<any> {
  const res = await fetch(`${API_BASE}/paper/reset`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to reset paper trading");
  return res.json();
}

export async function executePaperOrder(order: {
  symbol: string;
  side: "BUY" | "SELL";
  order_type: "MARKET" | "LIMIT";
  quantity: number;
  stop_loss?: number;
  take_profit?: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/paper/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...order, portfolio_id: 1 }),
  });
  if (!res.ok) throw new Error("Failed to execute paper order");
  return res.json();
}

export async function fetchPredictionRecords(symbol: string): Promise<{
  symbol: string;
  summary: {
    total_predictions: number;
    success_count: number;
    failed_count: number;
    active_count: number;
    win_rate_pct: number;
    current_price: number;
  };
  records: ForecastResponse[];
}> {
  const res = await fetch(`${API_BASE}/predictions/records?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch prediction records");
  return res.json();
}

export async function fetchAccuracyDashboard(): Promise<AccuracyDashboardData> {
  const res = await fetch(`${API_BASE}/analytics/accuracy-dashboard`);
  if (!res.ok) throw new Error("Failed to fetch accuracy dashboard");
  return res.json();
}

export async function fetchMultiModelAnalysis(symbol: string, horizon = "10m"): Promise<any> {
  const res = await fetch(`${API_BASE}/predictions/multi-model?symbol=${encodeURIComponent(symbol)}&horizon=${horizon}`);
  if (!res.ok) throw new Error("Failed to fetch multi-model analysis");
  return res.json();
}

export async function trainCustomModel(symbol: string, daysBack = 30): Promise<any> {
  const res = await fetch(`${API_BASE}/predictions/custom-model/train?symbol=${encodeURIComponent(symbol)}&days_back=${daysBack}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to train custom model");
  return res.json();
}

export async function fetchTradeHistory(
  period = "DAY",
  symbol?: string,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const params = new URLSearchParams();
  params.set("period", period);
  if (symbol && symbol !== "ALL") params.set("symbol", symbol);
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);

  const res = await fetch(`${API_BASE}/paper/trades-history?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch trade history");
  return res.json();
}

export async function fetchMT5Status(): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/status`);
  if (!res.ok) throw new Error("Failed to fetch MT5 status");
  return res.json();
}

export async function updateMT5Config(config: {
  enabled?: boolean;
  server?: string;
  account_id?: string;
  default_lot_size?: number;
  magic_number?: number;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update MT5 config");
  return res.json();
}

export async function sendManualMT5Order(order: {
  symbol: string;
  side: "BUY" | "SELL";
  lots?: number;
  price?: number;
  stop_loss?: number;
  take_profit?: number;
  strategy?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/manual-execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  if (!res.ok) throw new Error("Failed to send manual MT5 order");
  return res.json();
}

export async function fetchMT5EACode(): Promise<{ filename: string; code: string }> {
  const res = await fetch(`${API_BASE}/mt5/bridge/ea-code`);
  if (!res.ok) throw new Error("Failed to fetch MT5 EA code");
  return res.json();
}

export interface MultiAssetPosition {
  id: number;
  side: "LONG" | "SHORT" | "BUY" | "SELL";
  quantity: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  stop_loss?: number;
  take_profit?: number;
}

export interface MultiAssetData {
  symbol: string;
  name: string;
  display_name?: string;
  category: string;
  currency?: string;
  enabled: boolean;
  current_price: number;
  best_model: string;
  active_position: MultiAssetPosition | null;
  total_trades: number;
  win_count: number;
  loss_count: number;
  win_rate_pct: number;
  net_pnl: number;
  profit_factor: number;
  best_model_accuracy?: number;
}

export interface MultiAssetOverviewResponse {
  is_bot_active: boolean;
  execution_mode: string;
  mt5_auto_trade?: boolean;
  period: string;
  overall_summary: {
    monitored_count: number;
    enabled_count: number;
    total_trades: number;
    win_count: number;
    loss_count: number;
    win_rate_pct: number;
    net_pnl: number;
  };
  assets: MultiAssetData[];
  recent_logs?: Array<{
    time: string;
    action: string;
    detail: string;
    cur_price?: number;
  }>;
}

export async function fetchMultiAssetOverview(period = "DAY"): Promise<MultiAssetOverviewResponse> {
  const res = await fetch(`${API_BASE}/bot/multi-asset-overview?period=${encodeURIComponent(period)}`);
  if (!res.ok) throw new Error("Failed to fetch multi-asset overview");
  return res.json();
}

export async function toggleAssetTrading(symbol: string, enabled: boolean): Promise<any> {
  const res = await fetch(`${API_BASE}/bot/toggle-symbol`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, enabled }),
  });
  if (!res.ok) throw new Error("Failed to toggle asset trading");
  return res.json();
}

export interface MasterAuditRecord {
  audit_id: string;
  timestamp_utc: string;
  timestamp_ist: string;
  symbol: string;
  asset_category: string;
  action: "BUY" | "SELL" | "LONG" | "SHORT";
  quantity: number;
  entry_price: number;
  predicted_target_price: number;
  stop_loss: number;
  exit_price: number;
  duration_seconds: number;
  realized_pnl: number;
  realized_return_pct: number;
  trade_result: "WIN" | "LOSS" | "BREAKEVEN";
  prediction_model: string;
  prediction_signal: "BUY" | "SELL";
  prediction_confidence_pct: number;
  prediction_outcome: string;
  exit_reason: string;
  mfe: number;
  mae: number;
}

export interface MasterAuditSummary {
  total_historical_trades: number;
  win_count: number;
  loss_count: number;
  win_rate_pct: number;
  target_hit_count: number;
  target_hit_rate_pct: number;
  net_realized_pnl: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  avg_trade_pnl: number;
  is_permanent_storage: boolean;
}

export interface ModelAttribution {
  model: string;
  total: number;
  wins: number;
  pnl: number;
  target_hits: number;
  win_rate: number;
  hit_rate: number;
}

export interface MasterAuditResponse {
  status: string;
  period: string;
  symbol: string;
  summary: MasterAuditSummary;
  model_attribution: ModelAttribution[];
  records: MasterAuditRecord[];
}

export async function fetchMasterAuditJournal(params?: {
  symbol?: string;
  model?: string;
  result?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
}): Promise<MasterAuditResponse> {
  const q = new URLSearchParams();
  if (params?.symbol && params.symbol !== "ALL") q.set("symbol", params.symbol);
  if (params?.model && params.model !== "ALL") q.set("model", params.model);
  if (params?.result && params.result !== "ALL") q.set("result", params.result);
  if (params?.period) q.set("period", params.period);
  if (params?.startDate) q.set("start_date", params.startDate);
  if (params?.endDate) q.set("end_date", params.endDate);

  const res = await fetch(`${API_BASE}/analytics/master-audit-journal?${q.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch master audit journal");
  return res.json();
}

export function getMasterAuditCSVExportUrl(): string {
  return `${API_BASE}/analytics/export-master-audit-csv`;
}

export interface MultiStrategyItem {
  strategy_id: string;
  strategy_name: string;
  tagline: string;
  description: string;
  magic_number: number;
  tp_pct: number;
  sl_pct: number;
  win_rate_pct: number;
  total_trades: number;
  win_count: number;
  loss_count: number;
  net_realized_pnl: number;
  last_signal: string;
  last_confidence: number;
  status: string;
  is_champion?: boolean;
  active_position: {
    side: "BUY" | "SELL";
    entry_price: number;
    current_price: number;
    quantity: number;
    stop_loss: number;
    take_profit: number;
    unrealized_pnl: number;
    duration_seconds: number;
  } | null;
}

export interface MultiStrategyMatrixResponse {
  symbol: string;
  current_price: number;
  monitored_symbols: string[];
  strategies: MultiStrategyItem[];
  champion_strategy: string;
  total_strategies_tested: number;
}

export async function fetchMultiStrategyMatrix(symbol = "NIFTY 50"): Promise<MultiStrategyMatrixResponse> {
  const res = await fetch(`${API_BASE}/bot/multi-strategy-matrix?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch multi-strategy matrix");
  return res.json();
}

export async function fetchMT4Status(): Promise<any> {
  const res = await fetch(`${API_BASE}/mt4/bridge/status`);
  if (!res.ok) throw new Error("Failed to fetch MT4 status");
  return res.json();
}

export async function updateMT4Config(config: {
  enabled?: boolean;
  server?: string;
  account_id?: string;
  default_lot_size?: number;
  broker_name?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/mt4/bridge/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update MT4 config");
  return res.json();
}

export async function fetchMT4EACode(): Promise<{ filename: string; instructions: string; code: string }> {
  const res = await fetch(`${API_BASE}/mt4/bridge/ea-code`);
  if (!res.ok) throw new Error("Failed to fetch MT4 EA code");
  return res.json();
}

export function getMT4EADownloadUrl(): string {
  return `${API_BASE}/mt4/bridge/download-ea`;
}

export async function clearMasterAuditStore(): Promise<any> {
  const res = await fetch(`${API_BASE}/analytics/clear-master-audit`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to clear master audit store");
  return res.json();
}
