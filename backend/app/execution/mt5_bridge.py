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
        self.enabled: bool = False
        self.server: str = "MetaQuotes-Demo"
        self.account_id: str = "Demo Account"
        self.default_lot_size: float = 0.10
        self.magic_number: int = 888999
        self.slippage_points: int = 15

        self.symbol_map: Dict[str, str] = dict(DEFAULT_SYMBOL_MAP)
        self.pending_signals: List[Dict[str, Any]] = []
        self.executed_trades: List[Dict[str, Any]] = []
        self.open_mt5_positions: List[Dict[str, Any]] = []

        self.account_info: Dict[str, Any] = {
            "balance": 10000.0,
            "equity": 10000.0,
            "margin": 0.0,
            "free_margin": 10000.0,
            "leverage": 100,
            "currency": "USD",
            "server": "MetaQuotes-Demo",
            "company": "MetaQuotes Software Corp.",
            "is_connected": False,
        }
        self.last_heartbeat: Optional[datetime] = None

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
            "magic_number": self.magic_number,
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
