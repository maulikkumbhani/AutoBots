from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
import pytz

from app.schemas.prediction import ForecastCreateRequest, ForecastResponse, DirectionalProbabilities
from app.data.mock import MockDataProvider
from app.data.yahoo import YahooFinanceProvider
from app.replay.engine import HistoricalReplayEngine
from app.prediction.ensemble import EnsemblePredictionModel
from app.prediction.statistical import StatisticalRuleModel
from app.prediction.ml_baseline import MLBaselineModel
from app.prediction.gemini_reasoner import GeminiFlashReasoner

router = APIRouter(prefix="/predictions", tags=["Predictions"])

mock_provider = MockDataProvider()
yahoo_provider = YahooFinanceProvider()

models = {
    "STATISTICAL": StatisticalRuleModel(),
    "ML_BASELINE": MLBaselineModel(),
    "GEMINI_FLASH": GeminiFlashReasoner(),
    "ENSEMBLE": EnsemblePredictionModel(),
}

# In-memory store for demonstrations/session
PREDICTIONS_LOG: List[dict] = []


@router.post("/generate", response_model=ForecastResponse)
async def generate_prediction(req: ForecastCreateRequest):
    """Generates and logs an immutable forecast."""
    cutoff = req.cutoff_timestamp
    if cutoff.tzinfo is None:
        cutoff = pytz.UTC.localize(cutoff)

    replay_engine = HistoricalReplayEngine(data_provider=yahoo_provider)
    state = await replay_engine.reconstruct_market_state(req.symbol, cutoff)
    if state["past_df"].empty:
        replay_engine = HistoricalReplayEngine(data_provider=mock_provider)
        state = await replay_engine.reconstruct_market_state(req.symbol, cutoff)

    if state["as_of_price"] is None:
        raise HTTPException(status_code=400, detail="Cannot fetch market data")

    model = models.get(req.model_type.upper(), models["ENSEMBLE"])
    pred = await model.predict(req.symbol, state["past_df"], req.horizon)

    forecast_id = len(PREDICTIONS_LOG) + 1
    resp = ForecastResponse(
        id=forecast_id,
        instrument_symbol=req.symbol,
        model_name=model.get_model_name(),
        cutoff_timestamp=cutoff,
        as_of_price=state["as_of_price"],
        horizon=req.horizon,
        direction=pred["direction"],
        probabilities=DirectionalProbabilities(**pred["probabilities"]),
        expected_return_pct=pred.get("expected_return"),
        predicted_range_lower=pred["predicted_range"].get("lower"),
        predicted_range_upper=pred["predicted_range"].get("upper"),
        supporting_factors=pred.get("supporting_factors", []),
        conflicting_factors=pred.get("conflicting_factors", []),
        risk_factors=pred.get("risk_factors", []),
        data_quality=pred.get("data_quality", "good"),
        created_at=datetime.now(pytz.UTC),
        evaluation_status="PENDING",
    )
    PREDICTIONS_LOG.append(resp.model_dump())
    return resp


@router.get("/history", response_model=List[ForecastResponse])
async def get_history(symbol: Optional[str] = None):
    """Retrieves immutable forecast history."""
    if symbol:
        return [p for p in PREDICTIONS_LOG if p["instrument_symbol"] == symbol]
    return PREDICTIONS_LOG
