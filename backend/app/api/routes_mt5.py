from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import os

from app.execution.mt5_bridge import mt5_bridge

router = APIRouter(prefix="/mt5/bridge", tags=["MT5 Trading Bridge"])


class MT5ConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    server: Optional[str] = None
    account_id: Optional[str] = None
    default_lot_size: Optional[float] = None
    magic_number: Optional[int] = None
    slippage_points: Optional[int] = None


class ManualSignalRequest(BaseModel):
    symbol: str
    side: str  # BUY or SELL
    lots: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    price: Optional[float] = None
    strategy: Optional[str] = "Manual_Test"


@router.get("/status")
async def get_mt5_status() -> Dict[str, Any]:
    """Returns MT5 bridge connection state, account info, and active queue."""
    return mt5_bridge.get_status()


@router.post("/config")
async def update_mt5_config(cfg: MT5ConfigUpdate) -> Dict[str, Any]:
    """Updates configuration for MT5 automated trading bridge."""
    if cfg.enabled is not None:
        mt5_bridge.enabled = cfg.enabled
    if cfg.server is not None:
        mt5_bridge.server = cfg.server
        mt5_bridge.account_info["server"] = cfg.server
    if cfg.account_id is not None:
        mt5_bridge.account_id = cfg.account_id
        mt5_bridge.account_info["account_id"] = cfg.account_id
    if cfg.default_lot_size is not None and cfg.default_lot_size > 0:
        mt5_bridge.default_lot_size = cfg.default_lot_size
    if cfg.magic_number is not None:
        mt5_bridge.magic_number = cfg.magic_number
    if cfg.slippage_points is not None:
        mt5_bridge.slippage_points = cfg.slippage_points

    return {
        "message": "MT5 configuration updated successfully",
        "status": mt5_bridge.get_status(),
    }


@router.post("/heartbeat")
async def receive_mt5_heartbeat(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Receives live account balance, equity, and state from MT5 Expert Advisor."""
    mt5_bridge.update_heartbeat(payload)
    return {"status": "ACK", "received": True}


@router.get("/pending-signals")
async def get_pending_signals() -> List[Dict[str, Any]]:
    """Called by MT5 EA timer to fetch queued orders to execute in MT5 terminal."""
    return mt5_bridge.pop_signals()


@router.post("/order-result")
async def report_order_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Receives execution confirmation, fill price, and ticket number from MT5 EA."""
    return mt5_bridge.record_execution_result(result)


@router.post("/manual-execute")
async def manual_execute_signal(req: ManualSignalRequest) -> Dict[str, Any]:
    """Manually dispatches an order signal to the MT5 execution queue for testing."""
    price = req.price or 1.0
    lots = req.lots or mt5_bridge.default_lot_size

    signal = mt5_bridge.queue_signal(
        symbol=req.symbol,
        side=req.side,
        lots=lots,
        price=price,
        stop_loss=req.stop_loss,
        take_profit=req.take_profit,
        strategy=req.strategy or "MANUAL_UI",
        comment=f"AutoBot_{req.side}",
    )
    return {
        "message": f"Signal {signal['signal_id']} queued for MT5 execution",
        "signal": signal,
    }


@router.get("/ea-code")
async def get_mt5_ea_code() -> Dict[str, str]:
    """Returns the MQL5 Expert Advisor source code for easy copy/paste."""
    ea_path = os.path.join(os.path.dirname(__file__), "..", "mt5", "AutoBot_MT5_Bridge.mq5")
    if os.path.exists(ea_path):
        with open(ea_path, "r", encoding="utf-8") as f:
            code = f.read()
    else:
        code = "// EA file not found on disk"
    return {"filename": "AutoBot_MT5_Bridge.mq5", "code": code}
