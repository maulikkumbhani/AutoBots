from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
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
from app.prediction.custom_adaptive_model import CustomAdaptiveQuantModel
from app.indicators.candlestick_patterns import CandlestickPatternDetector

router = APIRouter(prefix="/predictions", tags=["Predictions"])

mock_provider = MockDataProvider()
yahoo_provider = YahooFinanceProvider()
from app.prediction.high_volume_scalper import HighVolumeMicroScalper

custom_quant_model = CustomAdaptiveQuantModel()
high_volume_scalper = HighVolumeMicroScalper()

models = {
    "HIGH_VOLUME_SCALPER": high_volume_scalper,
    "STATISTICAL": StatisticalRuleModel(),
    "ML_BASELINE": MLBaselineModel(),
    "GEMINI_FLASH": GeminiFlashReasoner(),
    "ENSEMBLE": EnsemblePredictionModel(),
    "CUSTOM_QUANT": custom_quant_model,
}

# In-memory store for demonstrations/session
PREDICTIONS_LOG: List[dict] = []


def calculate_target_timeline_and_velocity(
    past_df,
    as_of_price: float,
    target_price: float,
    horizon: str,
    base_time: Optional[datetime] = None
) -> Dict[str, Any]:
    from datetime import timedelta
    if base_time is None:
        base_time = datetime.now(pytz.UTC)
    elif base_time.tzinfo is None:
        base_time = pytz.UTC.localize(base_time)

    # Standard horizon to nominal seconds mapping
    horizon_sec_map = {
        "1m": 60,
        "5m": 300,
        "10m": 600,
        "15m": 900,
        "30m": 1800,
        "60m": 3600,
        "1d": 21600,
    }
    max_horizon_sec = horizon_sec_map.get(horizon, 600)

    dist = abs(target_price - as_of_price)
    
    # Calculate ATR and candle cadence from past_df if available
    candle_sec = 60
    atr = None
    if past_df is not None and not past_df.empty and len(past_df) >= 3:
        try:
            if "timestamp" in past_df.columns:
                t_diff = (past_df["timestamp"].iloc[-1] - past_df["timestamp"].iloc[-2]).total_seconds()
                if 5 <= t_diff <= 86400:
                    candle_sec = int(t_diff)
            
            high = past_df["high"]
            low = past_df["low"]
            close = past_df["close"]
            prev_close = close.shift(1)
            tr1 = high - low
            tr2 = (high - prev_close).abs()
            tr3 = (low - prev_close).abs()
            tr = tr1.combine(tr2, max).combine(tr3, max)
            atr_val = float(tr.tail(14).mean())
            if atr_val > 0:
                atr = atr_val
        except Exception:
            pass

    if atr is None or atr <= 0:
        # Default ATR: 0.12% of as_of_price per 5 minutes
        atr = max(as_of_price * 0.0012, 0.05)
        candle_sec = 300

    # Base velocity: points per second
    base_velocity = atr / max(candle_sec, 15)

    # Momentum modifier from recent price slope
    momentum_mult = 1.0
    if past_df is not None and len(past_df) >= 5:
        try:
            recent_ret = (past_df["close"].iloc[-1] - past_df["close"].iloc[-5]) / past_df["close"].iloc[-5]
            if target_price > as_of_price and recent_ret > 0:
                momentum_mult = 1.25
            elif target_price < as_of_price and recent_ret < 0:
                momentum_mult = 1.25
            elif (target_price > as_of_price and recent_ret < 0) or (target_price < as_of_price and recent_ret > 0):
                momentum_mult = 0.85
        except Exception:
            pass

    effective_velocity = max(base_velocity * momentum_mult, 0.0001)

    # Seconds to hit
    if dist <= 0.00001:
        est_seconds = 0
    else:
        raw_seconds = dist / effective_velocity
        min_sec = max(15, min(45, max_horizon_sec // 4))
        max_sec = int(max_horizon_sec * 1.15)
        est_seconds = int(max(min_sec, min(raw_seconds, max_sec)))

    est_hit_time = base_time + timedelta(seconds=est_seconds)

    return {
        "estimated_target_hit_time": est_hit_time,
        "estimated_seconds_to_hit": est_seconds,
        "price_velocity_pts_per_sec": round(effective_velocity, 4),
    }


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

    as_of = state["as_of_price"]
    direction = pred["direction"]
    exp_ret = pred.get("expected_return") or 0.35

    precision = 4 if ("GBP" in req.symbol or "EUR" in req.symbol) else 2
    if direction == "up":
        target_price = round(as_of * (1.0 + abs(exp_ret) / 100.0), precision)
        stop_loss = round(as_of * (1.0 - (abs(exp_ret) / 2.0) / 100.0), precision)
    elif direction == "down":
        target_price = round(as_of * (1.0 - abs(exp_ret) / 100.0), precision)
        stop_loss = round(as_of * (1.0 + (abs(exp_ret) / 2.0) / 100.0), precision)
    else:
        target_price = round(as_of, precision)
        stop_loss = round(as_of * 0.998, precision)

    timing = calculate_target_timeline_and_velocity(state["past_df"], as_of, target_price, req.horizon, cutoff)

    forecast_id = len(PREDICTIONS_LOG) + 1
    resp = ForecastResponse(
        id=forecast_id,
        instrument_symbol=req.symbol,
        model_name=model.get_model_name(),
        cutoff_timestamp=cutoff,
        as_of_price=as_of,
        horizon=req.horizon,
        direction=direction,
        probabilities=DirectionalProbabilities(**pred["probabilities"]),
        expected_return_pct=exp_ret,
        predicted_range_lower=pred["predicted_range"].get("lower"),
        predicted_range_upper=pred["predicted_range"].get("upper"),
        supporting_factors=pred.get("supporting_factors", []),
        conflicting_factors=pred.get("conflicting_factors", []),
        risk_factors=pred.get("risk_factors", []),
        data_quality=pred.get("data_quality", "good"),
        created_at=datetime.now(pytz.UTC),
        evaluation_status="ACTIVE",
        target_price=target_price,
        stop_loss=stop_loss,
        estimated_target_hit_time=timing["estimated_target_hit_time"],
        estimated_seconds_to_hit=timing["estimated_seconds_to_hit"],
        price_velocity_pts_per_sec=timing["price_velocity_pts_per_sec"],
    )
    PREDICTIONS_LOG.append(resp.model_dump())
    return resp


@router.get("/history", response_model=List[ForecastResponse])
async def get_history(symbol: Optional[str] = None):
    """Retrieves immutable forecast history."""
    if symbol:
        return [p for p in PREDICTIONS_LOG if p["instrument_symbol"] == symbol]
    return PREDICTIONS_LOG


@router.get("/records")
async def get_prediction_records(symbol: str = "NIFTY 50"):
    """
    Evaluates recorded 5m/10m/15m/60m trade predictions against current market prices.
    Returns live scorecard (Total, Wins, Losses, Win Rate %) and visual chart signal markers.
    """
    from datetime import timezone, timedelta
    from app.execution.bot_runner import trading_bot

    now = datetime.now(timezone.utc)
    cur_p = trading_bot.live_prices.get(symbol)
    if not cur_p or cur_p <= 0:
        quote = await mock_provider.fetch_latest_quote(symbol)
        cur_p = quote["price"]

    # Filter predictions for this symbol
    records = [p for p in PREDICTIONS_LOG if p["instrument_symbol"] == symbol]

    # No dummy seed data - only real predictions evaluated
    if False and not records:
        precision = 4 if ("GBP" in symbol or "EUR" in symbol) else 2
        seeds = [
            {"mins_ago": 45, "dir": "up", "ret": 0.28, "success": True, "horizon": "10m"},
            {"mins_ago": 35, "dir": "up", "ret": 0.22, "success": True, "horizon": "5m"},
            {"mins_ago": 25, "dir": "down", "ret": -0.15, "success": False, "horizon": "10m"},
            {"mins_ago": 15, "dir": "up", "ret": 0.31, "success": True, "horizon": "15m"},
            {"mins_ago": 8, "dir": "up", "ret": 0.18, "success": True, "horizon": "5m"},
            {"mins_ago": 2, "dir": "up", "ret": 0.25, "success": None, "horizon": "10m"},
        ]
        for s in seeds:
            ts = now - timedelta(minutes=s["mins_ago"])
            base_p = round(cur_p * (1.0 - (s["ret"] / 100.0 if s["success"] else -0.001)), precision)
            tgt_p = round(base_p * (1.0 + (0.003 if s["dir"] == "up" else -0.003)), precision)
            sl_p = round(base_p * (1.0 - (0.0015 if s["dir"] == "up" else -0.0015)), precision)
            is_active = s["success"] is None
            timing = calculate_target_timeline_and_velocity(None, base_p, tgt_p, s["horizon"], ts)
            
            entry = {
                "id": len(PREDICTIONS_LOG) + 1,
                "instrument_symbol": symbol,
                "model_name": "Calibrated-Multi-Strategy-Ensemble",
                "cutoff_timestamp": ts,
                "as_of_price": base_p,
                "horizon": s["horizon"],
                "direction": s["dir"],
                "probabilities": {"up": 0.72 if s["dir"] == "up" else 0.20, "down": 0.18 if s["dir"] == "up" else 0.68, "sideways": 0.10},
                "expected_return_pct": round(abs(s["ret"]), 2),
                "predicted_range_lower": round(base_p * 0.997, precision),
                "predicted_range_upper": round(base_p * 1.003, precision),
                "supporting_factors": ["EMA 9/20 bullish alignment", "MACD positive expansion", "RSI neutral rebound"],
                "conflicting_factors": [],
                "risk_factors": ["Intraday resistance test"],
                "data_quality": "good",
                "created_at": ts,
                "evaluation_status": "ACTIVE" if is_active else ("SUCCESS" if s["success"] else "FAILED"),
                "realized_price": cur_p if not is_active else None,
                "realized_return_pct": s["ret"] if not is_active else None,
                "is_correct": s["success"],
                "target_price": tgt_p,
                "stop_loss": sl_p,
                "estimated_target_hit_time": timing["estimated_target_hit_time"],
                "estimated_seconds_to_hit": timing["estimated_seconds_to_hit"],
                "price_velocity_pts_per_sec": timing["price_velocity_pts_per_sec"],
            }
            PREDICTIONS_LOG.append(entry)
        records = [p for p in PREDICTIONS_LOG if p["instrument_symbol"] == symbol]

    # Evaluate any pending records against cur_p
    for p in records:
        if p.get("evaluation_status") == "ACTIVE" and p.get("is_correct") is None:
            as_of = p["as_of_price"]
            tgt = p.get("target_price", as_of)
            sl = p.get("stop_loss", as_of)
            dir_str = p["direction"]

            created = p["created_at"]
            if hasattr(created, "tzinfo") and created.tzinfo is None:
                created = pytz.UTC.localize(created)
            
            elapsed_sec = (now - created).total_seconds()
            horizon_sec = {"5m": 300, "10m": 600, "15m": 900, "30m": 1800, "60m": 3600}.get(p.get("horizon", "10m"), 600)

            if dir_str == "up":
                if cur_p >= tgt:
                    p["evaluation_status"] = "SUCCESS"
                    p["is_correct"] = True
                    p["realized_price"] = cur_p
                    p["realized_return_pct"] = round(((cur_p - as_of) / as_of) * 100.0, 2)
                elif cur_p <= sl:
                    p["evaluation_status"] = "FAILED"
                    p["is_correct"] = False
                    p["realized_price"] = cur_p
                    p["realized_return_pct"] = round(((cur_p - as_of) / as_of) * 100.0, 2)
                elif elapsed_sec >= horizon_sec:
                    is_win = cur_p > as_of
                    p["evaluation_status"] = "SUCCESS" if is_win else "FAILED"
                    p["is_correct"] = is_win
                    p["realized_price"] = cur_p
                    p["realized_return_pct"] = round(((cur_p - as_of) / as_of) * 100.0, 2)
            elif dir_str == "down":
                if cur_p <= tgt:
                    p["evaluation_status"] = "SUCCESS"
                    p["is_correct"] = True
                    p["realized_price"] = cur_p
                    p["realized_return_pct"] = round(((as_of - cur_p) / as_of) * 100.0, 2)
                elif cur_p >= sl:
                    p["evaluation_status"] = "FAILED"
                    p["is_correct"] = False
                    p["realized_price"] = cur_p
                    p["realized_return_pct"] = round(((as_of - cur_p) / as_of) * 100.0, 2)
                elif elapsed_sec >= horizon_sec:
                    is_win = cur_p < as_of
                    p["evaluation_status"] = "SUCCESS" if is_win else "FAILED"
                    p["is_correct"] = is_win
                    p["realized_price"] = cur_p
                    p["realized_return_pct"] = round(((as_of - cur_p) / as_of) * 100.0, 2)

    # Compute scorecard
    resolved = [p for p in records if p.get("is_correct") is not None]
    successes = [p for p in resolved if p["is_correct"] is True]
    fails = [p for p in resolved if p["is_correct"] is False]
    active = [p for p in records if p.get("evaluation_status") == "ACTIVE"]

    win_rate = round((len(successes) / len(resolved) * 100.0), 1) if resolved else 0.0

    return {
        "symbol": symbol,
        "summary": {
            "total_predictions": len(records),
            "success_count": len(successes),
            "failed_count": len(fails),
            "active_count": len(active),
            "win_rate_pct": win_rate,
            "current_price": cur_p,
        },
        "records": records[::-1],  # newest first
    }


@router.get("/multi-model")
async def get_multi_model_analysis(symbol: str = "NIFTY 50", horizon: str = "10m"):
    """
    Runs multiple quantitative models and candlestick shape detector simultaneously on the active chart.
    Evaluates individual model targets, directional calls, confidence, and consensus voting.
    """
    now = datetime.now(timezone.utc)
    replay_engine = HistoricalReplayEngine(data_provider=yahoo_provider)
    state = await replay_engine.reconstruct_market_state(symbol, now)
    if state["past_df"].empty:
        replay_engine = HistoricalReplayEngine(data_provider=mock_provider)
        state = await replay_engine.reconstruct_market_state(symbol, now)

    as_of = state["as_of_price"] or 100.0
    past_df = state["past_df"]
    precision = 4 if ("GBP" in symbol or "EUR" in symbol) else 2

    # 1. Detect Candlestick Feature Patterns
    detected_patterns = CandlestickPatternDetector.detect_patterns(past_df)

    # 2. Run all individual quantitative models in parallel
    model_keys = [
        ("HIGH_VOLUME_SCALPER", "High-Volume Micro Scalper (Order Flow & Volume Imbalance)"),
        ("CUSTOM_QUANT", "Custom Adaptive Quant (100% Local Math, Self-Updating)"),
        ("ENSEMBLE", "Calibrated Multi-Strategy Consensus"),
        ("STATISTICAL", "Statistical Momentum & EMA/MACD/RSI Ribbon"),
        ("ML_BASELINE", "Random Forest Multi-Factor GBDT Classifier"),
    ]

    model_results: List[Dict[str, Any]] = []
    bullish_votes = 0
    bearish_votes = 0
    neutral_votes = 0

    for key, display_name in model_keys:
        m = models.get(key)
        if not m:
            continue
        try:
            pred = await m.predict(symbol, past_df, horizon)
            direction = pred["direction"]
            exp_ret = pred.get("expected_return") or 0.25

            if direction == "up":
                bullish_votes += 1
                target = round(as_of * (1.0 + abs(exp_ret) / 100.0), precision)
                sl = round(as_of * (1.0 - (abs(exp_ret) / 2.0) / 100.0), precision)
            elif direction == "down":
                bearish_votes += 1
                target = round(as_of * (1.0 - abs(exp_ret) / 100.0), precision)
                sl = round(as_of * (1.0 + (abs(exp_ret) / 2.0) / 100.0), precision)
            else:
                neutral_votes += 1
                target = round(as_of, precision)
                sl = round(as_of * 0.998, precision)

            m_timing = calculate_target_timeline_and_velocity(past_df, as_of, target, horizon, now)

            model_results.append({
                "model_key": key,
                "model_name": display_name,
                "direction": direction,
                "confidence_pct": round(max(pred["probabilities"]["up"], pred["probabilities"]["down"], pred["probabilities"]["sideways"]) * 100, 1),
                "probabilities": pred["probabilities"],
                "target_price": target,
                "stop_loss": sl,
                "expected_return_pct": exp_ret,
                "estimated_target_hit_time": m_timing["estimated_target_hit_time"].isoformat(),
                "estimated_seconds_to_hit": m_timing["estimated_seconds_to_hit"],
                "price_velocity_pts_per_sec": m_timing["price_velocity_pts_per_sec"],
                "supporting_factors": pred.get("supporting_factors", [])[:3],
                "risk_factors": pred.get("risk_factors", [])[:2],
                "model_version": pred.get("model_version", "v1.0"),
            })
        except Exception as e:
            continue

    total_models = max(1, len(model_results))
    agreement_pct = round((max(bullish_votes, bearish_votes) / total_models) * 100.0, 1)

    if bullish_votes > bearish_votes and bullish_votes >= 2:
        consensus_direction = "BULLISH"
        consensus_status = "STRONG_CONSENSUS" if agreement_pct >= 75 else "MODERATE_CONSENSUS"
    elif bearish_votes > bullish_votes and bearish_votes >= 2:
        consensus_direction = "BEARISH"
        consensus_status = "STRONG_CONSENSUS" if agreement_pct >= 75 else "MODERATE_CONSENSUS"
    else:
        consensus_direction = "NEUTRAL_DIVERGENCE"
        consensus_status = "DIVERGENCE_ALERT"

    # Consensus Target & SL
    targets = [m["target_price"] for m in model_results if m["target_price"] is not None]
    sls = [m["stop_loss"] for m in model_results if m["stop_loss"] is not None]

    consensus_target = round(sum(targets) / len(targets), precision) if targets else as_of
    consensus_sl = round(sum(sls) / len(sls), precision) if sls else as_of
    c_timing = calculate_target_timeline_and_velocity(past_df, as_of, consensus_target, horizon, now)

    return {
        "symbol": symbol,
        "as_of_price": as_of,
        "horizon": horizon,
        "consensus": {
            "direction": consensus_direction,
            "status": consensus_status,
            "agreement_pct": agreement_pct,
            "bullish_votes": bullish_votes,
            "bearish_votes": bearish_votes,
            "neutral_votes": neutral_votes,
            "total_models": total_models,
            "consensus_target": consensus_target,
            "consensus_stop_loss": consensus_sl,
            "consensus_target_hit_time": c_timing["estimated_target_hit_time"].isoformat(),
            "consensus_seconds_to_hit": c_timing["estimated_seconds_to_hit"],
            "consensus_velocity_pts_per_sec": c_timing["price_velocity_pts_per_sec"],
        },
        "detected_patterns": detected_patterns,
        "models": model_results,
        "custom_model_weights": custom_quant_model.get_weights_summary(),
    }


@router.post("/custom-model/train")
async def train_custom_model(symbol: str = "NIFTY 50", days_back: int = 30):
    """
    Rebuilds and calibrates the custom quantitative model factor weights on historical rolling data without external AI.
    """
    now = datetime.now(timezone.utc)
    replay_engine = HistoricalReplayEngine(data_provider=yahoo_provider)
    state = await replay_engine.reconstruct_market_state(symbol, now)
    if state["past_df"].empty:
        replay_engine = HistoricalReplayEngine(data_provider=mock_provider)
        state = await replay_engine.reconstruct_market_state(symbol, now)

    past_df = state["past_df"]
    result = custom_quant_model.retrain_on_historical(symbol, past_df)
    return result
