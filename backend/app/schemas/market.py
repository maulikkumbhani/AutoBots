from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CandleSchema(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    vwap: Optional[float] = None

    model_config = {"from_attributes": True}


class CandleSeriesResponse(BaseModel):
    symbol: str
    timeframe: str
    candles: List[CandleSchema]


class IndicatorValues(BaseModel):
    timestamp: datetime
    # Moving Averages
    ema_9: Optional[float] = None
    ema_20: Optional[float] = None
    ema_50: Optional[float] = None
    ema_200: Optional[float] = None
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    # Oscillators & Volatility
    vwap: Optional[float] = None
    rsi_14: Optional[float] = None
    macd_line: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    atr_14: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    # Key levels & signals
    support_zone: Optional[float] = None
    resistance_zone: Optional[float] = None
    is_swing_high: Optional[bool] = None
    is_swing_low: Optional[bool] = None
    is_volume_spike: Optional[bool] = None
    market_regime: Optional[str] = None  # TRENDING_UP, TRENDING_DOWN, RANGING, HIGH_VOLATILITY


class InstrumentSummary(BaseModel):
    id: int
    symbol: str
    name: str
    exchange: str
    asset_class: str
    currency: str
    tick_size: float
    lot_size: int

    model_config = {"from_attributes": True}
