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
} from "./types";

const API_BASE = "http://localhost:8000/api/v1";

export async function fetchTickerStrip(): Promise<TickerItem[]> {
  const res = await fetch(`${API_BASE}/markets/ticker-strip`);
  if (!res.ok) throw new Error("Failed to fetch ticker strip");
  return res.json();
}

export async function fetchInstruments() {
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

export async function startBot(): Promise<any> {
  const res = await fetch(`${API_BASE}/bot/start`, { method: "POST" });
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

export async function fetchAccuracyDashboard(): Promise<AccuracyDashboardData> {
  const res = await fetch(`${API_BASE}/analytics/accuracy-dashboard`);
  if (!res.ok) throw new Error("Failed to fetch accuracy dashboard");
  return res.json();
}
