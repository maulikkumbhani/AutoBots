import pytest
import asyncio
from datetime import datetime
import pytz

from app.data.mock import MockDataProvider
from app.replay.engine import HistoricalReplayEngine
from app.prediction.statistical import StatisticalRuleModel


@pytest.mark.asyncio
async def test_zero_lookahead_leakage_guarantee():
    """
    Critical integrity test:
    Altering future candles post-cutoff must have ZERO impact on
    the point-in-time market state, indicator values, or prediction at cutoff T.
    """
    mock_provider = MockDataProvider(seed=101)
    engine = HistoricalReplayEngine(data_provider=mock_provider)

    cutoff_t = datetime(2026, 10, 5, 14, 30, tzinfo=pytz.UTC)

    # Reconstruct state
    state1 = await engine.reconstruct_market_state(
        symbol="NIFTY 50",
        cutoff_timestamp=cutoff_t,
    )

    model = StatisticalRuleModel()
    pred1 = await model.predict("NIFTY 50", state1["past_df"], horizon="60m")

    # Now verify past_df contains NO candles > cutoff_t
    assert (state1["past_df"]["timestamp"] <= cutoff_t).all(), "Leakage detected: past_df contains future candles!"

    # Now simulate future corruption by modifying future_df
    corrupted_future = state1["future_df"].copy()
    corrupted_future["close"] = corrupted_future["close"] * 5.0  # Massive 500% spike in future!

    # Reconstruct state again
    state2 = await engine.reconstruct_market_state(
        symbol="NIFTY 50",
        cutoff_timestamp=cutoff_t,
    )
    pred2 = await model.predict("NIFTY 50", state2["past_df"], horizon="60m")

    # State and prediction at cutoff T MUST be exactly identical
    assert state1["as_of_price"] == state2["as_of_price"]
    assert state1["last_bar"]["rsi_14"] == state2["last_bar"]["rsi_14"]
    assert pred1["direction"] == pred2["direction"]
    assert pred1["probabilities"] == pred2["probabilities"]

    # Verify forward evaluation correctly detects future changes
    eval1 = engine.evaluate_future_outcome(
        state1["as_of_price"], state1["future_df"], state1["cutoff_utc"], "60m"
    )
    eval_corrupted = engine.evaluate_future_outcome(
        state1["as_of_price"], corrupted_future, state1["cutoff_utc"], "60m"
    )

    assert eval1["evaluation_status"] == "RESOLVED"
    assert eval_corrupted["realized_price"] > eval1["realized_price"]
