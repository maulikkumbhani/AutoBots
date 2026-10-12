import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pytz

from app.indicators.calculator import TechnicalIndicatorEngine


def generate_sample_candles(n: int = 60) -> pd.DataFrame:
    base_time = datetime(2026, 10, 1, 9, 15, tzinfo=pytz.UTC)
    timestamps = [base_time + timedelta(minutes=15 * i) for i in range(n)]
    
    # Predictable price series
    closes = 100.0 + np.sin(np.linspace(0, 10, n)) * 10.0
    highs = closes + 1.0
    lows = closes - 1.0
    opens = closes - 0.2
    volumes = np.full(n, 1000.0)
    volumes[10] = 5000.0  # Volume spike

    return pd.DataFrame({
        "timestamp": timestamps,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    })


def test_indicator_calculations():
    df = generate_sample_candles(70)
    df_calc = TechnicalIndicatorEngine.calculate_all(df)

    # Check that required columns are present
    expected_cols = [
        "ema_9", "ema_20", "ema_50", "sma_20", "vwap", "rsi_14",
        "macd_line", "macd_signal", "macd_hist", "atr_14",
        "bb_upper", "bb_middle", "bb_lower", "is_volume_spike",
        "is_swing_high", "is_swing_low", "support_zone", "resistance_zone",
        "market_regime",
    ]
    for col in expected_cols:
        assert col in df_calc.columns, f"Missing indicator column: {col}"

    # Assert RSI is bounded between 0 and 100
    valid_rsi = df_calc["rsi_14"].dropna()
    assert (valid_rsi >= 0.0).all() and (valid_rsi <= 100.0).all()

    # Assert Bollinger Bands: Upper >= Middle >= Lower
    valid_bb = df_calc.dropna(subset=["bb_upper", "bb_middle", "bb_lower"])
    assert (valid_bb["bb_upper"] >= valid_bb["bb_middle"]).all()
    assert (valid_bb["bb_middle"] >= valid_bb["bb_lower"]).all()

    # Assert Volume Spike detected at index 10
    assert df_calc["is_volume_spike"].iloc[10] == True

    # Assert Market Regime is one of the valid classes
    valid_regimes = {"TRENDING_UP", "TRENDING_DOWN", "RANGING", "HIGH_VOLATILITY"}
    assert set(df_calc["market_regime"].unique()).issubset(valid_regimes)
