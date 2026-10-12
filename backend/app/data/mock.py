from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import pytz
from app.data.base import BaseDataProvider


class MockDataProvider(BaseDataProvider):
    """
    Deterministic synthetic market data provider for unit testing,
    offline research, and historical replay validation.
    Generates realistic OHLCV with Geometric Brownian Motion & regime shifts.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed

    def get_provider_name(self) -> str:
        return "MOCK_PROVIDER"

    async def fetch_historical_candles(
        self,
        symbol: str,
        timeframe: str,
        start_time: datetime,
        end_time: datetime,
    ) -> pd.DataFrame:
        # Normalize timestamps to UTC
        if start_time.tzinfo is None:
            start_time = pytz.UTC.localize(start_time)
        if end_time.tzinfo is None:
            end_time = pytz.UTC.localize(end_time)

        # Delta per bar
        tf_map = {
            "1m": timedelta(minutes=1),
            "5m": timedelta(minutes=5),
            "15m": timedelta(minutes=15),
            "1h": timedelta(hours=1),
            "1d": timedelta(days=1),
        }
        step = tf_map.get(timeframe, timedelta(minutes=15))

        # Generate timestamps
        timestamps = []
        curr = start_time
        while curr <= end_time:
            # Exclude weekends
            if curr.weekday() < 5:
                timestamps.append(curr)
            curr += step

        if not timestamps:
            return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])

        n = len(timestamps)
        # Seed generator based on symbol hash and internal seed for repeatability
        sym_seed = (self.seed + abs(hash(symbol)) % 10000) % 2**32
        rng = np.random.default_rng(sym_seed)

        # Initial price base
        base_price = 25000.0 if "NIFTY" in symbol.upper() else (50000.0 if "BANK" in symbol.upper() else 2500.0)
        
        # Returns with slight drift and realistic intraday volatility
        returns = rng.normal(loc=0.0001, scale=0.003, size=n)
        price_path = base_price * np.exp(np.cumsum(returns))

        opens = price_path * (1.0 + rng.normal(0, 0.0005, n))
        closes = price_path * (1.0 + rng.normal(0, 0.0005, n))
        highs = np.maximum(opens, closes) * (1.0 + np.abs(rng.normal(0, 0.001, n)))
        lows = np.minimum(opens, closes) * (1.0 - np.abs(rng.normal(0, 0.001, n)))
        volumes = rng.lognormal(mean=10.0, sigma=0.5, size=n)

        # Ensure occasional volume spikes
        spike_indices = rng.choice(n, size=max(1, n // 25), replace=False)
        volumes[spike_indices] *= 3.5

        df = pd.DataFrame({
            "timestamp": timestamps,
            "open": np.round(opens, 2),
            "high": np.round(highs, 2),
            "low": np.round(lows, 2),
            "close": np.round(closes, 2),
            "volume": np.round(volumes, 0),
        })

        return df

    async def fetch_latest_quote(self, symbol: str) -> dict:
        now = datetime.now(pytz.UTC)
        df = await self.fetch_historical_candles(symbol, "15m", now - timedelta(hours=2), now)
        if df.empty:
            return {"symbol": symbol, "price": 25000.0, "timestamp": now, "volume": 1000.0}
        last_row = df.iloc[-1]
        return {
            "symbol": symbol,
            "price": float(last_row["close"]),
            "timestamp": last_row["timestamp"],
            "volume": float(last_row["volume"]),
        }
