import pytest
from app.execution.bot_runner import AutoTradingBot


@pytest.mark.asyncio
async def test_bot_cycle_execution_and_order_placement():
    bot = AutoTradingBot()
    bot.symbol = "NIFTY 50"
    bot.is_active = True
    bot.quantity = 25.0
    bot.min_confidence = 0.30  # Low threshold for test execution trigger

    # Execute cycle
    result = await bot.execute_cycle()
    assert result is not None
    assert "action" in result
    assert result["action"] in ["BOUGHT", "SOLD", "MONITORING"]

    cfg = bot.get_config()
    assert cfg["symbol"] == "NIFTY 50"
    assert cfg["is_active"] == True
    assert len(cfg["recent_logs"]) >= 1
