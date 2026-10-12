from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class DirectionalProbabilities(BaseModel):
    up: float = Field(default=0.0, ge=0.0, le=1.0)
    down: float = Field(default=0.0, ge=0.0, le=1.0)
    sideways: float = Field(default=0.0, ge=0.0, le=1.0)


class PriceRange(BaseModel):
    lower: Optional[float] = None
    upper: Optional[float] = None


class GeminiForecastResponse(BaseModel):
    instrument: str
    as_of: str
    horizon: str
    direction: str = Field(description="up | down | sideways | uncertain")
    probabilities: DirectionalProbabilities
    expected_return: Optional[float] = None
    predicted_range: PriceRange
    supporting_factors: List[str] = Field(default_factory=list)
    conflicting_factors: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)
    data_quality: str = Field(default="good", description="good | limited | insufficient")
    model_version: str = "gemini-2.0-flash-v1"


class ForecastCreateRequest(BaseModel):
    symbol: str
    cutoff_timestamp: datetime
    horizon: str = Field(default="60m", description="5m | 15m | 30m | 60m | session_close | 1d | 5d")
    model_type: str = Field(default="ENSEMBLE", description="STATISTICAL | ML_BASELINE | GEMINI_FLASH | ENSEMBLE")


class ForecastResponse(BaseModel):
    id: int
    instrument_symbol: str
    model_name: str
    cutoff_timestamp: datetime
    as_of_price: float
    horizon: str
    direction: str
    probabilities: DirectionalProbabilities
    expected_return_pct: Optional[float] = None
    predicted_range_lower: Optional[float] = None
    predicted_range_upper: Optional[float] = None
    supporting_factors: List[str] = []
    conflicting_factors: List[str] = []
    risk_factors: List[str] = []
    data_quality: str
    created_at: datetime
    
    # Attached evaluation if already resolved
    evaluation_status: Optional[str] = None
    realized_price: Optional[float] = None
    realized_return_pct: Optional[float] = None
    is_correct: Optional[bool] = None

    model_config = {"from_attributes": True}
