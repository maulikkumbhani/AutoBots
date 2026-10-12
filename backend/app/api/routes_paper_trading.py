from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
import pytz

from app.schemas.trading import OrderCreateRequest, OrderResponse, PositionResponse, PortfolioSummary
from app.execution.paper_engine import PaperTradingEngine
from app.data.mock import MockDataProvider

router = APIRouter(prefix="/paper", tags=["Paper Trading"])

engine = PaperTradingEngine(slippage_bps=2.0, fee_bps=3.0)
mock_prov = MockDataProvider()

# In-memory paper portfolio state
PORTFOLIO_STATE = {
    "id": 1,
    "name": "Primary Educational Alpha Portfolio",
    "currency": "INR",
    "initial_cash": 1_000_000.0,
    "current_cash": 1_000_000.0,
    "realized_pnl": 0.0,
    "total_fees_paid": 0.0,
    "total_slippage_paid": 0.0,
}

ORDERS_LOG: List[Dict[str, Any]] = []
POSITIONS: List[Dict[str, Any]] = []


@router.get("/portfolio", response_model=PortfolioSummary)
async def get_portfolio():
    """Returns current portfolio balance, equity, and PnL."""
    open_positions = [p for p in POSITIONS if p["status"] == "OPEN"]
    unrealized = sum(p["unrealized_pnl"] for p in open_positions)
    equity = PORTFOLIO_STATE["current_cash"] + unrealized

    return PortfolioSummary(
        id=PORTFOLIO_STATE["id"],
        name=PORTFOLIO_STATE["name"],
        currency=PORTFOLIO_STATE["currency"],
        initial_cash=PORTFOLIO_STATE["initial_cash"],
        current_cash=round(PORTFOLIO_STATE["current_cash"], 2),
        equity=round(equity, 2),
        unrealized_pnl=round(unrealized, 2),
        realized_pnl=round(PORTFOLIO_STATE["realized_pnl"], 2),
        total_fees_paid=round(PORTFOLIO_STATE["total_fees_paid"], 2),
        total_slippage_paid=round(PORTFOLIO_STATE["total_slippage_paid"], 2),
        open_positions_count=len(open_positions),
    )


@router.post("/orders", response_model=OrderResponse)
async def create_order(order_req: OrderCreateRequest):
    """
    Simulates paper order execution with slippage, commissions, and SL/TP setup.
    """
    quote = await mock_prov.fetch_latest_quote(order_req.symbol)
    cur_price = quote["price"]

    order_id = len(ORDERS_LOG) + 1
    order_dict = order_req.model_dump()
    order_dict["id"] = order_id
    order_dict["created_at"] = datetime.now(timezone.utc)
    order_dict["status"] = "FILLED" if order_req.order_type == "MARKET" else "PENDING"

    current_candle = {
        "close": cur_price,
        "high": cur_price * 1.002,
        "low": cur_price * 0.998,
        "timestamp": datetime.now(timezone.utc),
    }

    if order_req.order_type == "MARKET":
        exec_result = engine.execute_market_order(order_dict, current_candle)
        pos = exec_result["position"]
        pos["id"] = len(POSITIONS) + 1
        pos["portfolio_id"] = order_req.portfolio_id
        
        # Deduct cash & fees
        cost = pos["entry_price"] * pos["quantity"]
        PORTFOLIO_STATE["current_cash"] -= (cost if order_req.side == "BUY" else -cost)
        PORTFOLIO_STATE["total_fees_paid"] += exec_result["fill"]["fee"]
        PORTFOLIO_STATE["total_slippage_paid"] += exec_result["fill"]["slippage"]
        
        POSITIONS.append(pos)

    ORDERS_LOG.append(order_dict)

    return OrderResponse(
        id=order_id,
        portfolio_id=order_req.portfolio_id,
        symbol=order_req.symbol,
        side=order_req.side,
        order_type=order_req.order_type,
        quantity=order_req.quantity,
        price=cur_price,
        stop_loss=order_req.stop_loss,
        take_profit=order_req.take_profit,
        trailing_stop_pct=order_req.trailing_stop_pct,
        status="FILLED",
        created_at=order_dict["created_at"],
    )


@router.get("/positions", response_model=List[PositionResponse])
async def get_positions():
    """Returns active and closed paper positions with MFE and MAE."""
    return [PositionResponse(**p) for p in POSITIONS]
