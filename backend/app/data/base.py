from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Optional
import pandas as pd


class BaseDataProvider(ABC):
    """
    Abstract interface for market data providers.
    Enforces standardized OHLCV dataframe output with UTC timestamps.
    """

    @abstractmethod
    def get_provider_name(self) -> str:
        """Returns the identifier name of the provider."""
        pass

    @abstractmethod
    async def fetch_historical_candles(
        self,
        symbol: str,
        timeframe: str,
        start_time: datetime,
        end_time: datetime,
    ) -> pd.DataFrame:
        """
        Fetch historical candles within [start_time, end_time].
        Must return DataFrame with columns:
        ['timestamp', 'open', 'high', 'low', 'close', 'volume']
        where 'timestamp' is timezone-aware UTC datetime.
        """
        pass

    @abstractmethod
    async def fetch_latest_quote(self, symbol: str) -> dict:
        """
        Fetch most recent quote for symbol.
        Returns dict with keys: 'symbol', 'price', 'timestamp', 'volume'.
        """
        pass
