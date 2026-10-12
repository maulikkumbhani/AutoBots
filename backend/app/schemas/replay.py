from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.market import CandleSchema, IndicatorValues
from app.schemas.prediction import ForecastResponse


class HistoricalReplayRequest(BaseModel):
    symbol: str
    cutoff_timestamp: datetime
    horizon: str = "60m"
    model_type: str = "ENSEMBLE"
    include_simulated_trade: bool = True


class HistoricalReplayResult(BaseModel):
    symbol: str
    cutoff_timestamp: datetime
    as_of_price: float
    market_open: bool
    candles_history_count: int
    current_indicators: Optional[IndicatorValues] = None
    forecast: Optional[ForecastResponse] = None
    news_headlines_at_cutoff: List[str] = []
    economic_events_at_cutoff: List[str] = []
    
    # If historical outcome is known in available data
    realized_price: Optional[float] = None
    realized_return_pct: Optional[float] = None
    realized_direction: Optional[str] = None
    is_correct: Optional[bool] = None
    evaluation_status: str = "UNRESOLVED"
