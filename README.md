# AI Market Intelligence, Historical Prediction Testing & Paper Trading Platform

An explainable, quantitative AI market intelligence laboratory for simulated trading, point-in-time historical replay, and prediction evaluation.

## Key Principles & Methodological Safeguards
- **Zero Look-Ahead Bias Guarantee**: At cutoff timestamp $T$, all future candles, forward news, and future-derived statistics are strictly filtered out. Indicators are recalculated purely on data preceding $T$.
- **Objective Mathematical Indicators**: Pure Pandas/NumPy calculations for EMA, SMA, VWAP, RSI 14, MACD, ATR 14, Bollinger Bands, and Regimes. No LLM-hallucinated numbers.
- **Statistical Accuracy Dashboard**: Evaluates predictions with 95% Wilson Score confidence intervals, Brier calibration scores, and explicit sample sizes. Unresolved forecasts are strictly excluded from the accuracy denominator.
- **Conservative Execution**: Simultaneous Stop-Loss and Take-Profit touches within the same bar assume Stop-Loss is hit first. Accounts for realistic slippage and broker/exchange fees.

## Quick Start

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Run Test Suite
```bash
pytest tests/ -v
```

### 3. Start API Server
```bash
uvicorn app.main:app --reload --port 8000
```
API Documentation: `http://localhost:8000/docs`
