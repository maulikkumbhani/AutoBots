from typing import Dict, Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.execution.bot_runner import trading_bot

router = APIRouter(prefix="/bot", tags=["Automated Trading Bot"])


class BotConfigUpdate(BaseModel):
    symbol: Optional[str] = None
    strategy_type: Optional[str] = None
    quantity: Optional[float] = None
    take_profit_pct: Optional[float] = None
    stop_loss_pct: Optional[float] = None
    trailing_stop_pct: Optional[float] = None
    min_confidence: Optional[float] = None
    execution_mode: Optional[str] = None  # "PAPER" or "MT5_LIVE"
    mt5_auto_trade: Optional[bool] = None


@router.get("/status")
async def get_bot_status():
    """Returns real-time status, strategy config, win rate %, and log stream of the trading bot."""
    return trading_bot.get_config()


class BotStartRequest(BaseModel):
    symbol: Optional[str] = None


@router.post("/start")
async def start_bot(req: Optional[BotStartRequest] = None):
    """Activates automated trading bot in continuous background execution for the active chart symbol."""
    if req and req.symbol:
        trading_bot.update_config({"symbol": req.symbol})
    await trading_bot.start()
    return {"message": f"Auto-trading bot started for {trading_bot.symbol}", "status": trading_bot.get_config()}


@router.post("/stop")
async def stop_bot():
    """Deactivates automated trading bot background execution."""
    await trading_bot.stop()
    return {"message": "Auto-trading bot stopped", "status": trading_bot.get_config()}


@router.post("/configure")
async def configure_bot(config: BotConfigUpdate):
    """Updates bot risk parameters and strategy selection."""
    update_data = {k: v for k, v in config.model_dump().items() if v is not None}
    trading_bot.update_config(update_data)
    return {"message": "Bot configuration updated", "config": trading_bot.get_config()}


@router.post("/cycle")
async def trigger_cycle():
    """Manually triggers one algorithmic evaluation and execution cycle."""
    log_entry = await trading_bot.execute_cycle()
    return {"cycle_result": log_entry, "status": trading_bot.get_config()}


class ToggleSymbolRequest(BaseModel):
    symbol: str
    enabled: bool


@router.get("/multi-asset-overview")
async def get_multi_asset_overview(period: str = "DAY"):
    """Returns simultaneous multi-asset bot status, live pricing, active positions, and success rates."""
    return trading_bot.get_multi_asset_overview(period=period)


@router.post("/toggle-symbol")
async def toggle_symbol_status(req: ToggleSymbolRequest):
    """Enables or disables automated trading for a specific stock in the multi-asset bot engine."""
    success = trading_bot.toggle_asset(req.symbol, req.enabled)
    return {
        "message": f"Symbol {req.symbol} automated trading {'enabled' if req.enabled else 'paused'}",
        "symbol": req.symbol,
        "enabled": req.enabled,
        "success": success,
    }
