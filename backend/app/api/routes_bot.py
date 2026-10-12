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


@router.get("/status")
async def get_bot_status():
    """Returns real-time status, strategy config, win rate %, and log stream of the trading bot."""
    return trading_bot.get_config()


@router.post("/start")
async def start_bot():
    """Activates automated trading bot."""
    trading_bot.is_active = True
    # Run immediate cycle upon starting
    await trading_bot.execute_cycle()
    return {"message": "Auto-trading bot started successfully", "status": trading_bot.get_config()}


@router.post("/stop")
async def stop_bot():
    """Deactivates automated trading bot."""
    trading_bot.is_active = False
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
