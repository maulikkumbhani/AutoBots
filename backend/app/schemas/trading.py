from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class OrderCreateRequest(BaseModel):
    portfolio_id: int
    symbol: str
    side: str = Field(description="BUY | SELL")
    order_type: str = Field(default="MARKET", description="MARKET | LIMIT | STOP")
    quantity: float
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    trailing_stop_pct: Optional[float] = None
    signal_id: Optional[int] = None


class OrderResponse(BaseModel):
    id: int
    portfolio_id: int
    symbol: str
    side: str
    order_type: str
    quantity: float
    price: Optional[float]
    stop_loss: Optional[float]
    take_profit: Optional[float]
    trailing_stop_pct: Optional[float]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PositionResponse(BaseModel):
    id: int
    symbol: str
    side: str
    quantity: float
    entry_price: float
    current_price: float
    stop_loss: Optional[float]
    take_profit: Optional[float]
    trailing_stop_pct: Optional[float]
    unrealized_pnl: float
    realized_pnl: float
    max_favorable_excursion: float
    max_adverse_excursion: float
    status: str
    opened_at: datetime
    closed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class PortfolioSummary(BaseModel):
    id: int
    name: str
    currency: str
    initial_cash: float
    current_cash: float
    equity: float
    unrealized_pnl: float
    realized_pnl: float
    total_fees_paid: float
    total_slippage_paid: float
    open_positions_count: int

    model_config = {"from_attributes": True}
