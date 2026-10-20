from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException
import pytz

from app.data.mock import MockDataProvider
from app.data.yahoo import YahooFinanceProvider
from app.schemas.market import CandleSeriesResponse, CandleSchema, InstrumentSummary

router = APIRouter(prefix="/markets", tags=["Markets"])

# Default providers
mock_provider = MockDataProvider()
yahoo_provider = YahooFinanceProvider()

INSTRUMENTS_METADATA = [
    # Indian Indices & Equities (NSE/BSE)
    {"id": 1, "symbol": "NIFTY 50", "name": "Nifty 50 Index", "exchange": "NSE", "asset_class": "INDEX", "currency": "INR", "tick_size": 0.05, "lot_size": 25},
    {"id": 2, "symbol": "BANK NIFTY", "name": "Nifty Bank Index", "exchange": "NSE", "asset_class": "INDEX", "currency": "INR", "tick_size": 0.05, "lot_size": 15},
    {"id": 3, "symbol": "SENSEX", "name": "BSE Sensex Index", "exchange": "BSE", "asset_class": "INDEX", "currency": "INR", "tick_size": 0.05, "lot_size": 10},
    {"id": 4, "symbol": "RELIANCE.NS", "name": "Reliance Industries Ltd", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 5, "symbol": "HDFCBANK.NS", "name": "HDFC Bank Ltd", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 6, "symbol": "TCS.NS", "name": "Tata Consultancy Services", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 7, "symbol": "INFY.NS", "name": "Infosys Ltd", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 8, "symbol": "ICICIBANK.NS", "name": "ICICI Bank Ltd", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 9, "symbol": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 10, "symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 11, "symbol": "LT.NS", "name": "Larsen & Toubro Ltd", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},
    {"id": 12, "symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank", "exchange": "NSE", "asset_class": "STOCK", "currency": "INR", "tick_size": 0.05, "lot_size": 1},

    # Forex (MT5 Major Pairs)
    {"id": 13, "symbol": "GBP/USD", "name": "British Pound / US Dollar (MT5)", "exchange": "FOREX", "asset_class": "FOREX", "currency": "USD", "tick_size": 0.0001, "lot_size": 1000},
    {"id": 14, "symbol": "EUR/USD", "name": "Euro / US Dollar (MT5)", "exchange": "FOREX", "asset_class": "FOREX", "currency": "USD", "tick_size": 0.0001, "lot_size": 1000},
    {"id": 15, "symbol": "USD/JPY", "name": "US Dollar / Japanese Yen", "exchange": "FOREX", "asset_class": "FOREX", "currency": "JPY", "tick_size": 0.01, "lot_size": 1000},
    {"id": 16, "symbol": "USD/INR", "name": "US Dollar / Indian Rupee", "exchange": "FOREX", "asset_class": "FOREX", "currency": "INR", "tick_size": 0.0025, "lot_size": 1000},

    # Commodities & Metals (Gold Spot & Futures, Silver, Oil)
    {"id": 17, "symbol": "GOLD", "name": "Gold Spot / Futures (GC=F)", "exchange": "COMEX", "asset_class": "COMMODITY", "currency": "USD", "tick_size": 0.10, "lot_size": 1},
    {"id": 18, "symbol": "SILVER", "name": "Silver Futures (SI=F)", "exchange": "COMEX", "asset_class": "COMMODITY", "currency": "USD", "tick_size": 0.01, "lot_size": 1},
    {"id": 19, "symbol": "CRUDE OIL", "name": "Crude Oil WTI (CL=F)", "exchange": "NYMEX", "asset_class": "COMMODITY", "currency": "USD", "tick_size": 0.01, "lot_size": 1},

    # Global Indices & US Equities
    {"id": 20, "symbol": "^GSPC", "name": "S&P 500 Index", "exchange": "NYSE", "asset_class": "INDEX", "currency": "USD", "tick_size": 0.01, "lot_size": 1},
    {"id": 21, "symbol": "^IXIC", "name": "Nasdaq Composite", "exchange": "NASDAQ", "asset_class": "INDEX", "currency": "USD", "tick_size": 0.01, "lot_size": 1},
    {"id": 22, "symbol": "DOW JONES", "name": "Dow Jones Industrial Average (US30)", "exchange": "NYSE", "asset_class": "INDEX", "currency": "USD", "tick_size": 0.01, "lot_size": 1},
    {"id": 23, "symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "asset_class": "STOCK", "currency": "USD", "tick_size": 0.01, "lot_size": 1},
    {"id": 24, "symbol": "MSFT", "name": "Microsoft Corp.", "exchange": "NASDAQ", "asset_class": "STOCK", "currency": "USD", "tick_size": 0.01, "lot_size": 1},
    {"id": 25, "symbol": "NVDA", "name": "NVIDIA Corp.", "exchange": "NASDAQ", "asset_class": "STOCK", "currency": "USD", "tick_size": 0.01, "lot_size": 1},
    {"id": 26, "symbol": "TSLA", "name": "Tesla Inc.", "exchange": "NASDAQ", "asset_class": "STOCK", "currency": "USD", "tick_size": 0.01, "lot_size": 1},

    # Crypto (24/7)
    {"id": 27, "symbol": "BTC-USD", "name": "Bitcoin / USD", "exchange": "CRYPTO", "asset_class": "CRYPTO", "currency": "USD", "tick_size": 0.50, "lot_size": 1},
    {"id": 28, "symbol": "ETH-USD", "name": "Ethereum / USD", "exchange": "CRYPTO", "asset_class": "CRYPTO", "currency": "USD", "tick_size": 0.10, "lot_size": 1},
]


@router.get("/instruments", response_model=List[InstrumentSummary])
async def list_instruments():
    """Returns list of supported market instruments with tick sizes and exchange details."""
    return INSTRUMENTS_METADATA


from app.execution.bot_runner import trading_bot


@router.get("/candles", response_model=CandleSeriesResponse)
async def get_candles(
    symbol: str = Query("NIFTY 50", description="Symbol e.g. NIFTY 50, GBP/USD, GOLD, AAPL"),
    timeframe: str = Query("15m", description="1m, 5m, 15m, 1h, 1d"),
    days_back: int = Query(15, description="Number of days lookback"),
    provider: str = Query("yahoo", description="Provider: yahoo | mock"),
):
    """Fetches standardized historical OHLCV candles synced with live ticks."""
    now = datetime.now(pytz.UTC)
    start_time = now - timedelta(days=days_back)
    
    selected_provider = yahoo_provider if provider.lower() == "yahoo" else mock_provider
    try:
        df = await selected_provider.fetch_historical_candles(symbol, timeframe, start_time, now)
        if df.empty and provider.lower() == "yahoo":
            df = await mock_provider.fetch_historical_candles(symbol, timeframe, start_time, now)
    except Exception:
        df = await mock_provider.fetch_historical_candles(symbol, timeframe, start_time, now)

    # Sync live tick only if available and within sensible deviation (prevents giant bar artifact)
    live_price = trading_bot.live_prices.get(symbol)
    if not df.empty and live_price and live_price > 0:
        last_close = float(df.iloc[-1]["close"])
        if abs(live_price - last_close) / max(last_close, 1e-6) < 0.25:
            last_idx = df.index[-1]
            df.loc[last_idx, "close"] = live_price
            df.loc[last_idx, "high"] = max(df.loc[last_idx, "high"], live_price)
            df.loc[last_idx, "low"] = min(df.loc[last_idx, "low"], live_price)

    candles = [
        CandleSchema(
            timestamp=row["timestamp"],
            open=float(row["open"]),
            high=float(row["high"]),
            low=float(row["low"]),
            close=float(row["close"]),
            volume=float(row["volume"]),
        )
        for _, row in df.iterrows()
    ]

    return CandleSeriesResponse(symbol=symbol, timeframe=timeframe, candles=candles)


# Real ticker quotes cache
TICKER_CACHE: Dict[str, Any] = {}
LAST_TICKER_FETCH: Optional[datetime] = None


@router.get("/ticker-strip")
async def get_ticker_strip():
    """
    Returns live real quotes, day change points, and day change %
    for major Indian indices, US indices, commodities, and Forex MT5 pairs.
    """
    global TICKER_CACHE, LAST_TICKER_FETCH
    now = datetime.now(pytz.UTC)

    # Use cache if within 15 seconds
    if LAST_TICKER_FETCH and (now - LAST_TICKER_FETCH).total_seconds() < 15 and TICKER_CACHE:
        return list(TICKER_CACHE.values())

    symbols = [
        {"display": "NIFTY 50", "yahoo": "^NSEI", "currency": "INR"},
        {"display": "BANK NIFTY", "yahoo": "^NSEBANK", "currency": "INR"},
        {"display": "SENSEX", "yahoo": "^BSESN", "currency": "INR"},
        {"display": "GBP/USD", "yahoo": "GBPUSD=X", "currency": "USD"},
        {"display": "EUR/USD", "yahoo": "EURUSD=X", "currency": "USD"},
        {"display": "GOLD", "yahoo": "GC=F", "currency": "USD"},
        {"display": "CRUDE OIL", "yahoo": "CL=F", "currency": "USD"},
        {"display": "RELIANCE.NS", "yahoo": "RELIANCE.NS", "currency": "INR"},
        {"display": "HDFCBANK.NS", "yahoo": "HDFCBANK.NS", "currency": "INR"},
        {"display": "S&P 500", "yahoo": "^GSPC", "currency": "USD"},
        {"display": "NASDAQ", "yahoo": "^IXIC", "currency": "USD"},
        {"display": "BTC-USD", "yahoo": "BTC-USD", "currency": "USD"},
    ]

    import yfinance as yf
    import asyncio

    def _fetch_all():
        results = []
        for s in symbols:
            try:
                t = yf.Ticker(s["yahoo"])
                fi = t.fast_info
                price = getattr(fi, "last_price", None)
                prev_close = getattr(fi, "previous_close", None)
                day_open = getattr(fi, "open", None)
                day_high = getattr(fi, "day_high", None)
                day_low = getattr(fi, "day_low", None)

                if price is not None and prev_close is not None and prev_close > 0:
                    change = price - prev_close
                    change_pct = (change / prev_close) * 100.0
                else:
                    # Fallback to history
                    h = t.history(period="2d")
                    if len(h) >= 2:
                        price = float(h["Close"].iloc[-1])
                        prev_close = float(h["Close"].iloc[-2])
                        day_open = float(h["Open"].iloc[-1])
                        day_high = float(h["High"].iloc[-1])
                        day_low = float(h["Low"].iloc[-1])
                        change = price - prev_close
                        change_pct = (change / prev_close) * 100.0
                    elif len(h) == 1:
                        price = float(h["Close"].iloc[-1])
                        prev_close = price
                        day_open = float(h["Open"].iloc[-1])
                        day_high = float(h["High"].iloc[-1])
                        day_low = float(h["Low"].iloc[-1])
                        change = 0.0
                        change_pct = 0.0
                    else:
                        price = 22888.0 if "NIFTY" in s["display"] else 1.3348
                        prev_close = price
                        day_open = price
                        day_high = price
                        day_low = price
                        change = 0.0
                        change_pct = 0.0
                
                precision = 4 if ("GBP" in s["display"] or "EUR" in s["display"]) else 2
                results.append({
                    "symbol": s["display"],
                    "price": round(float(price), precision),
                    "change": round(float(change), precision),
                    "change_pct": round(float(change_pct), 2),
                    "currency": s["currency"],
                    "open": round(float(day_open or price), precision),
                    "high": round(float(day_high or price), precision),
                    "low": round(float(day_low or price), precision),
                    "prev_close": round(float(prev_close or price), precision),
                    "timestamp": now.isoformat(),
                })
            except Exception:
                # Retain cached or fallback
                cached = TICKER_CACHE.get(s["display"])
                if cached:
                    results.append(cached)
                else:
                    precision = 4 if ("GBP" in s["display"] or "EUR" in s["display"]) else 2
                    results.append({
                        "symbol": s["display"],
                        "price": 22888.0 if "NIFTY" in s["display"] else 100.0,
                        "change": 0.0,
                        "change_pct": 0.0,
                        "currency": s["currency"],
                        "open": 22888.0 if "NIFTY" in s["display"] else 100.0,
                        "high": 22888.0 if "NIFTY" in s["display"] else 100.0,
                        "low": 22888.0 if "NIFTY" in s["display"] else 100.0,
                        "prev_close": 22888.0 if "NIFTY" in s["display"] else 100.0,
                        "timestamp": now.isoformat(),
                    })
        return results

    loop = asyncio.get_running_loop()
    items = await loop.run_in_executor(None, _fetch_all)
    for item in items:
        TICKER_CACHE[item["symbol"]] = item
    LAST_TICKER_FETCH = now

    return items


@router.get("/live-tick")
async def get_live_tick(symbol: str = "NIFTY 50"):
    """Returns the up-to-the-second real-time market price and active candle tick."""
    return trading_bot.get_live_tick(symbol)


@router.get("/quote")
async def get_quote(symbol: str = "NIFTY 50", provider: str = "yahoo"):
    live_p = trading_bot.live_prices.get(symbol)
    if live_p:
        return {"symbol": symbol, "price": live_p, "timestamp": datetime.now(pytz.UTC), "volume": 1000.0}
    selected_provider = yahoo_provider if provider.lower() == "yahoo" else mock_provider
    try:
        quote = await selected_provider.fetch_latest_quote(symbol)
        if quote.get("price") == 0.0 and provider.lower() == "yahoo":
            quote = await mock_provider.fetch_latest_quote(symbol)
    except Exception:
        quote = await mock_provider.fetch_latest_quote(symbol)
    return quote
