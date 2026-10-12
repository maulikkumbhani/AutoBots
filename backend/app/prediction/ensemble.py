from typing import Dict, Any, List
import pandas as pd
from app.prediction.base import BasePredictionModel
from app.prediction.statistical import StatisticalRuleModel
from app.prediction.ml_baseline import MLBaselineModel
from app.prediction.gemini_reasoner import GeminiFlashReasoner


class EnsemblePredictionModel(BasePredictionModel):
    """
    Ensemble model combining Statistical TA, ML Random Forest,
    and Gemini Flash reasoning into an integrated calibrated consensus.
    """

    def __init__(self):
        self.stat_model = StatisticalRuleModel()
        self.ml_model = MLBaselineModel()
        self.gemini_model = GeminiFlashReasoner()

    def get_model_name(self) -> str:
        return "Calibrated-Multi-Strategy-Ensemble"

    def get_model_version(self) -> str:
        return "ensemble-v1.0"

    async def predict(
        self,
        symbol: str,
        past_df: pd.DataFrame,
        horizon: str = "60m",
        market_context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        # Collect component predictions
        stat_res = await self.stat_model.predict(symbol, past_df, horizon, market_context)
        ml_res = await self.ml_model.predict(symbol, past_df, horizon, market_context)
        gemini_res = await self.gemini_model.predict(symbol, past_df, horizon, market_context)

        # Weighted probabilities: 40% Stat, 35% ML, 25% Gemini
        w_stat, w_ml, w_gem = 0.40, 0.35, 0.25
        
        up = (
            stat_res["probabilities"]["up"] * w_stat
            + ml_res["probabilities"]["up"] * w_ml
            + gemini_res["probabilities"]["up"] * w_gem
        )
        down = (
            stat_res["probabilities"]["down"] * w_stat
            + ml_res["probabilities"]["down"] * w_ml
            + gemini_res["probabilities"]["down"] * w_gem
        )
        side = (
            stat_res["probabilities"]["sideways"] * w_stat
            + ml_res["probabilities"]["sideways"] * w_ml
            + gemini_res["probabilities"]["sideways"] * w_gem
        )

        total = up + down + side
        up, down, side = round(up / total, 3), round(down / total, 3), round(side / total, 3)

        # Aggregate factors
        supporting = list(dict.fromkeys(
            stat_res["supporting_factors"] + ml_res["supporting_factors"] + gemini_res["supporting_factors"]
        ))
        conflicting = list(dict.fromkeys(
            stat_res["conflicting_factors"] + ml_res["conflicting_factors"] + gemini_res["conflicting_factors"]
        ))
        risks = list(dict.fromkeys(
            stat_res["risk_factors"] + ml_res["risk_factors"] + gemini_res["risk_factors"]
        ))

        # Check for model disagreement
        dirs = [stat_res["direction"], ml_res["direction"], gemini_res["direction"]]
        if len(set(dirs)) > 2:
            conflicting.append(f"Model disagreement detected: Stat={dirs[0]}, ML={dirs[1]}, Gemini={dirs[2]}")

        # Direction
        if up > 0.42 and up > down:
            direction = "up"
        elif down > 0.42 and down > up:
            direction = "down"
        elif max(up, down) < 0.40 or len(set(dirs)) > 2:
            direction = "sideways"
        else:
            direction = "uncertain"

        # Expected return & range
        exp_rets = [r for r in [stat_res.get("expected_return"), ml_res.get("expected_return")] if r is not None]
        avg_exp_ret = round(sum(exp_rets) / len(exp_rets), 2) if exp_rets else 0.0

        lowers = [r["predicted_range"]["lower"] for r in [stat_res, ml_res, gemini_res] if r["predicted_range"].get("lower")]
        uppers = [r["predicted_range"]["upper"] for r in [stat_res, ml_res, gemini_res] if r["predicted_range"].get("upper")]

        return {
            "instrument": symbol,
            "as_of": stat_res["as_of"],
            "horizon": horizon,
            "direction": direction,
            "probabilities": {
                "up": up,
                "down": down,
                "sideways": side,
            },
            "expected_return": avg_exp_ret,
            "predicted_range": {
                "lower": min(lowers) if lowers else None,
                "upper": max(uppers) if uppers else None,
            },
            "supporting_factors": supporting,
            "conflicting_factors": conflicting,
            "risk_factors": risks,
            "data_quality": stat_res.get("data_quality", "good"),
            "model_version": self.get_model_version(),
        }
