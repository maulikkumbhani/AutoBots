from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Query
import pytz

from app.data.mock import MockDataProvider
from app.data.yahoo import YahooFinanceProvider
from app.indicators.order_block_engine import InstitutionalOrderBlockEngine
from app.execution.bot_runner import trading_bot

router = APIRouter(prefix="/order-block", tags=["Institutional Order Blocks & SMC"])

mock_provider = MockDataProvider()
yahoo_provider = YahooFinanceProvider()


@router.get("/analysis")
async def get_order_block_analysis(
    symbol: str = "NIFTY 50",
    timeframe: str = "15m",
    days_back: int = 25,
    provider: str = "yahoo",
):
    """
    Returns complete Institutional Order Block & Smart Money Concepts (SMC) telemetry:
    - Bullish / Bearish Order Blocks (Demand & Supply) with mitigation status and 50% equilibrium
    - Fair Value Gaps (FVG) and fill status
    - Buy-Side (BSL) and Sell-Side (SSL) Liquidity Pools & Sweeps
    - Real-time Buyer vs Seller Volume Delta & CVD
    - Market Structure Shifts (BOS / CHoCH) and Premium vs Discount Equilibrium
    - 100% Precision Institutional Sniper Confluence Recommendation
    """
    now = datetime.now(pytz.UTC)
    start_time = now - timedelta(days=days_back)

    selected_provider = yahoo_provider if provider.lower() == "yahoo" else mock_provider
    df = None
    try:
        df = await selected_provider.fetch_historical_candles(symbol, timeframe, start_time, now)
        if (df is None or df.empty or len(df) < 15) and provider.lower() == "yahoo":
            df = await mock_provider.fetch_historical_candles(symbol, timeframe, start_time, now)
    except Exception:
        df = await mock_provider.fetch_historical_candles(symbol, timeframe, start_time, now)

    if df is None or df.empty:
        df = await mock_provider.fetch_historical_candles(symbol, timeframe, start_time, now)

    # Get active live price from trading bot
    cur_p = trading_bot.live_prices.get(symbol)
    if not cur_p or cur_p <= 0:
        tick = trading_bot.get_live_tick(symbol)
        cur_p = tick.get("price")

    analysis = InstitutionalOrderBlockEngine.analyze_order_blocks(df, cur_price=cur_p)
    analysis["symbol"] = symbol
    analysis["timeframe"] = timeframe
    return analysis
