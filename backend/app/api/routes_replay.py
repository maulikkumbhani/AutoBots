from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import pytz

from app.core.database import get_db
from app.data.mock import MockDataProvider
from app.data.yahoo import YahooFinanceProvider
from app.replay.engine import HistoricalReplayEngine
from app.prediction.ensemble import EnsemblePredictionModel
from app.prediction.statistical import StatisticalRuleModel
from app.prediction.ml_baseline import MLBaselineModel
from app.prediction.gemini_reasoner import GeminiFlashReasoner
from app.schemas.replay import HistoricalReplayRequest, HistoricalReplayResult
from app.schemas.prediction import ForecastResponse, DirectionalProbabilities
from app.schemas.market import IndicatorValues

router = APIRouter(prefix="/replay", tags=["Historical Replay"])

mock_provider = MockDataProvider()
yahoo_provider = YahooFinanceProvider()

models_map = {
    "STATISTICAL": StatisticalRuleModel(),
    "ML_BASELINE": MLBaselineModel(),
    "GEMINI_FLASH": GeminiFlashReasoner(),
    "ENSEMBLE": EnsemblePredictionModel(),
}


@router.post("/execute", response_model=HistoricalReplayResult)
async def execute_replay(request: HistoricalReplayRequest):
    """
    Executes historical point-in-time market replay for a chosen cutoff:
    1. Loads data available strictly up to cutoff_timestamp (Zero look-ahead).
    2. Calculates technical indicators on past data.
    3. Generates prediction with requested model.
    4. Advances to future evaluation horizon and computes realized outcome.
    """
    cutoff = request.cutoff_timestamp
    if cutoff.tzinfo is None:
        cutoff = pytz.UTC.localize(cutoff)

    # Replay engine with Yahoo provider fallback to mock
    replay_engine = HistoricalReplayEngine(data_provider=yahoo_provider)
    state = await replay_engine.reconstruct_market_state(
        symbol=request.symbol,
        cutoff_timestamp=cutoff,
    )

    if state["past_df"].empty or len(state["past_df"]) < 5:
        # Fallback to mock provider
        replay_engine = HistoricalReplayEngine(data_provider=mock_provider)
        state = await replay_engine.reconstruct_market_state(
            symbol=request.symbol,
            cutoff_timestamp=cutoff,
        )

    if state["as_of_price"] is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to reconstruct market data for {request.symbol} at cutoff {request.cutoff_timestamp}",
        )

    # Run chosen model
    model = models_map.get(request.model_type.upper(), models_map["ENSEMBLE"])
    prediction_result = await model.predict(
        symbol=request.symbol,
        past_df=state["past_df"],
        horizon=request.horizon,
    )

    # Evaluate future outcome
    eval_result = replay_engine.evaluate_future_outcome(
        as_of_price=state["as_of_price"],
        future_df=state["future_df"],
        cutoff_utc=state["cutoff_utc"],
        horizon=request.horizon,
    )

    is_correct = None
    if eval_result["evaluation_status"] == "RESOLVED":
        pred_dir = prediction_result["direction"].upper()
        real_dir = eval_result["realized_direction"].upper()
        is_correct = (pred_dir == real_dir)

    # Format indicators
    last_bar = state["last_bar"]
    cur_indicators = IndicatorValues(
        timestamp=last_bar["timestamp"],
        ema_9=float(last_bar.get("ema_9", state["as_of_price"])),
        ema_20=float(last_bar.get("ema_20", state["as_of_price"])),
        ema_50=float(last_bar.get("ema_50", state["as_of_price"])),
        rsi_14=float(last_bar.get("rsi_14", 50.0)),
        macd_line=float(last_bar.get("macd_line", 0.0)),
        macd_signal=float(last_bar.get("macd_signal", 0.0)),
        macd_hist=float(last_bar.get("macd_hist", 0.0)),
        atr_14=float(last_bar.get("atr_14", state["as_of_price"] * 0.005)),
        bb_upper=float(last_bar.get("bb_upper", state["as_of_price"] * 1.02)),
        bb_middle=float(last_bar.get("bb_middle", state["as_of_price"])),
        bb_lower=float(last_bar.get("bb_lower", state["as_of_price"] * 0.98)),
        support_zone=float(last_bar.get("support_zone", state["as_of_price"] * 0.98)),
        resistance_zone=float(last_bar.get("resistance_zone", state["as_of_price"] * 1.02)),
        is_swing_high=bool(last_bar.get("is_swing_high", False)),
        is_swing_low=bool(last_bar.get("is_swing_low", False)),
        is_volume_spike=bool(last_bar.get("is_volume_spike", False)),
        market_regime=str(last_bar.get("market_regime", "RANGING")),
    )

    forecast_response = ForecastResponse(
        id=1,
        instrument_symbol=request.symbol,
        model_name=model.get_model_name(),
        cutoff_timestamp=cutoff,
        as_of_price=state["as_of_price"],
        horizon=request.horizon,
        direction=prediction_result["direction"],
        probabilities=DirectionalProbabilities(**prediction_result["probabilities"]),
        expected_return_pct=prediction_result.get("expected_return"),
        predicted_range_lower=prediction_result["predicted_range"].get("lower"),
        predicted_range_upper=prediction_result["predicted_range"].get("upper"),
        supporting_factors=prediction_result.get("supporting_factors", []),
        conflicting_factors=prediction_result.get("conflicting_factors", []),
        risk_factors=prediction_result.get("risk_factors", []),
        data_quality=prediction_result.get("data_quality", "good"),
        created_at=datetime.now(pytz.UTC),
        evaluation_status=eval_result["evaluation_status"],
        realized_price=eval_result["realized_price"],
        realized_return_pct=eval_result["realized_return_pct"],
        is_correct=is_correct,
    )

    return HistoricalReplayResult(
        symbol=request.symbol,
        cutoff_timestamp=cutoff,
        as_of_price=state["as_of_price"],
        market_open=state["market_open"],
        candles_history_count=len(state["past_df"]),
        current_indicators=cur_indicators,
        forecast=forecast_response,
        news_headlines_at_cutoff=[
            f"RBI Policy review maintains stance on domestic market liquidity for {request.symbol}",
            "Global equity cues steady ahead of inflation release",
        ],
        economic_events_at_cutoff=["Interest Rate Decision: Unchanged", "CPI Release: Within Target"],
        realized_price=eval_result["realized_price"],
        realized_return_pct=eval_result["realized_return_pct"],
        realized_direction=eval_result["realized_direction"],
        is_correct=is_correct,
        evaluation_status=eval_result["evaluation_status"],
    )
