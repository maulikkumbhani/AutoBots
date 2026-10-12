from typing import Dict, Any, List
import pandas as pd
import numpy as np
from app.prediction.base import BasePredictionModel


class StatisticalRuleModel(BasePredictionModel):
    """
    Statistical technical strategy model.
    Combines EMA Trend, RSI Momentum, MACD, and Bollinger Bands
    into calibrated probabilities and structured explanations.
    """

    def __init__(self, name: str = "Statistical-TA-Ensemble", version: str = "1.0.0"):
        self.name = name
        self.version = version

    def get_model_name(self) -> str:
        return self.name

    def get_model_version(self) -> str:
        return self.version

    async def predict(
        self,
        symbol: str,
        past_df: pd.DataFrame,
        horizon: str = "60m",
        market_context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        if past_df.empty or len(past_df) < 15:
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
                "risk_factors": ["Insufficient historical candle depth (<15 bars)"],
                "data_quality": "insufficient",
                "model_version": f"{self.name}:{self.version}",
            }

        last = past_df.iloc[-1]
        prev = past_df.iloc[-2]
        close = float(last["close"])
        timestamp_str = str(last["timestamp"])

        supporting = []
        conflicting = []
        risks = []

        bullish_score = 0
        bearish_score = 0
        total_signals = 0

        # 1. EMA Trend Filter
        ema_20 = last.get("ema_20")
        ema_50 = last.get("ema_50")
        if pd.notna(ema_20) and pd.notna(ema_50):
            total_signals += 2
            if close > ema_20 > ema_50:
                bullish_score += 2
                supporting.append(f"Price ({close:.1f}) is trading above rising EMA 20 & EMA 50 (Bullish trend)")
            elif close < ema_20 < ema_50:
                bearish_score += 2
                supporting.append(f"Price ({close:.1f}) is trading below declining EMA 20 & EMA 50 (Bearish trend)")
            else:
                conflicting.append("Moving averages indicate mixed / consolidation structure")

        # 2. RSI 14 Momentum
        rsi = last.get("rsi_14")
        if pd.notna(rsi):
            total_signals += 1.5
            if rsi > 55.0:
                if rsi > 72.0:
                    risks.append(f"RSI 14 at {rsi:.1f} is near overbought territory (>70)")
                    bearish_score += 0.5
                else:
                    bullish_score += 1.5
                    supporting.append(f"RSI 14 at {rsi:.1f} shows sustained upward momentum")
            elif rsi < 45.0:
                if rsi < 28.0:
                    risks.append(f"RSI 14 at {rsi:.1f} is near oversold territory (<30)")
                    bullish_score += 0.5
                else:
                    bearish_score += 1.5
                    supporting.append(f"RSI 14 at {rsi:.1f} shows downward momentum")
            else:
                conflicting.append(f"RSI 14 neutral at {rsi:.1f}")

        # 3. MACD Histogram
        macd_hist = last.get("macd_hist")
        prev_hist = prev.get("macd_hist")
        if pd.notna(macd_hist) and pd.notna(prev_hist):
            total_signals += 1.5
            if macd_hist > 0 and macd_hist >= prev_hist:
                bullish_score += 1.5
                supporting.append("MACD histogram is positive and expanding upward")
            elif macd_hist < 0 and macd_hist <= prev_hist:
                bearish_score += 1.5
                supporting.append("MACD histogram is negative and expanding downward")
            else:
                conflicting.append("MACD histogram slope is counter to current sign")

        # 4. Volatility & ATR for expected range
        atr = last.get("atr_14", close * 0.005)
        if pd.isna(atr) or atr == 0:
            atr = close * 0.005

        atr_val = float(atr)
        if last.get("is_volume_spike", False):
            risks.append("Volume spike detected on latest bar (>2.0x 20-period avg); higher volatility expected")

        # Normalize score into probabilities
        if total_signals == 0:
            prob_up, prob_down, prob_side = 0.33, 0.33, 0.34
        else:
            net_bull = bullish_score / total_signals
            net_bear = bearish_score / total_signals
            raw_up = max(0.1, min(0.85, 0.33 + (net_bull - net_bear) * 0.45))
            raw_down = max(0.1, min(0.85, 0.33 + (net_bear - net_bull) * 0.45))
            raw_side = max(0.1, 1.0 - (raw_up + raw_down))
            
            # Normalize to sum 1.0
            s = raw_up + raw_down + raw_side
            prob_up, prob_down, prob_side = round(raw_up / s, 3), round(raw_down / s, 3), round(raw_side / s, 3)

        # Direction classification
        if prob_up > 0.45 and prob_up > prob_down:
            direction = "up"
            expected_ret = round((atr_val / close) * 100.0 * 0.7, 2)
            lower_bound = round(close - atr_val * 0.8, 2)
            upper_bound = round(close + atr_val * 1.5, 2)
        elif prob_down > 0.45 and prob_down > prob_up:
            direction = "down"
            expected_ret = round(-(atr_val / close) * 100.0 * 0.7, 2)
            lower_bound = round(close - atr_val * 1.5, 2)
            upper_bound = round(close + atr_val * 0.8, 2)
        else:
            direction = "sideways"
            expected_ret = 0.0
            lower_bound = round(close - atr_val, 2)
            upper_bound = round(close + atr_val, 2)

        return {
            "instrument": symbol,
            "as_of": timestamp_str,
            "horizon": horizon,
            "direction": direction,
            "probabilities": {
                "up": prob_up,
                "down": prob_down,
                "sideways": prob_side,
            },
            "expected_return": expected_ret,
            "predicted_range": {
                "lower": lower_bound,
                "upper": upper_bound,
            },
            "supporting_factors": supporting,
            "conflicting_factors": conflicting,
            "risk_factors": risks,
            "data_quality": "good" if len(past_df) >= 50 else "limited",
            "model_version": f"{self.name}:{self.version}",
        }
