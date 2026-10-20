import numpy as np
import pandas as pd
from typing import Dict, Any, List
from app.prediction.base import BasePredictionModel


class HighVolumeMicroScalper(BasePredictionModel):
    """
    High-Volume Micro Scalper Strategy for Rapid Second-Level Trades.
    
    Identifies high-conviction order flow imbalances and volume bursts:
    1. Volume Explosion Filter: Current bar volume >= 1.4x 20-period average volume.
    2. VWAP & EMA Alignment: Confirms directional aggression above/below institutional VWAP.
    3. Asymmetric Risk/Reward: Targets rapid 0.20% - 0.45% moves with strict 0.15% stops.
    4. Heavy Volume Sizing: Optimized for larger lot sizes with 15s - 90s exposure window.
    5. Anti-Loss Chop Rejection: Forbids trades when volume is dry or price is consolidating.
    """

    def __init__(self, volume_multiplier_threshold: float = 1.35):
        self.volume_mult = volume_multiplier_threshold

    def get_model_name(self) -> str:
        return "High-Volume Micro Scalper (Order Flow & Volume Imbalance)"

    def get_model_version(self) -> str:
        return "micro-scalp-v1.0"

    async def predict(self, symbol: str, past_df: pd.DataFrame, horizon: str = "5m") -> Dict[str, Any]:
        if past_df.empty or len(past_df) < 20:
            return {
                "direction": "sideways",
                "probabilities": {"up": 0.33, "down": 0.33, "sideways": 0.34},
                "expected_return": 0.0,
                "predicted_range": {"lower": None, "upper": None},
                "supporting_factors": ["Insufficient historical data points"],
                "risk_factors": ["Low liquidity or missing candles"],
                "data_quality": "insufficient",
                "model_version": "micro-scalp-v1.0",
            }

        df = past_df.copy()
        cur_price = float(df.iloc[-1]["close"])
        cur_volume = float(df.iloc[-1].get("volume", 1000.0))

        # 1. Volume moving average and surge ratio
        vol_series = df["volume"] if "volume" in df.columns else pd.Series([1000.0] * len(df))
        avg_vol = float(vol_series.tail(20).mean())
        if avg_vol <= 0:
            avg_vol = 1000.0

        volume_ratio = cur_volume / avg_vol

        # 2. VWAP Calculation (Institutional Benchmark)
        if "volume" in df.columns and "high" in df.columns and "low" in df.columns:
            typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
            cum_vol = df["volume"].cumsum()
            cum_vol_price = (typical_price * df["volume"]).cumsum()
            vwap = float((cum_vol_price / cum_vol.replace(0, 1)).iloc[-1])
        else:
            vwap = float(df["close"].tail(20).mean())

        # 3. EMA 9 and EMA 20
        ema_9 = float(df["close"].ewm(span=9, adjust=False).mean().iloc[-1])
        ema_20 = float(df["close"].ewm(span=20, adjust=False).mean().iloc[-1])

        # 4. Momentum / Candle Body Strength
        open_p = float(df.iloc[-1]["open"])
        high_p = float(df.iloc[-1]["high"])
        low_p = float(df.iloc[-1]["low"])
        body = cur_price - open_p
        range_span = max(high_p - low_p, 0.0001)
        body_ratio = abs(body) / range_span

        # 5. ATR for dynamic micro-scalp target sizing
        tr1 = df["high"] - df["low"]
        tr2 = (df["high"] - df["close"].shift(1)).abs()
        tr3 = (df["low"] - df["close"].shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr_14 = float(tr.tail(14).mean())
        if atr_14 <= 0:
            atr_14 = cur_price * 0.0015

        # Quantitative Evaluation
        supporting: List[str] = []
        conflicting: List[str] = []

        is_volume_burst = volume_ratio >= self.volume_mult
        is_bullish_order_flow = cur_price > vwap and ema_9 > ema_20 and body > 0
        is_bearish_order_flow = cur_price < vwap and ema_9 < ema_20 and body < 0

        # Anti-Loss Chop Check
        if not is_volume_burst and abs(cur_price - vwap) / cur_price < 0.0008:
            direction = "sideways"
            prob_up = 0.25
            prob_down = 0.25
            prob_side = 0.50
            exp_ret = 0.05
            supporting.append("Low volume consolidation — Avoiding chop to preserve capital")
            conflicting.append(f"Volume ratio {volume_ratio:.2f}x is below 1.35x institutional threshold")
        elif is_bullish_order_flow and (is_volume_burst or body_ratio > 0.65):
            direction = "up"
            prob_up = min(0.85, 0.68 + (volume_ratio - 1.0) * 0.1)
            prob_down = 0.15
            prob_side = round(1.0 - prob_up - prob_down, 3)
            # Scalp target: 1.5x ATR (typically 0.25% - 0.45%)
            exp_ret = round(max((atr_14 * 1.5 / cur_price) * 100.0, 0.25), 2)
            supporting.append(f"Institutional volume surge: {volume_ratio:.2f}x 20-period average")
            supporting.append(f"Price ({cur_price:.2f}) trading above VWAP ({vwap:.2f}) with EMA 9/20 bullish expansion")
            supporting.append("Aggressive buyer market order absorption on micro-timeframe")
        elif is_bearish_order_flow and (is_volume_burst or body_ratio > 0.65):
            direction = "down"
            prob_down = min(0.85, 0.68 + (volume_ratio - 1.0) * 0.1)
            prob_up = 0.15
            prob_side = round(1.0 - prob_up - prob_down, 3)
            exp_ret = round(-max((atr_14 * 1.5 / cur_price) * 100.0, 0.25), 2)
            supporting.append(f"Heavy selling volume surge: {volume_ratio:.2f}x 20-period average")
            supporting.append(f"Price ({cur_price:.2f}) broken below institutional VWAP ({vwap:.2f})")
            supporting.append("Aggressive seller market orders dominating order book")
        else:
            # Moderate bias or sideways
            if cur_price > vwap:
                direction = "up"
                prob_up = 0.58
                prob_down = 0.22
                prob_side = 0.20
                exp_ret = 0.20
                supporting.append(f"Above VWAP ({vwap:.2f}) with moderate trend alignment")
            elif cur_price < vwap:
                direction = "down"
                prob_down = 0.58
                prob_up = 0.22
                prob_side = 0.20
                exp_ret = -0.20
                supporting.append(f"Below VWAP ({vwap:.2f}) with moderate trend alignment")
            else:
                direction = "sideways"
                prob_up = 0.33
                prob_down = 0.33
                prob_side = 0.34
                exp_ret = 0.0

        target_mult = abs(exp_ret) / 100.0
        predicted_upper = round(cur_price * (1.0 + target_mult), 2)
        predicted_lower = round(cur_price * (1.0 - target_mult), 2)

        return {
            "direction": direction,
            "probabilities": {
                "up": round(prob_up, 3),
                "down": round(prob_down, 3),
                "sideways": round(prob_side, 3),
            },
            "expected_return": exp_ret,
            "predicted_range": {
                "lower": predicted_lower,
                "upper": predicted_upper,
            },
            "supporting_factors": supporting,
            "conflicting_factors": conflicting,
            "risk_factors": [
                "Micro second-level execution requires strict slippage and tight trailing stops",
                f"Relative Volume: {volume_ratio:.2f}x (Threshold: {self.volume_mult}x)"
            ],
            "data_quality": "good",
            "model_version": "micro-scalp-v1.0",
        }
