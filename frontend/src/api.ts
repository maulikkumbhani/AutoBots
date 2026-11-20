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

export const getApiBase = (): string => {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("autobots_api_url");
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, "") + "/api/v1";
    }
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
    if (envUrl && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, "") + "/api/v1";
    }
    // Production Cloud Fallback: If hosted on Vercel or any remote domain, connect to Render backend
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "https://autobots-quant-backend.onrender.com/api/v1";
    }
    return `http://${window.location.hostname || "127.0.0.1"}:8000/api/v1`;
  }
  return "http://127.0.0.1:8000/api/v1";
};

export const getStoredApiUrl = (): string => {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("autobots_api_url");
    if (custom && custom.trim()) return custom;
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return "https://autobots-quant-backend.onrender.com";
    }
    return `http://${window.location.hostname || "127.0.0.1"}:8000`;
  }
  return "http://127.0.0.1:8000";
};

export const setStoredApiUrl = (url: string) => {
  if (typeof window !== "undefined") {
    if (!url || !url.trim() || url.trim() === "http://localhost:8000") {
      localStorage.removeItem("autobots_api_url");
    } else {
      localStorage.setItem("autobots_api_url", url.trim().replace(/\/api\/v1\/?$/, ""));
    }
  }
};

export async function checkBackendHealth(): Promise<{ ok: boolean; url: string; error?: string }> {
  const base = getApiBase();
  const rootUrl = base.replace(/\/api\/v1\/?$/, "");
  try {
    const res = await fetch(`${rootUrl}/docs`, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return { ok: res.status < 500, url: rootUrl };
  } catch (err: any) {
    return { ok: false, url: rootUrl, error: err?.message || "Connection refused" };
  }
}

// Dynamic API_BASE object whose string interpolation always calls getApiBase()
const API_BASE = {
  toString: () => getApiBase(),
};

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

export interface MarketSessionItem {
  symbol: string;
  name: string;
  class: string;
  exchange: string;
  is_open: boolean;
  status_badge: "OPEN" | "CLOSED";
  status_color: string;
  session_status: string;
  timing_label: string;
  opens_at: string;
  closes_at: string;
}

export interface MarketSessionsOverview {
  current_time_ist: string;
  current_time_utc: string;
  open_count: number;
  closed_count: number;
  total_count: number;
  sessions: MarketSessionItem[];
}

export async function fetchMarketSessionsOverview(): Promise<MarketSessionsOverview> {
  const res = await fetch(`${API_BASE}/markets/sessions-overview`);
  if (!res.ok) throw new Error("Failed to fetch market sessions overview");
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

export interface RecordedMT5Trade {
  ticket: number;
  signal_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  executed_price: number;
  current_price: number;
  sl: number;
  tp: number;
  pnl: number;
  pnl_status: "PROFIT" | "LOSS";
  strategy: string;
  strategy_name: string;
  horizon: string;
  timeframe: string;
  success: boolean;
  executed_at: string;
}

export interface StrategyPerformanceItem {
  strategy_id: string;
  name: string;
  horizon: string;
  default_tf: string;
  description: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  gross_profit: number;
  gross_loss: number;
  net_pnl: number;
  profit_factor: number;
  is_active: boolean;
  is_isolated: boolean;
}

export interface FvgAnalysisResponse {
  strategy: string;
  strategy_name: string;
  horizon: string;
  timeframe_focus: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  direction: "LONG" | "SHORT" | "FLAT";
  confidence: number;
  entry_price: number;
  take_profit: number;
  stop_loss: number;
  reward_risk: number;
  gap_details: Record<string, any>;
  active_gaps_found: number;
  bullish_gaps_count: number;
  bearish_gaps_count: number;
}

export async function fetchMT5Trades(
  timeframe: string = "all",
  period: string = "all",
  strategy: string = "all",
  status: string = "all"
): Promise<{
  total_trades: number;
  open_count?: number;
  closed_count?: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  current_equity: number;
  current_balance: number;
  trades: RecordedMT5Trade[];
}> {
  const params = new URLSearchParams({ timeframe, period, strategy, status });
  const res = await fetch(`${API_BASE}/mt5/bridge/trades?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch MT5 trades");
  return res.json();
}

export async function fetchStrategyPerformance(): Promise<{
  active_isolation: string;
  strategies: StrategyPerformanceItem[];
  total_net_pnl: number;
  total_trades_count: number;
  active_count: number;
}> {
  const res = await fetch(`${API_BASE}/mt5/bridge/strategy-performance`);
  if (!res.ok) throw new Error("Failed to fetch strategy performance");
  return res.json();
}

export async function isolateStrategy(strategyId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/isolate-strategy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strategy_id: strategyId }),
  });
  if (!res.ok) throw new Error("Failed to isolate strategy");
  return res.json();
}

export interface StrategyAllocationItem {
  strategy_id: string;
  name: string;
  horizon: string;
  allocation_pct: number;
  target_tp_move: number;
  protective_sl_move: number;
  recommended_lot: number;
  win_rate: number;
  net_pnl: number;
  status: string;
  is_top_performer: boolean;
}

export interface StrategyAllocationsResponse {
  mode: "DYNAMIC_WEIGHTED" | "SOLO_ISOLATION_100" | "BALANCED_EQUAL";
  active_strategy_filter: string;
  top_performer?: string;
  allocations: StrategyAllocationItem[];
  summary: string;
}

export async function fetchStrategyAllocations(): Promise<StrategyAllocationsResponse> {
  const res = await fetch(`${API_BASE}/mt5/bridge/strategy-allocations`);
  if (!res.ok) throw new Error("Failed to fetch strategy allocations");
  return res.json();
}

export async function updateStrategyAllocationMode(
  mode: "DYNAMIC_WEIGHTED" | "SOLO_ISOLATION_100" | "BALANCED_EQUAL",
  isolated_strategy?: string
): Promise<StrategyAllocationsResponse> {
  const res = await fetch(`${API_BASE}/mt5/bridge/strategy-allocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, isolated_strategy }),
  });
  if (!res.ok) throw new Error("Failed to update strategy allocation mode");
  return res.json();
}

export async function fetchFvgAnalysis(symbol: string = "XAUUSD"): Promise<FvgAnalysisResponse> {
  const res = await fetch(`${API_BASE}/mt5/bridge/fvg-analysis?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch FVG analysis");
  return res.json();
}

export interface MarketFlowAnalysisResponse {
  symbol: string;
  current_price: number;
  bid: number;
  ask: number;
  spread_points: number;
  spread_compressed: boolean;
  buyer_volume_pct: number;
  seller_volume_pct: number;
  imbalance_ratio: number;
  tick_velocity_per_sec: number;
  delivery_bias: string;
  recommended_burst_side: "BUY" | "SELL";
  burst_readiness_score: number;
  signal_reason: string;
  burst_config: {
    target_profit_per_ticket_usd: number;
    protective_loss_per_ticket_usd: number;
    target_pts_move: number;
    stop_pts_move: number;
    lots_per_ticket: number;
    burst_count: number;
    cumulative_target_usd: number;
    cumulative_risk_usd: number;
    compounding_level: number;
  };
  historical_stats: {
    total_burst_waves: number;
    total_micro_trades: number;
    successful_bursts: number;
    win_rate: number;
    cumulative_burst_profit: number;
    average_burst_duration_sec: number;
    consecutive_wins: number;
  };
  timestamp: string;
}

export async function fetchMarketFlow(symbol: string = "XAUUSD"): Promise<MarketFlowAnalysisResponse> {
  const res = await fetch(`${API_BASE}/mt5/bridge/market-flow?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch market flow analysis");
  return res.json();
}

export async function executeMicroBurstWave(
  side: "BUY" | "SELL",
  burst_count: number = 25,
  target_profit_per_ticket: number = 0.50,
  protective_loss_per_ticket: number = 0.75,
  lots_per_ticket: number = 0.02
): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/micro-burst`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      side,
      burst_count,
      target_profit_per_ticket,
      protective_loss_per_ticket,
      lots_per_ticket,
    }),
  });
  if (!res.ok) throw new Error("Failed to execute micro burst wave");
  return res.json();
}

export interface VolumeOptimizationData {
  mode: "DYNAMIC_AUTO" | "MANUAL_FIXED";
  symbol: string;
  current_price: number;
  recommended_lots: number;
  base_lots: number;
  min_lots: number;
  max_lots: number;
  notional_value: number;
  margin_required_usd: number;
  target_move_points: number;
  projected_profit_usd: number;
  protective_stop_points: number;
  projected_risk_usd: number;
  reward_risk_ratio: number;
  estimated_hold_time: string;
  bulk_harvesting_enabled: boolean;
  bulk_wave_entries: number;
  bulk_cumulative_profit_target_usd: number;
  sizing_reasoning: string;
}

export async function closeSingleMT5Trade(ticket: number | string, reason: string = "MANUAL_UI_CLOSE"): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/close-trade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket, reason }),
  });
  if (!res.ok) throw new Error("Failed to close MT5 trade");
  return res.json();
}

export async function closeAllMT5Positions(): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/close-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to close all MT5 positions");
  return res.json();
}

export async function syncMT5Positions(): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/sync-positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to synchronize MT5 positions");
  return res.json();
}

export async function clearGhostTrades(): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/clear-trades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Failed to reset ghost trades");
  return res.json();
}

export async function fetchVolumeOptimization(symbol: string = "XAUUSD"): Promise<VolumeOptimizationData> {
  const res = await fetch(`${API_BASE}/mt5/bridge/volume-optimization?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch volume optimization");
  return res.json();
}

export async function updateVolumeConfig(config: {
  mode?: "DYNAMIC_AUTO" | "MANUAL_FIXED";
  base_lots?: number;
  min_lots?: number;
  max_lots?: number;
  target_micro_profit_usd?: number;
  bulk_harvesting_enabled?: boolean;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/mt5/bridge/volume-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update volume config");
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

export async function fetchOrderBlockAnalysis(symbol = "NIFTY 50", timeframe = "15m"): Promise<any> {
  const res = await fetch(`${API_BASE}/order-block/analysis?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`);
  if (!res.ok) throw new Error(`Failed to fetch Order Block analysis for ${symbol}`);
  return res.json();
}
