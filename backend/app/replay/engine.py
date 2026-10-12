from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
import pandas as pd
import pytz

from app.core.calendars import ExchangeCalendar
from app.data.base import BaseDataProvider
from app.indicators.calculator import TechnicalIndicatorEngine
from app.evaluation.metrics import EvaluationMetricsEngine


class HistoricalReplayEngine:
    """
    Point-in-Time Historical Market Replay Engine.
    Strictly guarantees ZERO LOOK-AHEAD BIAS.
    Reconstructs exact information set available at cutoff_timestamp.
    """

    def __init__(self, data_provider: BaseDataProvider, neutral_threshold_pct: float = 0.15):
        self.provider = data_provider
        self.neutral_threshold_pct = neutral_threshold_pct

    def parse_horizon_delta(self, horizon: str) -> timedelta:
        """Parses horizon strings like '5m', '15m', '30m', '60m', '1d', '5d'."""
        h = horizon.lower().strip()
        if h == "5m":
            return timedelta(minutes=5)
        elif h == "15m":
            return timedelta(minutes=15)
        elif h == "30m":
            return timedelta(minutes=30)
        elif h == "60m" or h == "1h":
            return timedelta(hours=1)
        elif h == "1d":
            return timedelta(days=1)
        elif h == "5d":
            return timedelta(days=5)
        elif h == "session_close":
            return timedelta(hours=6)  # Handled with exchange session bounds
        return timedelta(hours=1)

    async def reconstruct_market_state(
        self,
        symbol: str,
        cutoff_timestamp: datetime,
        exchange: str = "NSE",
        lookback_bars: int = 120,
        timeframe: str = "15m",
    ) -> Dict[str, Any]:
        """
        Reconstructs the exact market state up to cutoff_timestamp.
        Strict Invariant: All candles with timestamp > cutoff_timestamp are omitted.
        """
        cutoff_utc = ExchangeCalendar.to_utc(cutoff_timestamp, exchange)
        # Fetch sufficient lookback history
        start_utc = cutoff_utc - timedelta(days=25)
        
        full_df = await self.provider.fetch_historical_candles(
            symbol=symbol,
            timeframe=timeframe,
            start_time=start_utc,
            end_time=cutoff_utc + timedelta(days=10),  # Fetch extra for forward evaluation
        )

        if full_df.empty:
            return {
                "symbol": symbol,
                "cutoff_utc": cutoff_utc,
                "data_quality": "INSUFFICIENT",
                "as_of_price": None,
                "past_df": pd.DataFrame(),
                "future_df": pd.DataFrame(),
                "market_open": False,
            }

        # Point-in-time filter: STRICTLY <= cutoff_utc
        past_df = full_df[full_df["timestamp"] <= cutoff_utc].copy()
        future_df = full_df[full_df["timestamp"] > cutoff_utc].copy()

        if past_df.empty or len(past_df) < 10:
            return {
                "symbol": symbol,
                "cutoff_utc": cutoff_utc,
                "data_quality": "INSUFFICIENT",
                "as_of_price": None,
                "past_df": past_df,
                "future_df": future_df,
                "market_open": ExchangeCalendar.is_market_open(cutoff_utc, exchange),
            }

        # Calculate indicators ONLY on past_df
        past_with_indicators = TechnicalIndicatorEngine.calculate_all(past_df)
        last_bar = past_with_indicators.iloc[-1]
        as_of_price = float(last_bar["close"])

        return {
            "symbol": symbol,
            "cutoff_utc": cutoff_utc,
            "data_quality": "GOOD" if len(past_df) >= 30 else "LIMITED",
            "as_of_price": as_of_price,
            "past_df": past_with_indicators,
            "future_df": future_df,
            "last_bar": last_bar,
            "market_open": ExchangeCalendar.is_market_open(cutoff_utc, exchange),
        }

    def evaluate_future_outcome(
        self,
        as_of_price: float,
        future_df: pd.DataFrame,
        cutoff_utc: datetime,
        horizon: str,
        exchange: str = "NSE",
    ) -> Dict[str, Any]:
        """
        Evaluates future actual price movement after cutoff.
        """
        if future_df.empty or as_of_price is None:
            return {
                "evaluation_status": "UNRESOLVED",
                "realized_price": None,
                "realized_return_pct": None,
                "realized_direction": None,
            }

        target_delta = self.parse_horizon_delta(horizon)
        target_time = cutoff_utc + target_delta

        # Find closest future candle at or immediately after target_time
        candles_after_target = future_df[future_df["timestamp"] >= target_time]
        if candles_after_target.empty:
            # Check if latest available future candle is within horizon
            last_future = future_df.iloc[-1]
            realized_price = float(last_future["close"])
            status = "RESOLVED" if last_future["timestamp"] >= target_time - timedelta(minutes=10) else "UNRESOLVED"
        else:
            eval_candle = candles_after_target.iloc[0]
            realized_price = float(eval_candle["close"])
            status = "RESOLVED"

        if status == "RESOLVED":
            realized_return_pct = round(((realized_price - as_of_price) / as_of_price) * 100.0, 3)
            realized_dir = EvaluationMetricsEngine.classify_realized_direction(
                realized_return_pct, self.neutral_threshold_pct
            )
        else:
            realized_return_pct = None
            realized_dir = None

        return {
            "evaluation_status": status,
            "target_time": target_time,
            "realized_price": realized_price if status == "RESOLVED" else None,
            "realized_return_pct": realized_return_pct,
            "realized_direction": realized_dir,
        }
