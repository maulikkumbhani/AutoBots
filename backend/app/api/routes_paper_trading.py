from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
import pytz

from app.schemas.trading import OrderCreateRequest, OrderResponse, PositionResponse, PortfolioSummary
from app.execution.paper_engine import PaperTradingEngine
from app.data.mock import MockDataProvider
from app.data.trade_ledger import trade_ledger

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
    await get_positions()
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
    """Returns active and closed paper positions with real-time mark-to-market prices, MFE, and MAE."""
    from app.execution.bot_runner import trading_bot
    now_utc = datetime.now(timezone.utc)

    for pos in POSITIONS:
        if pos["status"] == "OPEN":
            sym = pos["symbol"]
            cur_p = trading_bot.live_prices.get(sym)
            if not cur_p or cur_p <= 0:
                quote = await mock_prov.fetch_latest_quote(sym)
                cur_p = quote["price"]

            if cur_p and cur_p > 0:
                pos["current_price"] = cur_p
                if pos["side"] == "LONG":
                    pnl = (cur_p - pos["entry_price"]) * pos["quantity"]
                    pos["unrealized_pnl"] = round(pnl, 2)
                    pos["max_favorable_excursion"] = round(max(pos.get("max_favorable_excursion", 0.0), pnl), 2)
                    pos["max_adverse_excursion"] = round(min(pos.get("max_adverse_excursion", 0.0), pnl), 2)
                    # Check auto TP/SL
                    if pos.get("take_profit") and cur_p >= pos["take_profit"]:
                        pos["status"] = "CLOSED"
                        pos["closed_at"] = now_utc
                        pos["close_reason"] = "TAKE_PROFIT"
                        pos["realized_pnl"] = pos["unrealized_pnl"]
                        pos["unrealized_pnl"] = 0.0
                    elif pos.get("stop_loss") and cur_p <= pos["stop_loss"]:
                        pos["status"] = "CLOSED"
                        pos["closed_at"] = now_utc
                        pos["close_reason"] = "STOP_LOSS"
                        pos["realized_pnl"] = pos["unrealized_pnl"]
                        pos["unrealized_pnl"] = 0.0
                else:  # SHORT
                    pnl = (pos["entry_price"] - cur_p) * pos["quantity"]
                    pos["unrealized_pnl"] = round(pnl, 2)
                    pos["max_favorable_excursion"] = round(max(pos.get("max_favorable_excursion", 0.0), pnl), 2)
                    pos["max_adverse_excursion"] = round(min(pos.get("max_adverse_excursion", 0.0), pnl), 2)
                    # Check auto TP/SL
                    if pos.get("take_profit") and cur_p <= pos["take_profit"]:
                        pos["status"] = "CLOSED"
                        pos["closed_at"] = now_utc
                        pos["close_reason"] = "TAKE_PROFIT"
                        pos["realized_pnl"] = pos["unrealized_pnl"]
                        pos["unrealized_pnl"] = 0.0
                    elif pos.get("stop_loss") and cur_p >= pos["stop_loss"]:
                        pos["status"] = "CLOSED"
                        pos["closed_at"] = now_utc
                        pos["close_reason"] = "STOP_LOSS"
                        pos["realized_pnl"] = pos["unrealized_pnl"]
                        pos["unrealized_pnl"] = 0.0

            if pos["status"] == "CLOSED" and not pos.get("_persisted"):
                pos["_persisted"] = True
                cost = pos["entry_price"] * pos["quantity"]
                PORTFOLIO_STATE["current_cash"] += (cost + pos["realized_pnl"] if pos["side"] == "LONG" else pos["realized_pnl"])
                PORTFOLIO_STATE["realized_pnl"] += pos["realized_pnl"]
                ret_pct = round((pos["realized_pnl"] / cost) * 100.0, 2) if cost > 0 else 0.0
                trade_ledger.record_trade(
                    symbol=pos["symbol"],
                    side=pos["side"],
                    quantity=pos["quantity"],
                    entry_price=pos["entry_price"],
                    exit_price=cur_p,
                    realized_pnl=pos["realized_pnl"],
                    realized_return_pct=ret_pct,
                    strategy="HIGH_VOLUME_SCALPER" if pos.get("quantity", 0) >= 100 else "AUTO_BOT",
                    duration_seconds=120,
                    close_reason=pos.get("close_reason", "TAKE_PROFIT"),
                    opened_at=pos.get("opened_at"),
                    closed_at=now_utc,
                )

    return [PositionResponse(**p) for p in POSITIONS]


@router.post("/close-all")
async def close_all_positions():
    """Closes all active open paper trading positions immediately at market price."""
    from app.execution.bot_runner import trading_bot

    closed_count = 0
    total_realized = 0.0
    now_utc = datetime.now(timezone.utc)

    for pos in POSITIONS:
        if pos["status"] == "OPEN":
            symbol = pos["symbol"]
            cur_p = trading_bot.live_prices.get(symbol)
            if not cur_p or cur_p <= 0:
                quote = await mock_prov.fetch_latest_quote(symbol)
                cur_p = quote["price"]

            pos["status"] = "CLOSED"
            pos["closed_at"] = now_utc
            pos["current_price"] = cur_p
            pos["close_reason"] = "USER_CLOSE_ALL"

            if pos["side"] == "LONG":
                pnl = (cur_p - pos["entry_price"]) * pos["quantity"]
            else:
                pnl = (pos["entry_price"] - cur_p) * pos["quantity"]

            pos["realized_pnl"] = round(pnl, 2)
            pos["unrealized_pnl"] = 0.0

            cost = pos["entry_price"] * pos["quantity"]
            PORTFOLIO_STATE["current_cash"] += (cost + pnl if pos["side"] == "LONG" else pnl)
            PORTFOLIO_STATE["realized_pnl"] += pnl
            total_realized += pnl
            closed_count += 1

            ret_pct = round((pnl / cost) * 100.0, 2) if cost > 0 else 0.0
            trade_ledger.record_trade(
                symbol=pos["symbol"],
                side=pos["side"],
                quantity=pos["quantity"],
                entry_price=pos["entry_price"],
                exit_price=cur_p,
                realized_pnl=pnl,
                realized_return_pct=ret_pct,
                strategy="HIGH_VOLUME_SCALPER" if pos.get("quantity", 0) >= 100 else "GENERAL_PAPER",
                duration_seconds=180,
                close_reason="USER_CLOSE_ALL",
                opened_at=pos.get("opened_at"),
                closed_at=now_utc,
            )

    return {
        "message": f"Successfully closed {closed_count} open positions",
        "closed_count": closed_count,
        "realized_pnl": round(total_realized, 2),
        "portfolio": PORTFOLIO_STATE,
    }


@router.post("/positions/{position_id}/close")
async def close_single_position(position_id: int):
    """Closes an individual open position by ID."""
    from app.execution.bot_runner import trading_bot

    target = None
    for pos in POSITIONS:
        if pos.get("id") == position_id and pos["status"] == "OPEN":
            target = pos
            break

    if not target:
        raise HTTPException(status_code=404, detail="Open position not found")

    symbol = target["symbol"]
    cur_p = trading_bot.live_prices.get(symbol)
    if not cur_p or cur_p <= 0:
        quote = await mock_prov.fetch_latest_quote(symbol)
        cur_p = quote["price"]

    now_utc = datetime.now(timezone.utc)
    target["status"] = "CLOSED"
    target["closed_at"] = now_utc
    target["current_price"] = cur_p
    target["close_reason"] = "MANUAL_CLOSE"

    if target["side"] == "LONG":
        pnl = (cur_p - target["entry_price"]) * target["quantity"]
    else:
        pnl = (target["entry_price"] - cur_p) * target["quantity"]

    target["realized_pnl"] = round(pnl, 2)
    target["unrealized_pnl"] = 0.0

    cost = target["entry_price"] * target["quantity"]
    PORTFOLIO_STATE["current_cash"] += (cost + pnl if target["side"] == "LONG" else pnl)
    PORTFOLIO_STATE["realized_pnl"] += pnl

    # Persist to disk ledger
    ret_pct = round((pnl / (target["entry_price"] * target["quantity"])) * 100.0, 2) if target["entry_price"] * target["quantity"] > 0 else 0.0
    trade_ledger.record_trade(
        symbol=target["symbol"],
        side=target["side"],
        quantity=target["quantity"],
        entry_price=target["entry_price"],
        exit_price=cur_p,
        realized_pnl=pnl,
        realized_return_pct=ret_pct,
        strategy="HIGH_VOLUME_SCALPER" if target["quantity"] >= 100 else "GENERAL_PAPER",
        duration_seconds=180,
        close_reason="MANUAL_CLOSE",
        opened_at=target.get("opened_at"),
        closed_at=now_utc,
    )

    return {
        "message": f"Position #{position_id} closed",
        "realized_pnl": round(pnl, 2),
        "position": target,
    }


@router.get("/trades-history")
async def get_trades_history(
    symbol: Optional[str] = None,
    period: str = "DAY",  # DAY, MONTH, YEAR, CUSTOM, ALL
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    Returns persistent trade history and performance metrics filtered by Day, Month, Year, or Custom date range.
    Includes Win Rate %, Net P&L, Profit Factor, and Strategy Breakdown.
    """
    return trade_ledger.get_trades_analysis(symbol, period, start_date, end_date)


@router.post("/reset")
async def reset_paper_trading():
    """Resets entire paper trading portfolio balance, positions, and history."""
    global POSITIONS, ORDERS_LOG
    POSITIONS.clear()
    ORDERS_LOG.clear()
    PORTFOLIO_STATE["current_cash"] = PORTFOLIO_STATE["initial_cash"]
    PORTFOLIO_STATE["realized_pnl"] = 0.0
    PORTFOLIO_STATE["total_fees_paid"] = 0.0
    PORTFOLIO_STATE["total_slippage_paid"] = 0.0
    return {
        "message": "Paper portfolio and trade history reset successfully",
        "portfolio": PORTFOLIO_STATE,
    }
