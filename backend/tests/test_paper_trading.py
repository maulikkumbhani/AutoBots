import pytest
from datetime import datetime, timezone
from app.execution.paper_engine import PaperTradingEngine


def test_paper_market_order_and_slippage():
    engine = PaperTradingEngine(slippage_bps=2.0, fee_bps=3.0)
    order = {
        "symbol": "NIFTY 50",
        "side": "BUY",
        "quantity": 50,
        "stop_loss": 24900.0,
        "take_profit": 25200.0,
        "trailing_stop_pct": None,
    }
    candle = {"close": 25000.0, "high": 25050.0, "low": 24980.0, "timestamp": datetime.now(timezone.utc)}

    exec_res = engine.execute_market_order(order, candle)
    pos = exec_res["position"]
    fill = exec_res["fill"]

    assert fill["side"] == "BUY"
    assert fill["fill_price"] > 25000.0  # Slippage increases buy price
    assert pos["status"] == "OPEN"
    assert pos["quantity"] == 50


def test_conservative_collision_rule():
    """
    If high >= TP AND low <= SL in the exact same candle,
    conservative rule must execute SL first rather than TP.
    """
    engine = PaperTradingEngine(slippage_bps=2.0, fee_bps=3.0, conservative_collision_rule=True)
    pos = {
        "symbol": "NIFTY 50",
        "side": "LONG",
        "quantity": 50,
        "entry_price": 25000.0,
        "current_price": 25000.0,
        "stop_loss": 24900.0,
        "take_profit": 25200.0,
        "trailing_stop_pct": None,
        "peak_price": 25000.0,
        "trough_price": 25000.0,
        "unrealized_pnl": 0.0,
        "realized_pnl": 0.0,
        "status": "OPEN",
    }

    # Extreme candle hitting both SL and TP
    collision_candle = {
        "open": 25000.0,
        "high": 25250.0,  # Exceeds TP (25200)
        "low": 24850.0,   # Breaches SL (24900)
        "close": 25100.0,
        "timestamp": datetime.now(timezone.utc),
    }

    updated = engine.update_position_candle(pos, collision_candle)
    assert updated["status"] == "CLOSED"
    assert updated["close_reason"] == "STOP_LOSS_COLLISION"
    assert updated["current_price"] == 24900.0  # Closed at SL price
    assert updated["realized_pnl"] < 0  # Net loss
