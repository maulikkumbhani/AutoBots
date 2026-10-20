export interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  currency: string;
  open?: number;
  high?: number;
  low?: number;
  prev_close?: number;
  timestamp: string;
}
export interface InstrumentSummary {
  id: number;
  symbol: string;
  name: string;
  exchange: string;
  asset_class: "INDEX" | "STOCK" | "COMMODITY" | "FOREX" | "CRYPTO";
  currency: string;
  tick_size: number;
  lot_size: number;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorValues {
  timestamp: string;
  ema_9?: number | null;
  ema_20?: number | null;
  ema_50?: number | null;
  ema_200?: number | null;
  sma_20?: number | null;
  sma_50?: number | null;
  vwap?: number | null;
  rsi_14?: number | null;
  macd_line?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  atr_14?: number | null;
  bb_upper?: number | null;
  bb_middle?: number | null;
  bb_lower?: number | null;
  support_zone?: number | null;
  resistance_zone?: number | null;
  is_swing_high?: boolean;
  is_swing_low?: boolean;
  is_volume_spike?: boolean;
  market_regime?: string;
}

export interface ForecastResponse {
  id: number;
  instrument_symbol: string;
  model_name: string;
  cutoff_timestamp: string;
  as_of_price: number;
  horizon: string;
  direction: 'up' | 'down' | 'sideways' | 'uncertain';
  probabilities: {
    up: number;
    down: number;
    sideways: number;
  };
  expected_return_pct?: number | null;
  predicted_range_lower?: number | null;
  predicted_range_upper?: number | null;
  supporting_factors: string[];
  conflicting_factors: string[];
  risk_factors: string[];
  data_quality: string;
  created_at: string;
  evaluation_status?: string;
  realized_price?: number | null;
  realized_return_pct?: number | null;
  is_correct?: boolean | null;
  target_price?: number | null;
  stop_loss?: number | null;
  estimated_target_hit_time?: string | null;
  estimated_seconds_to_hit?: number | null;
  price_velocity_pts_per_sec?: number | null;
}

export interface ReplayResult {
  symbol: string;
  cutoff_timestamp: string;
  as_of_price: number;
  market_open: boolean;
  candles_history_count: number;
  current_indicators?: IndicatorValues;
  forecast?: ForecastResponse;
  news_headlines_at_cutoff: string[];
  economic_events_at_cutoff: string[];
  realized_price?: number | null;
  realized_return_pct?: number | null;
  realized_direction?: string | null;
  is_correct?: boolean | null;
  evaluation_status: string;
}

export interface MT5AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  leverage: number;
  currency: string;
  server: string;
  company?: string;
  is_connected: boolean;
  account_id?: string;
}

export interface MT5ExecutedTrade {
  ticket: number;
  signal_id: string;
  symbol: string;
  side: "BUY" | "SELL";
  lots: number;
  executed_price: number;
  sl: number;
  tp: number;
  success: boolean;
  error_code?: number;
  error_msg?: string;
  executed_at: string;
}

export interface MT5BridgeStatus {
  enabled: boolean;
  connected: boolean;
  account_id: string;
  server: string;
  default_lot_size: number;
  magic_number: number;
  account_info: MT5AccountInfo;
  pending_count: number;
  executed_count: number;
  open_positions_count: number;
  open_positions: any[];
  latest_executed_trades: MT5ExecutedTrade[];
  last_heartbeat: string | null;
}

export interface BotStatus {
  is_active: boolean;
  symbol: string;
  timeframe: string;
  strategy_type: string;
  execution_mode?: "PAPER" | "MT5_LIVE";
  mt5_auto_trade?: boolean;
  mt5_status?: MT5BridgeStatus;
  quantity: number;
  take_profit_pct: number;
  stop_loss_pct: number;
  trailing_stop_pct: number;
  min_confidence: number;
  open_positions_count: number;
  closed_positions_count: number;
  win_rate_pct: number;
  profit_factor: number;
  last_run_time?: string | null;
  recent_logs: Array<{
    time: string;
    action: string;
    detail: string;
    cur_price?: number;
  }>;
}

export interface Position {
  id: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry_price: number;
  current_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  trailing_stop_pct?: number | null;
  unrealized_pnl: number;
  realized_pnl: number;
  max_favorable_excursion: number;
  max_adverse_excursion: number;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string | null;
  close_reason?: string | null;
}

export interface PortfolioSummary {
  id: number;
  name: string;
  currency: string;
  initial_cash: number;
  current_cash: number;
  equity: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_fees_paid: number;
  total_slippage_paid: number;
  open_positions_count: number;
}

export interface AccuracyDashboardData {
  aggregate_metrics: {
    total_predictions: number;
    fully_evaluated: number;
    unresolved: number;
    correct: number;
    incorrect: number;
    accuracy_pct: number | null;
    confidence_interval_95: [number, number] | null;
    sample_size_warning: boolean;
    brier_score_mean: number | null;
    by_direction: Record<string, {
      sample_size: number;
      correct: number;
      accuracy_pct: number | null;
      confidence_interval_95: [number, number] | null;
    }>;
    precision_recall_f1: Record<string, {
      precision_pct: number;
      recall_pct: number;
      f1_score: number;
    }>;
  };
  by_regime: Record<string, any>;
  methodology: Record<string, string>;
}

export interface DetectedCandlestickPattern {
  name: string;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  type: string;
  signal_strength: string;
  description: string;
}

export interface ModelPredictionDetail {
  model_key: string;
  model_name: string;
  direction: "up" | "down" | "sideways" | "uncertain";
  confidence_pct: number;
  probabilities: {
    up: number;
    down: number;
    sideways: number;
  };
  target_price: number | null;
  stop_loss: number | null;
  expected_return_pct?: number | null;
  estimated_target_hit_time?: string | null;
  estimated_seconds_to_hit?: number | null;
  price_velocity_pts_per_sec?: number | null;
  supporting_factors: string[];
  risk_factors: string[];
  model_version: string;
}

export interface MultiModelAnalysisResponse {
  symbol: string;
  as_of_price: number;
  horizon: string;
  consensus: {
    direction: "BULLISH" | "BEARISH" | "NEUTRAL_DIVERGENCE";
    status: "STRONG_CONSENSUS" | "MODERATE_CONSENSUS" | "DIVERGENCE_ALERT";
    agreement_pct: number;
    bullish_votes: number;
    bearish_votes: number;
    neutral_votes: number;
    total_models: number;
    consensus_target: number;
    consensus_stop_loss: number;
    consensus_target_hit_time?: string | null;
    consensus_seconds_to_hit?: number | null;
    consensus_velocity_pts_per_sec?: number | null;
  };
  detected_patterns: DetectedCandlestickPattern[];
  models: ModelPredictionDetail[];
  custom_model_weights?: {
    weights: Record<string, number>;
    learning_rate: number;
    training_iterations: number;
    last_training?: any;
  };
}

export interface TradeRecord {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  entry_price: number;
  exit_price: number;
  realized_pnl: number;
  realized_return_pct: number;
  is_win: boolean;
  strategy: string;
  duration_seconds: number;
  close_reason: string;
  opened_at: string;
  closed_at: string;
}

export interface TradeAnalysisSummary {
  total_trades: number;
  win_count: number;
  loss_count: number;
  win_rate_pct: number;
  net_realized_pnl: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  avg_trade_pnl: number;
}

export interface StrategyBreakdown {
  name: string;
  trades: number;
  wins: number;
  win_rate: number;
  pnl: number;
}

export interface TradeHistoryResponse {
  period: "DAY" | "MONTH" | "YEAR" | "CUSTOM" | "ALL";
  symbol: string;
  start_date: string;
  end_date: string;
  summary: TradeAnalysisSummary;
  strategy_breakdown: StrategyBreakdown[];
  trades: TradeRecord[];
}
