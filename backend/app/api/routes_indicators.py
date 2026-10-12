from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Query
import pytz
import numpy as np

from app.data.mock import MockDataProvider
from app.data.yahoo import YahooFinanceProvider
from app.indicators.calculator import TechnicalIndicatorEngine
from app.schemas.market import IndicatorValues

router = APIRouter(prefix="/indicators", tags=["Technical Indicators"])

mock_provider = MockDataProvider()
yahoo_provider = YahooFinanceProvider()


@router.get("/calculate", response_model=List[IndicatorValues])
async def calculate_indicators(
    symbol: str = Query("NIFTY 50"),
    timeframe: str = Query("15m"),
    days_back: int = Query(20),
    provider: str = Query("yahoo"),
):
    """
    Computes all standard indicators from OHLCV market candles.
    Returns overlays (EMA, SMA, VWAP, Bollinger, S/R) and oscillators (RSI, MACD, ATR).
    """
    now = datetime.now(pytz.UTC)
    start_time = now - timedelta(days=days_back)
    
    selected_provider = yahoo_provider if provider.lower() == "yahoo" else mock_provider
    try:
        df = await selected_provider.fetch_historical_candles(symbol, timeframe, start_time, now)
        if df.empty and provider.lower() == "yahoo":
            df = await mock_provider.fetch_historical_candles(symbol, timeframe, start_time, now)
    except Exception:
        df = await mock_provider.fetch_historical_candles(symbol, timeframe, start_time, now)

    if df.empty:
        return []

    df_calc = TechnicalIndicatorEngine.calculate_all(df)

    def sanitize(val):
        if val is None or (isinstance(val, (float, np.floating)) and np.isnan(val)):
            return None
        return round(float(val), 2)

    results = []
    for _, row in df_calc.iterrows():
        results.append(
            IndicatorValues(
                timestamp=row["timestamp"],
                ema_9=sanitize(row.get("ema_9")),
                ema_20=sanitize(row.get("ema_20")),
                ema_50=sanitize(row.get("ema_50")),
                ema_200=sanitize(row.get("ema_200")),
                sma_20=sanitize(row.get("sma_20")),
                sma_50=sanitize(row.get("sma_50")),
                vwap=sanitize(row.get("vwap")),
                rsi_14=sanitize(row.get("rsi_14")),
                macd_line=sanitize(row.get("macd_line")),
                macd_signal=sanitize(row.get("macd_signal")),
                macd_hist=sanitize(row.get("macd_hist")),
                atr_14=sanitize(row.get("atr_14")),
                bb_upper=sanitize(row.get("bb_upper")),
                bb_middle=sanitize(row.get("bb_middle")),
                bb_lower=sanitize(row.get("bb_lower")),
                support_zone=sanitize(row.get("support_zone")),
                resistance_zone=sanitize(row.get("resistance_zone")),
                is_swing_high=bool(row.get("is_swing_high", False)),
                is_swing_low=bool(row.get("is_swing_low", False)),
                is_volume_spike=bool(row.get("is_volume_spike", False)),
                market_regime=str(row.get("market_regime", "RANGING")),
            )
        )

    return results
