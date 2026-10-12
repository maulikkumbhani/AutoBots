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

export interface BotStatus {
  is_active: boolean;
  symbol: string;
  timeframe: string;
  strategy_type: string;
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
