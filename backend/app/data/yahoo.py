from datetime import datetime, timedelta
import asyncio
from typing import Dict
import pandas as pd
import pytz
import yfinance as yf
from app.data.base import BaseDataProvider


class YahooFinanceProvider(BaseDataProvider):
    """
    Market data provider using Yahoo Finance.
    Handles Indian Indices (NSE), US Stocks/Indices, and Commodities.
    """

    SYMBOL_MAP: Dict[str, str] = {
        "NIFTY 50": "^NSEI",
        "NIFTY50": "^NSEI",
        "BANK NIFTY": "^NSEBANK",
        "BANKNIFTY": "^NSEBANK",
        "S&P 500": "^GSPC",
        "SP500": "^GSPC",
        "NASDAQ 100": "^NDX",
        "NASDAQ": "^IXIC",
        "GOLD": "GC=F",
    }

    TIMEFRAME_MAP: Dict[str, str] = {
        "1m": "1m",
        "5m": "5m",
        "15m": "15m",
        "1h": "60m",
        "1d": "1d",
    }

    def get_provider_name(self) -> str:
        return "YAHOO_FINANCE"

    def normalize_symbol(self, symbol: str) -> str:
        clean = symbol.strip().upper()
        return self.SYMBOL_MAP.get(clean, symbol)

    async def fetch_historical_candles(
        self,
        symbol: str,
        timeframe: str,
        start_time: datetime,
        end_time: datetime,
    ) -> pd.DataFrame:
        normalized_sym = self.normalize_symbol(symbol)
        interval = self.TIMEFRAME_MAP.get(timeframe, "15m")

        def _fetch_history():
            ticker = yf.Ticker(normalized_sym)
            # Choose period based on timeframe
            if timeframe in ["1m", "5m"]:
                p = "5d"
            elif timeframe in ["15m", "1h"]:
                p = "1mo"
            else:
                p = "6mo"
            
            try:
                hist = ticker.history(period=p, interval=interval, auto_adjust=False)
                if not hist.empty:
                    return hist
            except Exception:
                pass
            
            # Fallback to download
            try:
                return yf.download(
                    tickers=normalized_sym,
                    start=start_time.strftime("%Y-%m-%d"),
                    end=(end_time + timedelta(days=1)).strftime("%Y-%m-%d"),
                    interval=interval,
                    progress=False,
                    auto_adjust=False,
                )
            except Exception:
                return pd.DataFrame()

        loop = asyncio.get_running_loop()
        df = await loop.run_in_executor(None, _fetch_history)

        if df.empty:
            return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])

        # Flatten multi-index columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = df.reset_index()
        # Rename column to timestamp
        time_col = "Datetime" if "Datetime" in df.columns else "Date"
        df = df.rename(
            columns={
                time_col: "timestamp",
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume",
            }
        )

        # Standardize timestamp to UTC
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        if df["timestamp"].dt.tz is None:
            df["timestamp"] = df["timestamp"].dt.tz_localize("UTC")
        else:
            df["timestamp"] = df["timestamp"].dt.tz_convert("UTC")

        # Clean rows
        df = df.dropna(subset=["close"])
        return df[["timestamp", "open", "high", "low", "close", "volume"]].sort_values("timestamp").reset_index(drop=True)

    async def fetch_latest_quote(self, symbol: str) -> dict:
        normalized_sym = self.normalize_symbol(symbol)
        loop = asyncio.get_running_loop()
        ticker = await loop.run_in_executor(None, lambda: yf.Ticker(normalized_sym))
        
        info = getattr(ticker, "fast_info", None)
        price = getattr(info, "last_price", None) if info else None
        
        if price is None:
            # Fallback to history
            hist = await loop.run_in_executor(None, lambda: ticker.history(period="1d", interval="5m"))
            if not hist.empty:
                price = float(hist["Close"].iloc[-1])
            else:
                price = 0.0

        return {
            "symbol": symbol,
            "price": float(price),
            "timestamp": datetime.now(pytz.UTC),
            "volume": 0.0,
        }
