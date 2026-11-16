"""
MT5 (MetaTrader 5) Automated Trading Bridge Engine.
Enables bidirectional communication between AutoBot and MetaTrader 5:
1. Translates internal signals (High-Volume Scalper, Ensemble, etc.) into MT5 Trade Requests.
2. Supports HTTP Webhook / REST polling for any MT5 terminal (Windows, Mac Wine, or VPS).
3. Manages pending signal queues, position tracking, lot size normalization, and SL/TP calculation.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import logging
import pytz

logger = logging.getLogger(__name__)

# Standard symbol mapping from AutoBot display symbols to MT5 broker symbols
DEFAULT_SYMBOL_MAP: Dict[str, str] = {
    "GOLD": "XAUUSD",
    "GBP/USD": "GBPUSD",
    "EUR/USD": "EURUSD",
    "USD/JPY": "USDJPY",
    "AUD/USD": "AUDUSD",
    "USD/CAD": "USDCAD",
    "USD/CHF": "USDCHF",
    "BTC/USD": "BTCUSD",
    "ETH/USD": "ETHUSD",
    "SILVER": "XAGUSD",
    "CRUDE OIL": "USOUSD",
    "NIFTY 50": "INDIA50",
    "BANKNIFTY": "BANKINDIA",
    "S&P 500": "US500",
    "NASDAQ 100": "USTEC",
    "DOW JONES": "US30",
}


class MT5BridgeManager:
    """Manages state, signal queue, and telemetry for MetaTrader 5 integration."""

    def __init__(self):
        self.enabled: bool = True
        self.server: str = "OctaFX-Demo"
        self.account_id: str = "115610153"
        self.default_lot_size: float = 0.05
        self.magic_number: int = 888999
        self.slippage_points: int = 20

        self.symbol_map: Dict[str, str] = dict(DEFAULT_SYMBOL_MAP)
        self.pending_signals: List[Dict[str, Any]] = []
        self.executed_trades: List[Dict[str, Any]] = []
        self.open_mt5_positions: List[Dict[str, Any]] = []

        # Real-time broker live market telemetry received directly from MT5 terminal
        self.live_broker_quotes: Dict[str, Dict[str, Any]] = {}
        self.live_broker_candles: Dict[str, List[Dict[str, Any]]] = {}

        self.account_info: Dict[str, Any] = {
            "balance": 100000.0,
            "equity": 100000.0,
            "margin": 0.0,
            "free_margin": 100000.0,
            "leverage": 500,
            "currency": "USD",
            "server": "OctaFX-Demo",
            "account_id": "115610153",
            "company": "OctaFX",
            "is_connected": False,
        }
        self.last_heartbeat: Optional[datetime] = None

        # Pre-queue initial active XAUUSD automated trade signal using High-Volume Scalper
        self.queue_signal(
            symbol="XAUUSD",
            side="BUY",
            lots=0.05,
            price=0.0,
            stop_loss=0.0,
            take_profit=0.0,
            strategy="HIGH_VOLUME_SCALPER",
            comment="AutoBot_XAUUSD",
        )

    def map_symbol(self, symbol: str) -> str:
        """Converts internal symbol to MT5 broker symbol."""
        sym_u = symbol.upper().strip()
        return self.symbol_map.get(sym_u, sym_u.replace("/", "").replace(" ", ""))

    def queue_signal(
        self,
        symbol: str,
        side: str,  # "BUY" or "SELL"
        lots: float,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        strategy: str = "AutoBot",
        comment: str = "AutoBot AI Signal",
        magic_number: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Queues an automated order for the MT5 Expert Advisor to execute."""
        now_utc = datetime.now(timezone.utc)
        ist_zone = pytz.timezone("Asia/Kolkata")
        ist_now = now_utc.astimezone(ist_zone)

        mt5_sym = self.map_symbol(symbol)
        signal_id = f"SIG-{int(now_utc.timestamp() * 1000)}"

        signal = {
            "signal_id": signal_id,
            "symbol": mt5_sym,
            "original_symbol": symbol,
            "side": side.upper(),
            "lots": round(max(0.01, lots if lots > 0 else self.default_lot_size), 2),
            "price": round(price, 5),
            "stop_loss": round(stop_loss, 5) if stop_loss else 0.0,
            "take_profit": round(take_profit, 5) if take_profit else 0.0,
            "magic_number": magic_number or self.magic_number,
            "slippage": self.slippage_points,
            "strategy": strategy,
            "comment": f"{strategy[:10]}_{signal_id[-4:]}",
            "created_at": now_utc.isoformat(),
            "created_at_ist": ist_now.strftime("%d/%m/%Y, %I:%M:%S %p"),
            "status": "QUEUED",
        }

        self.pending_signals.append(signal)
        logger.info(f"Queued MT5 trade signal: {side} {lots} lots of {mt5_sym} @ {price}")
        return signal

    def pop_signals(self) -> List[Dict[str, Any]]:
        """Called by MT5 EA polling loop: retrieves and clears queued signals."""
        signals_to_send = [s for s in self.pending_signals if s["status"] == "QUEUED"]
        for s in signals_to_send:
            s["status"] = "SENT_TO_EA"
        # keep last 50 for audit, but return unexecuted
        return signals_to_send

    def record_execution_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Called by MT5 EA after executing OrderSend() in MT5 terminal."""
        now_utc = datetime.now(timezone.utc)
        record = {
            "ticket": result.get("ticket", 0),
            "signal_id": result.get("signal_id", ""),
            "symbol": result.get("symbol", ""),
            "side": result.get("side", ""),
            "lots": result.get("lots", 0.0),
            "executed_price": result.get("executed_price", 0.0),
            "sl": result.get("sl", 0.0),
            "tp": result.get("tp", 0.0),
            "success": result.get("success", False),
            "error_code": result.get("error_code", 0),
            "error_msg": result.get("error_msg", ""),
            "executed_at": now_utc.isoformat(),
        }

        self.executed_trades.append(record)

        # Mark signal as executed in pending queue
        for s in self.pending_signals:
            if s.get("signal_id") == record["signal_id"]:
                s["status"] = "FILLED" if record["success"] else f"FAILED: {record['error_msg']}"

        logger.info(f"Recorded MT5 execution result for ticket #{record['ticket']}: success={record['success']}")
        return record

    def update_heartbeat(self, payload: Dict[str, Any]):
        """Updates connection state and live account metrics from MT5 EA."""
        self.last_heartbeat = datetime.now(timezone.utc)
        self.account_info["is_connected"] = True
        if "balance" in payload:
            self.account_info["balance"] = float(payload["balance"])
        if "equity" in payload:
            self.account_info["equity"] = float(payload["equity"])
        if "margin" in payload:
            self.account_info["margin"] = float(payload.get("margin", 0.0))
        if "free_margin" in payload:
            self.account_info["free_margin"] = float(payload.get("free_margin", payload["equity"]))
        if "leverage" in payload:
            self.account_info["leverage"] = int(payload.get("leverage", 100))
        if "currency" in payload:
            self.account_info["currency"] = str(payload.get("currency", "USD"))
        if "server" in payload:
            self.account_info["server"] = str(payload.get("server", self.server))
        if "account" in payload:
            self.account_info["account_id"] = str(payload.get("account", self.account_id))
            self.account_id = str(payload.get("account", self.account_id))

        if "open_positions" in payload and isinstance(payload["open_positions"], list):
            self.open_mt5_positions = payload["open_positions"]

        # Ingest Real Live Market Telemetry transmitted directly from MT5 Terminal
        if "symbol" in payload and ("bid" in payload or "price" in payload or "last" in payload):
            raw_sym = str(payload["symbol"]).strip().upper()
            bid = float(payload.get("bid", 0.0))
            ask = float(payload.get("ask", 0.0))
            price = float(payload.get("price", payload.get("last", (bid + ask) / 2.0 if bid > 0 and ask > 0 else (bid or ask))))
            day_open = float(payload.get("day_open", price))
            day_high = float(payload.get("day_high", price))
            day_low = float(payload.get("day_low", price))
            prev_close = float(payload.get("prev_close", day_open))
            if prev_close <= 0.0:
                prev_close = day_open if day_open > 0 else price
            day_change = price - prev_close
            day_change_pct = (day_change / prev_close * 100.0) if prev_close > 0 else 0.0

            quote_data = {
                "symbol": raw_sym,
                "bid": bid,
                "ask": ask,
                "price": price,
                "open": day_open,
                "high": day_high,
                "low": day_low,
                "prev_close": prev_close,
                "change": round(day_change, 2 if "XAU" in raw_sym else 4),
                "change_pct": round(day_change_pct, 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "MT5_LIVE_BROKER",
            }

            self.live_broker_quotes[raw_sym] = quote_data
            if raw_sym == "XAUUSD":
                self.live_broker_quotes["GOLD"] = dict(quote_data, symbol="GOLD")
            elif raw_sym == "GOLD":
                self.live_broker_quotes["XAUUSD"] = dict(quote_data, symbol="XAUUSD")

        # Ingest Real Live OHLCV Candles transmitted directly from MT5
        if "candles" in payload and isinstance(payload["candles"], list) and len(payload["candles"]) > 0:
            raw_sym = str(payload.get("symbol", "XAUUSD")).strip().upper()
            self.live_broker_candles[raw_sym] = payload["candles"]
            if raw_sym == "XAUUSD":
                self.live_broker_candles["GOLD"] = payload["candles"]
            elif raw_sym == "GOLD":
                self.live_broker_candles["XAUUSD"] = payload["candles"]

    def get_live_broker_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Returns direct live broker quote if MT5 is streaming telemetry."""
        sym_u = symbol.upper().strip()
        if sym_u in self.live_broker_quotes:
            return self.live_broker_quotes[sym_u]
        if "GOLD" in sym_u or "XAU" in sym_u:
            return self.live_broker_quotes.get("XAUUSD") or self.live_broker_quotes.get("GOLD")
        return None

    def get_live_broker_candles(self, symbol: str) -> Optional[List[Dict[str, Any]]]:
        """Returns direct live broker candles from MT5 if available."""
        sym_u = symbol.upper().strip()
        if sym_u in self.live_broker_candles:
            return self.live_broker_candles[sym_u]
        if "GOLD" in sym_u or "XAU" in sym_u:
            return self.live_broker_candles.get("XAUUSD") or self.live_broker_candles.get("GOLD")
        return None

    def get_status(self) -> Dict[str, Any]:
        """Returns bridge status for frontend display."""
        now = datetime.now(timezone.utc)
        is_alive = False
        if self.last_heartbeat:
            delta = (now - self.last_heartbeat).total_seconds()
            is_alive = delta < 15.0  # alive if pinged within last 15 seconds

        self.account_info["is_connected"] = is_alive

        return {
            "enabled": self.enabled,
            "connected": is_alive,
            "account_id": self.account_id,
            "server": self.server,
            "default_lot_size": self.default_lot_size,
            "magic_number": self.magic_number,
            "account_info": self.account_info,
            "pending_count": sum(1 for s in self.pending_signals if s["status"] == "QUEUED"),
            "executed_count": len(self.executed_trades),
            "open_positions_count": len(self.open_mt5_positions),
            "open_positions": self.open_mt5_positions,
            "latest_executed_trades": self.executed_trades[-10:],
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
        }


# Singleton bridge instance
mt5_bridge = MT5BridgeManager()
