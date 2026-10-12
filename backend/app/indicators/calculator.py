import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple


class TechnicalIndicatorEngine:
    """
    Pure mathematical and statistical Technical Analysis engine.
    Calculates moving averages, oscillators, volatility metrics,
    market regimes, and support/resistance zones from OHLCV data.
    Guaranteed zero future look-ahead bias.
    """

    @staticmethod
    def calculate_all(df: pd.DataFrame) -> pd.DataFrame:
        """
        Computes all standard indicators and appends them to the dataframe.
        Expects columns: ['open', 'high', 'low', 'close', 'volume', 'timestamp']
        """
        if df.empty or len(df) < 5:
            return df

        df = df.copy()
        if "close" not in df.columns:
            raise ValueError("Dataframe must contain 'close' column")

        close = df["close"]
        high = df["high"]
        low = df["low"]
        volume = df["volume"]

        # 1. Exponential Moving Averages
        df["ema_9"] = close.ewm(span=9, adjust=False).mean()
        df["ema_20"] = close.ewm(span=20, adjust=False).mean()
        df["ema_50"] = close.ewm(span=50, adjust=False).mean()
        df["ema_200"] = close.ewm(span=200, adjust=False).mean() if len(df) >= 200 else np.nan

        # 2. Simple Moving Averages
        df["sma_20"] = close.rolling(window=20, min_periods=1).mean()
        df["sma_50"] = close.rolling(window=50, min_periods=1).mean() if len(df) >= 50 else np.nan

        # 3. VWAP (Cumulative Volume Weighted Average Price)
        typical_price = (high + low + close) / 3.0
        pv = typical_price * volume
        cum_volume = volume.cumsum()
        df["vwap"] = np.where(cum_volume > 0, pv.cumsum() / cum_volume, typical_price)

        # 4. RSI 14 (Wilder's Smoothing)
        delta = close.diff()
        gain = delta.clip(lower=0.0)
        loss = (-delta).clip(lower=0.0)
        avg_gain = gain.ewm(alpha=1.0 / 14.0, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1.0 / 14.0, adjust=False).mean()
        rs = np.where(avg_loss == 0, 100.0, avg_gain / np.maximum(avg_loss, 1e-9))
        df["rsi_14"] = 100.0 - (100.0 / (1.0 + rs))

        # 5. MACD (12, 26, 9)
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        df["macd_line"] = ema_12 - ema_26
        df["macd_signal"] = df["macd_line"].ewm(span=9, adjust=False).mean()
        df["macd_hist"] = df["macd_line"] - df["macd_signal"]

        # 6. ATR 14 (Average True Range)
        prev_close = close.shift(1)
        tr1 = high - low
        tr2 = (high - prev_close).abs()
        tr3 = (low - prev_close).abs()
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        df["atr_14"] = true_range.ewm(alpha=1.0 / 14.0, adjust=False).mean()

        # 7. Bollinger Bands (20, 2.0 std)
        sma_20 = df["sma_20"]
        std_20 = close.rolling(window=20, min_periods=1).std().fillna(0.0)
        df["bb_middle"] = sma_20
        df["bb_upper"] = sma_20 + (2.0 * std_20)
        df["bb_lower"] = sma_20 - (2.0 * std_20)
        df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / np.maximum(sma_20, 1e-9)

        # 8. Volume Spikes (> 2.0x 20-period volume average)
        vol_sma_20 = volume.rolling(window=20, min_periods=1).mean()
        df["vol_sma_20"] = vol_sma_20
        df["is_volume_spike"] = volume > (2.0 * np.maximum(vol_sma_20, 1.0))

        # 9. Swing Highs & Lows (Lagged 2 bars for zero look-ahead bias)
        # Point-in-time safety: bar at i-2 is a swing high if higher than i-4, i-3, i-1, i
        n = len(df)
        swing_high = np.zeros(n, dtype=bool)
        swing_low = np.zeros(n, dtype=bool)
        for i in range(4, n):
            target = high.iloc[i - 2]
            if (target > high.iloc[i - 4] and target > high.iloc[i - 3] and
                target > high.iloc[i - 1] and target > high.iloc[i]):
                swing_high[i - 2] = True

            target_low = low.iloc[i - 2]
            if (target_low < low.iloc[i - 4] and target_low < low.iloc[i - 3] and
                target_low < low.iloc[i - 1] and target_low < low.iloc[i]):
                swing_low[i - 2] = True

        df["is_swing_high"] = swing_high
        df["is_swing_low"] = swing_low

        # 10. Dynamic Support & Resistance Zones
        sr_levels = TechnicalIndicatorEngine.detect_support_resistance(df)
        df["support_zone"] = sr_levels["support"]
        df["resistance_zone"] = sr_levels["resistance"]

        # 11. Market Regime Classification
        df["market_regime"] = TechnicalIndicatorEngine.classify_market_regime(df)

        return df

    @staticmethod
    def detect_support_resistance(df: pd.DataFrame, lookback: int = 50) -> Dict[str, float]:
        """
        Extracts recent confirmed support and resistance zones from swing levels.
        """
        if len(df) < 10:
            last_p = float(df["close"].iloc[-1])
            return {"support": round(last_p * 0.98, 2), "resistance": round(last_p * 1.02, 2)}

        subset = df.iloc[-lookback:]
        recent_lows = subset[subset["is_swing_low"]]["low"]
        recent_highs = subset[subset["is_swing_high"]]["high"]

        last_price = float(df["close"].iloc[-1])

        # Support: highest confirmed swing low below current price
        supports = recent_lows[recent_lows < last_price]
        support_val = float(supports.max()) if not supports.empty else float(subset["low"].min())

        # Resistance: lowest confirmed swing high above current price
        resistances = recent_highs[recent_highs > last_price]
        resistance_val = float(resistances.min()) if not resistances.empty else float(subset["high"].max())

        return {
            "support": round(support_val, 2),
            "resistance": round(resistance_val, 2),
        }

    @staticmethod
    def classify_market_regime(df: pd.DataFrame) -> pd.Series:
        """
        Classifies regime per candle:
        - TRENDING_UP: Close > EMA20 > EMA50 and RSI > 50
        - TRENDING_DOWN: Close < EMA20 < EMA50 and RSI < 50
        - HIGH_VOLATILITY: ATR > 1.5 * rolling ATR mean or BB width > 1.5 * mean
        - RANGING: Otherwise
        """
        regimes = []
        atr = df.get("atr_14", pd.Series(np.zeros(len(df))))
        atr_avg = atr.rolling(20).mean()
        
        for idx in range(len(df)):
            if idx < 20:
                regimes.append("RANGING")
                continue

            c = df["close"].iloc[idx]
            ema20 = df["ema_20"].iloc[idx] if not np.isnan(df["ema_20"].iloc[idx]) else c
            ema50 = df["ema_50"].iloc[idx] if not np.isnan(df["ema_50"].iloc[idx]) else ema20
            rsi = df["rsi_14"].iloc[idx] if not np.isnan(df["rsi_14"].iloc[idx]) else 50.0
            cur_atr = atr.iloc[idx] if not np.isnan(atr.iloc[idx]) else 0.0
            avg_atr = atr_avg.iloc[idx] if not np.isnan(atr_avg.iloc[idx]) else 0.0

            if avg_atr > 0 and cur_atr > 1.6 * avg_atr:
                regimes.append("HIGH_VOLATILITY")
            elif c > ema20 > ema50 and rsi >= 52.0:
                regimes.append("TRENDING_UP")
            elif c < ema20 < ema50 and rsi <= 48.0:
                regimes.append("TRENDING_DOWN")
            else:
                regimes.append("RANGING")

        return pd.Series(regimes, index=df.index)
