from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from app.prediction.base import BasePredictionModel


class MLBaselineModel(BasePredictionModel):
    """
    Supervised Machine Learning classifier (RandomForest / Gradient Boosting).
    Trains exclusively on point-in-time historical data preceding the cutoff.
    Zero data leakage or future normalization bias.
    """

    def __init__(self, name: str = "ML-RandomForest-Classifier", version: str = "1.0.0"):
        self.name = name
        self.version = version

    def get_model_name(self) -> str:
        return self.name

    def get_model_version(self) -> str:
        return self.version

    def _extract_features(self, df: pd.DataFrame) -> pd.DataFrame:
        features = pd.DataFrame(index=df.index)
        close = df["close"]
        vol = df["volume"]
        atr = df.get("atr_14", close * 0.005)

        features["ret_1"] = close.pct_change(1)
        features["ret_3"] = close.pct_change(3)
        features["ret_5"] = close.pct_change(5)
        features["ret_10"] = close.pct_change(10)
        
        # Indicator based features
        features["rsi"] = (df.get("rsi_14", 50.0) - 50.0) / 50.0
        features["dist_ema20"] = (close - df.get("ema_20", close)) / np.maximum(atr, 1e-4)
        features["dist_ema50"] = (close - df.get("ema_50", close)) / np.maximum(atr, 1e-4)
        features["macd_hist_atr"] = df.get("macd_hist", 0.0) / np.maximum(atr, 1e-4)
        
        vol_sma = df.get("vol_sma_20", vol)
        features["vol_ratio"] = vol / np.maximum(vol_sma, 1.0)
        return features.fillna(0.0)

    async def predict(
        self,
        symbol: str,
        past_df: pd.DataFrame,
        horizon: str = "60m",
        market_context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        if past_df.empty or len(past_df) < 40:
            return {
                "instrument": symbol,
                "as_of": str(past_df.iloc[-1]["timestamp"]) if not past_df.empty else "",
                "horizon": horizon,
                "direction": "uncertain",
                "probabilities": {"up": 0.33, "down": 0.33, "sideways": 0.34},
                "expected_return": 0.0,
                "predicted_range": {"lower": None, "upper": None},
                "supporting_factors": [],
                "conflicting_factors": [],
                "risk_factors": ["Insufficient training samples (<40 bars)"],
                "data_quality": "insufficient",
                "model_version": f"{self.name}:{self.version}",
            }

        # Build training set strictly from historical past_df
        feat_df = self._extract_features(past_df)
        
        # Target: 3 classes: 0 = Down (<-0.15%), 1 = Sideways, 2 = Up (>0.15%)
        # Shift -4 bars (1-hour ahead on 15m candles)
        forward_returns = past_df["close"].pct_change(4).shift(-4) * 100.0
        
        # Valid training rows: must drop last 4 bars where forward return is unknown at cutoff!
        valid_mask = forward_returns.notna()
        X_train = feat_df[valid_mask]
        y_raw = forward_returns[valid_mask]

        if len(X_train) < 25:
            # Fallback to statistical if training sample is too small
            return {
                "instrument": symbol,
                "as_of": str(past_df.iloc[-1]["timestamp"]),
                "horizon": horizon,
                "direction": "uncertain",
                "probabilities": {"up": 0.33, "down": 0.33, "sideways": 0.34},
                "expected_return": 0.0,
                "predicted_range": {"lower": None, "upper": None},
                "supporting_factors": [],
                "conflicting_factors": [],
                "risk_factors": ["Point-in-time training sample too small (<25 valid rows)"],
                "data_quality": "limited",
                "model_version": f"{self.name}:{self.version}",
            }

        neutral_band = 0.15
        y_train = np.where(y_raw > neutral_band, 2, np.where(y_raw < -neutral_band, 0, 1))

        # Train model strictly on historical rows
        model = RandomForestClassifier(n_estimators=35, max_depth=4, random_state=42)
        model.fit(X_train, y_train)

        # Predict on latest row (as of cutoff)
        X_latest = feat_df.iloc[[-1]]
        probs = model.predict_proba(X_latest)[0]

        # Map classes correctly
        classes = list(model.classes_)
        prob_down = float(probs[classes.index(0)]) if 0 in classes else 0.1
        prob_side = float(probs[classes.index(1)]) if 1 in classes else 0.1
        prob_up = float(probs[classes.index(2)]) if 2 in classes else 0.1

        # Re-normalize
        total = prob_down + prob_side + prob_up
        prob_down, prob_side, prob_up = (
            round(prob_down / total, 3),
            round(prob_side / total, 3),
            round(prob_up / total, 3),
        )

        close = float(past_df.iloc[-1]["close"])
        atr = float(past_df.iloc[-1].get("atr_14", close * 0.005))
        
        supporting = []
        conflicting = []
        risks = [f"Model trained on {len(X_train)} historical point-in-time observations"]

        if prob_up > 0.40 and prob_up > prob_down:
            direction = "up"
            supporting.append(f"RandomForest classifier assigned highest probability ({prob_up:.1%}) to upward class")
            exp_ret = round((prob_up - prob_down) * (atr / close) * 100.0, 2)
            lower_b = round(close - atr * 0.8, 2)
            upper_b = round(close + atr * 1.4, 2)
        elif prob_down > 0.40 and prob_down > prob_up:
            direction = "down"
            supporting.append(f"RandomForest classifier assigned highest probability ({prob_down:.1%}) to downward class")
            exp_ret = round((prob_up - prob_down) * (atr / close) * 100.0, 2)
            lower_b = round(close - atr * 1.4, 2)
            upper_b = round(close + atr * 0.8, 2)
        else:
            direction = "sideways"
            conflicting.append(f"Model probabilities are distributed without strong directional edge (Sideways: {prob_side:.1%})")
            exp_ret = 0.0
            lower_b = round(close - atr, 2)
            upper_b = round(close + atr, 2)

        return {
            "instrument": symbol,
            "as_of": str(past_df.iloc[-1]["timestamp"]),
            "horizon": horizon,
            "direction": direction,
            "probabilities": {
                "up": prob_up,
                "down": prob_down,
                "sideways": prob_side,
            },
            "expected_return": exp_ret,
            "predicted_range": {"lower": lower_b, "upper": upper_b},
            "supporting_factors": supporting,
            "conflicting_factors": conflicting,
            "risk_factors": risks,
            "data_quality": "good",
            "model_version": f"{self.name}:{self.version}",
        }
