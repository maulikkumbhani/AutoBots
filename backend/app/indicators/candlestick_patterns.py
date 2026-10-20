from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np


class CandlestickPatternDetector:
    """
    Open-source algorithmic Candlestick Pattern & Shape Recognition Engine.
    Detects single-bar, two-bar, and three-bar price action reversal & continuation patterns.
    Guaranteed zero future look-ahead bias.
    """

    @staticmethod
    def detect_patterns(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Analyzes the recent candles and identifies active candlestick shapes & patterns.
        Returns a list of detected patterns with direction, confidence, and description.
        """
        if df.empty or len(df) < 3:
            return []

        patterns: List[Dict[str, Any]] = []

        # Current bar (i), previous bar (i-1), and two bars ago (i-2)
        curr = df.iloc[-1]
        prev = df.iloc[-2]
        prev2 = df.iloc[-3] if len(df) >= 3 else None

        o, h, l, c = float(curr["open"]), float(curr["high"]), float(curr["low"]), float(curr["close"])
        p_o, p_h, p_l, p_c = float(prev["open"]), float(prev["high"]), float(prev["low"]), float(prev["close"])

        body = abs(c - o)
        candle_range = max(h - l, 1e-6)
        upper_wick = h - max(o, c)
        lower_wick = min(o, c) - l

        prev_body = abs(p_c - p_o)
        prev_range = max(p_h - p_l, 1e-6)

        is_bullish = c > o
        is_bearish = c < o
        p_is_bullish = p_c > p_o
        p_is_bearish = p_c < p_o

        # 1. Bullish Engulfing
        if p_is_bearish and is_bullish and c >= p_o and o <= p_c and body > prev_body:
            patterns.append({
                "name": "Bullish Engulfing",
                "direction": "BULLISH",
                "confidence": 0.85,
                "type": "TWO_BAR_REVERSAL",
                "signal_strength": "STRONG",
                "description": f"Green candle body ({body:.2f}) fully engulfed previous red candle body ({prev_body:.2f}), signaling aggressive institutional buying demand.",
            })

        # 2. Bearish Engulfing
        if p_is_bullish and is_bearish and c <= p_o and o >= p_c and body > prev_body:
            patterns.append({
                "name": "Bearish Engulfing",
                "direction": "BEARISH",
                "confidence": 0.85,
                "type": "TWO_BAR_REVERSAL",
                "signal_strength": "STRONG",
                "description": f"Red candle body ({body:.2f}) fully engulfed previous green candle body ({prev_body:.2f}), signaling heavy institutional selling distribution.",
            })

        # 3. Hammer / Bullish Pin Bar
        if lower_wick >= (2.0 * body) and upper_wick <= (0.25 * candle_range) and body > 0:
            patterns.append({
                "name": "Hammer (Bullish Pin Bar)",
                "direction": "BULLISH",
                "confidence": 0.82,
                "type": "SINGLE_BAR_REVERSAL",
                "signal_strength": "HIGH",
                "description": f"Long lower shadow ({lower_wick:.2f}) rejected intraday lows with closing near the top of the range, confirming strong buyer defense.",
            })

        # 4. Shooting Star / Bearish Pin Bar
        if upper_wick >= (2.0 * body) and lower_wick <= (0.25 * candle_range) and body > 0:
            patterns.append({
                "name": "Shooting Star (Bearish Pin Bar)",
                "direction": "BEARISH",
                "confidence": 0.82,
                "type": "SINGLE_BAR_REVERSAL",
                "signal_strength": "HIGH",
                "description": f"Long upper shadow ({upper_wick:.2f}) rejected intraday highs with closing near the session lows, confirming sellers overpowering buyers.",
            })

        # 5. Morning Star (Three-Bar Bullish Reversal)
        if prev2 is not None:
            p2_o, p2_c = float(prev2["open"]), float(prev2["close"])
            p2_is_bearish = p2_c < p2_o
            p2_body = abs(p2_c - p2_o)

            if p2_is_bearish and prev_body < (p2_body * 0.4) and is_bullish and c > (p2_o + p2_c) / 2.0:
                patterns.append({
                    "name": "Morning Star Pattern",
                    "direction": "BULLISH",
                    "confidence": 0.90,
                    "type": "THREE_BAR_REVERSAL",
                    "signal_strength": "VERY_STRONG",
                    "description": "3-bar sequence: Large bearish candle, small indecision star bar, followed by a strong bullish breakout recovering over 50% of losses.",
                })

            # 6. Evening Star (Three-Bar Bearish Reversal)
            p2_is_bullish = p2_c > p2_o
            if p2_is_bullish and prev_body < (p2_body * 0.4) and is_bearish and c < (p2_o + p2_c) / 2.0:
                patterns.append({
                    "name": "Evening Star Pattern",
                    "direction": "BEARISH",
                    "confidence": 0.90,
                    "type": "THREE_BAR_REVERSAL",
                    "signal_strength": "VERY_STRONG",
                    "description": "3-bar sequence: Large bullish candle, small indecision star bar, followed by a sharp bearish reversal penetrating deep into the prior rally.",
                })

        # 7. Inside Bar (Volatility Squeeze)
        if h <= p_h and l >= p_l:
            patterns.append({
                "name": "Inside Bar (Volatility Squeeze)",
                "direction": "NEUTRAL",
                "confidence": 0.70,
                "type": "BREAKOUT_SETUP",
                "signal_strength": "MODERATE",
                "description": "Current candle is completely contained within the high/low of the previous bar, indicating range contraction before an explosive momentum breakout.",
            })

        # 8. Doji (Indecision Equilibrium)
        if body <= (candle_range * 0.12):
            if lower_wick > (0.6 * candle_range):
                doji_type = "Dragonfly Doji (Bullish Rejection)"
                dir_val = "BULLISH"
                conf = 0.76
            elif upper_wick > (0.6 * candle_range):
                doji_type = "Gravestone Doji (Bearish Rejection)"
                dir_val = "BEARISH"
                conf = 0.76
            else:
                doji_type = "Standard Neutral Doji"
                dir_val = "NEUTRAL"
                conf = 0.65

            patterns.append({
                "name": doji_type,
                "direction": dir_val,
                "confidence": conf,
                "type": "EQUILIBRIUM",
                "signal_strength": "MODERATE",
                "description": f"Extremely thin real body ({body:.2f}) indicates market indecision and temporary pause between buyers and sellers.",
            })

        # 9. Bullish Marubozu (Strong Momentum Bar)
        if is_bullish and body >= (0.85 * candle_range) and body > (prev_body * 1.5):
            patterns.append({
                "name": "Bullish Marubozu",
                "direction": "BULLISH",
                "confidence": 0.88,
                "type": "MOMENTUM_EXPANSION",
                "signal_strength": "VERY_STRONG",
                "description": "Full-bodied green candle with almost non-existent wicks, indicating unidirectional institutional buying momentum from open to close.",
            })

        # 10. Bearish Marubozu (Strong Distribution Bar)
        if is_bearish and body >= (0.85 * candle_range) and body > (prev_body * 1.5):
            patterns.append({
                "name": "Bearish Marubozu",
                "direction": "BEARISH",
                "confidence": 0.88,
                "type": "MOMENTUM_EXPANSION",
                "signal_strength": "VERY_STRONG",
                "description": "Full-bodied red candle with almost non-existent wicks, indicating unidirectional institutional liquidation from open to close.",
            })

        return patterns
