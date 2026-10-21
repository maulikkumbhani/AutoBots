from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Response, HTTPException
from pydantic import BaseModel
from app.execution.mt4_bridge import mt4_bridge

router = APIRouter(prefix="/mt4", tags=["MetaTrader 4 & OctaFX Bridge"])


class MT4ConfigRequest(BaseModel):
    enabled: Optional[bool] = None
    server: Optional[str] = None
    account_id: Optional[str] = None
    default_lot_size: Optional[float] = None
    broker_name: Optional[str] = None


class MT4ManualOrderRequest(BaseModel):
    symbol: str
    side: str  # "BUY" or "SELL"
    lots: Optional[float] = None
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    strategy: Optional[str] = "HIGH_VOLUME_SCALPER"


@router.get("/bridge/status")
async def get_mt4_status():
    """Returns MT4 & OctaFX integration status, connection health, and account metrics."""
    return mt4_bridge.get_status()


@router.post("/bridge/config")
async def update_mt4_config(config: MT4ConfigRequest):
    """Updates configuration parameters for the MT4 Bridge."""
    if config.enabled is not None:
        mt4_bridge.enabled = config.enabled
    if config.server is not None:
        mt4_bridge.server = config.server
    if config.account_id is not None:
        mt4_bridge.account_id = config.account_id
    if config.default_lot_size is not None:
        mt4_bridge.default_lot_size = config.default_lot_size
    if config.broker_name is not None:
        mt4_bridge.broker_name = config.broker_name
    return {
        "status": "success",
        "message": "MT4 bridge configuration updated",
        "current_config": mt4_bridge.get_status(),
    }


@router.get("/bridge/poll-signals")
async def poll_mt4_signals():
    """Polled by the MT4 MQL4 Expert Advisor every 1000ms."""
    signals = mt4_bridge.pop_signals()
    return signals


@router.post("/bridge/report-execution")
async def report_mt4_execution(report: Dict[str, Any]):
    """Called by the MT4 MQL4 EA when an order is executed in MetaTrader 4."""
    rec = mt4_bridge.record_execution_result(report)
    return {"status": "success", "recorded": rec}


@router.post("/bridge/telemetry")
async def update_mt4_telemetry(telemetry: Dict[str, Any]):
    """Receives equity, balance, and margin updates from MT4."""
    mt4_bridge.update_account_telemetry(telemetry)
    return {"status": "success"}


@router.post("/bridge/manual-execute")
async def manual_execute_mt4(order: MT4ManualOrderRequest):
    """Manually queues an order for MT4 execution."""
    price = order.price or 0.0
    lots = order.lots or mt4_bridge.default_lot_size
    sig = mt4_bridge.queue_signal(
        symbol=order.symbol,
        side=order.side,
        lots=lots,
        price=price,
        stop_loss=order.stop_loss,
        take_profit=order.take_profit,
        strategy=order.strategy or "MANUAL_TRADE",
    )
    return {"status": "success", "signal": sig}


@router.get("/bridge/ea-code")
async def get_mt4_ea_code():
    """Serves the complete MQL4 Expert Advisor code for OctaFX & MT4."""
    code = mt4_bridge.generate_mql4_ea_code()
    return {
        "filename": "AutoBots_MultiStrategy_MT4.mq4",
        "instructions": "Copy this code, open MetaEditor 4, create a new Expert Advisor named AutoBots_MultiStrategy_MT4, paste, and click Compile. Then drag onto any chart in your OctaFX MT4 terminal.",
        "code": code,
    }


@router.get("/bridge/download-ea")
async def download_mt4_ea():
    """Directly downloads the MQL4 Expert Advisor file."""
    code = mt4_bridge.generate_mql4_ea_code()
    return Response(
        content=code,
        media_type="text/plain",
        headers={
            "Content-Disposition": 'attachment; filename="AutoBots_MultiStrategy_MT4.mq4"',
            "Cache-Control": "no-cache",
        },
    )
