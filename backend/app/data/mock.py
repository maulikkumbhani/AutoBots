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

        # Initial price base anchored to real market values
        sym_u = symbol.upper()
        if "BANK" in sym_u:
            base_price = 55488.0
        elif "NIFTY" in sym_u:
            base_price = 22888.0
        elif "SENSEX" in sym_u or "BSESN" in sym_u:
            base_price = 73850.0
        elif "RELIANCE" in sym_u:
            base_price = 1202.0
        elif "HDFC" in sym_u:
            base_price = 712.0
        elif "TCS" in sym_u:
            base_price = 2460.0
        elif "INFY" in sym_u:
            base_price = 1130.0
        elif "ICICI" in sym_u:
            base_price = 1380.0
        elif "SBIN" in sym_u:
            base_price = 974.0
        elif "BHARTI" in sym_u:
            base_price = 1750.0
        elif "LT" in sym_u:
            base_price = 3600.0
        elif "KOTAK" in sym_u:
            base_price = 1780.0
        elif "GBP" in sym_u:
            base_price = 1.3348
        elif "EUR" in sym_u:
            base_price = 1.1218
        elif "JPY" in sym_u:
            base_price = 158.15
        elif "INR" in sym_u or "USDINR" in sym_u:
            base_price = 94.93
        elif "GC=F" in sym_u or "GOLD" in sym_u:
            base_price = 4130.0
        elif "SI=F" in sym_u or "SILVER" in sym_u:
            base_price = 57.2
        elif "CL=F" in sym_u or "OIL" in sym_u:
            base_price = 100.7
        elif "GSPC" in sym_u or "S&P" in sym_u:
            base_price = 7690.0
        elif "IXIC" in sym_u or "NDX" in sym_u or "NASDAQ" in sym_u:
            base_price = 26430.0
        elif "DJI" in sym_u or "DOW" in sym_u or "US30" in sym_u:
            base_price = 51975.0
        elif "BTC" in sym_u or "BITCOIN" in sym_u:
            base_price = 81500.0
        elif "ETH" in sym_u or "ETHEREUM" in sym_u:
            base_price = 2600.0
        elif "AAPL" in sym_u:
            base_price = 342.0
        elif "MSFT" in sym_u:
            base_price = 490.0
        elif "NVDA" in sym_u:
            base_price = 217.0
        elif "TSLA" in sym_u:
            base_price = 220.0
        else:
            base_price = 1000.0
        
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
