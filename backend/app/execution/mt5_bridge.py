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
import os
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
    """
    Direct MT5 execution bridge manager.
    Supports both Direct Local File IPC (Zero Network) and WebRequest HTTP.
    Maintains persistent trade recording, strategy attribution, and PnL analytics.
    """

    STRATEGY_METADATA: Dict[str, Dict[str, Any]] = {
        "GAP_FVG": {
            "name": "Fair Value Gap (FVG) Liquidity Hunter",
            "horizon": "Ultra-Short (1m - 5m)",
            "default_tf": "1m",
            "description": "Exploits 3-bar institutional imbalances & liquidity sweeps with tight TP",
        },
        "SCALPER_EMA": {
            "name": "High-Volume EMA 9/21 Scalper",
            "horizon": "Ultra-Short (1m - 5m)",
            "default_tf": "1m",
            "description": "Fast micro-momentum breakout & exponential moving average crossovers",
        },
        "BOLLINGER_REV": {
            "name": "Bollinger Band Mean-Reversion",
            "horizon": "Medium (15m - 1h)",
            "default_tf": "15m",
            "description": "Standard-deviation envelope bounce targeting VWAP median reversion",
        },
        "ORDER_BLOCK": {
            "name": "Smart Money Order Block Breakout",
            "horizon": "Medium (15m - 1h)",
            "default_tf": "15m",
            "description": "Detects institutional accumulation blocks and liquidity re-tests",
        },
        "CONSENSUS_ML": {
            "name": "Multi-Model ML Consensus (GBDT/FinRL)",
            "horizon": "Medium (15m - 1h)",
            "default_tf": "15m",
            "description": "Algorithmic decision tree consensus across 6 statistical models",
        },
        "SWING_FLOW": {
            "name": "Macro Trend Swing Flow",
            "horizon": "Long-Term Swing (4h - 1D)",
            "default_tf": "4h",
            "description": "Multi-session directional wave rider with trailing structural stops",
        },
    }

    def __init__(self):
        self.enabled: bool = True
        self.server: str = "MetaQuotes-Demo"
        self.account_id: str = "115610153"
        self.default_lot_size: float = 0.05
        self.magic_number: int = 888999
        self.slippage_points: int = 20

        # Strategy Isolation Controller ("ALL" or specific strategy ID e.g. "GAP_FVG")
        self.active_strategy_filter: str = "ALL"

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
            "server": "MetaQuotes-Demo",
            "account_id": "115610153",
            "company": "MetaQuotes",
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

        # STRICT RISK GUARD: Max 2 concurrent open positions in MT5
        open_count = self.account_info.get("open_positions_count", 0)
        if open_count >= 2:
            logger.warning(f"Risk guard: blocked order. Current MT5 open positions ({open_count}) >= 2.")
            return {"signal_id": "REJECTED_MAX_POS", "status": "REJECTED", "reason": "Max open positions reached"}

        # If user isolated a single strategy, reject all other strategies
        if self.active_strategy_filter != "ALL" and strategy != self.active_strategy_filter:
            logger.info(f"Skipped order for {strategy}: active strategy isolated to {self.active_strategy_filter}")
            return {"signal_id": "SKIPPED_ISOLATED", "status": "SKIPPED"}

        mt5_sym = self.map_symbol(symbol)
        signal_id = f"SIG-{int(now_utc.timestamp() * 1000)}"

        # For XAUUSD / Gold, calibrate realistic micro-scalp SL & TP if not explicitly tight
        final_sl = stop_loss
        final_tp = take_profit
        if "XAU" in mt5_sym or "GOLD" in mt5_sym:
            # If distance is wider than $5.00, calibrate to tight scalp target ($2.20 TP, $1.50 SL)
            if side.upper() == "BUY":
                if not final_tp or abs(final_tp - price) > 6.0:
                    final_tp = round(price + 2.20, 2)
                if not final_sl or abs(price - final_sl) > 6.0:
                    final_sl = round(price - 1.50, 2)
            else:
                if not final_tp or abs(price - final_tp) > 6.0:
                    final_tp = round(price - 2.20, 2)
                if not final_sl or abs(final_sl - price) > 6.0:
                    final_sl = round(price + 1.50, 2)

        signal = {
            "signal_id": signal_id,
            "symbol": mt5_sym,
            "original_symbol": symbol,
            "side": side.upper(),
            "lots": round(max(0.01, lots if lots > 0 else self.default_lot_size), 2),
            "price": round(price, 5),
            "stop_loss": round(final_sl, 2) if final_sl else 0.0,
            "take_profit": round(final_tp, 2) if final_tp else 0.0,
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
        self._write_signal_to_local_ipc(signal)
        return signal

    def _get_mql5_files_dirs(self) -> List[str]:
        """Returns candidate directories for MT5 MQL5/Files on macOS Wine."""
        base_user = "/Users/maulikkumbhani/Library/Application Support/net.metaquotes.wine.metatrader5"
        return [
            os.path.join(base_user, "drive_c/Program Files/MetaTrader 5/MQL5/Files"),
            os.path.join(base_user, "drive_c/users/user/AppData/Roaming/MetaQuotes/Terminal/D0E8209F77C8CF37AD8BF550E51FF075/MQL5/Files"),
        ]

    def _write_signal_to_local_ipc(self, signal: Dict[str, Any]):
        """Writes order directly to MQL5/Files/autobot_orders.txt for zero-network execution."""
        line = f"{signal['signal_id']}|{signal['symbol']}|{signal['side']}|{signal['lots']}|{signal.get('stop_loss', 0.0)}|{signal.get('take_profit', 0.0)}|{signal.get('comment', 'AutoBot')}|QUEUED\n"
        for d in self._get_mql5_files_dirs():
            try:
                os.makedirs(d, exist_ok=True)
                order_file = os.path.join(d, "autobot_orders.txt")
                with open(order_file, "a", encoding="utf-8") as f:
                    f.write(line)
            except Exception as e:
                logger.error(f"Failed to write order to {d}: {e}")

    def sync_file_telemetry(self):
        """Reads live account telemetry and order execution results from MQL5/Files."""
        for d in self._get_mql5_files_dirs():
            # 1. Telemetry
            telem_path = os.path.join(d, "autobot_telemetry.txt")
            if os.path.exists(telem_path):
                try:
                    mtime = datetime.fromtimestamp(os.path.getmtime(telem_path), tz=timezone.utc)
                    if (datetime.now(timezone.utc) - mtime).total_seconds() < 45:
                        with open(telem_path, "r", encoding="utf-8") as f:
                            raw = f.read().strip()
                        parts = raw.split("|")
                        if len(parts) >= 8:
                            self.last_heartbeat = mtime
                            self.account_info["is_connected"] = True
                            self.account_info["account_id"] = parts[0]
                            self.account_info["server"] = parts[1]
                            self.account_info["balance"] = float(parts[2])
                            self.account_info["equity"] = float(parts[3])
                            self.account_info["margin"] = float(parts[4])
                            self.account_info["free_margin"] = float(parts[5])
                            sym = parts[6]
                            bid = float(parts[7])
                            ask = float(parts[8]) if len(parts) > 8 else bid
                            self.live_broker_quotes[sym] = {"price": (bid + ask) / 2.0, "bid": bid, "ask": ask}
                            if len(parts) > 12 and parts[12].isdigit():
                                self.account_info["open_positions_count"] = int(parts[12])
                except Exception:
                    pass

            # 2. Results
            results_path = os.path.join(d, "autobot_results.txt")
            if os.path.exists(results_path):
                try:
                    with open(results_path, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if not line:
                                continue
                            parts = line.split("|")
                            if len(parts) >= 10:
                                sig_id = parts[0]
                                raw_ticket = parts[1].strip()
                                ticket = (int(raw_ticket) & 0xFFFFFFFF) if raw_ticket.lstrip("-").isdigit() else 0
                                if ticket > 0 and not any(t.get("ticket") == ticket for t in self.executed_trades):
                                    sym = parts[2]
                                    side = parts[3]
                                    lots = float(parts[4])
                                    exec_price = float(parts[5])
                                    sl = float(parts[6])
                                    tp = float(parts[7])
                                    success = parts[8] == "1"
                                    exec_at = parts[11] if len(parts) > 11 else datetime.now(timezone.utc).isoformat()

                                    # Correlate with signal for strategy, timeframe & horizon
                                    matched_sig = next((s for s in self.pending_signals if s.get("signal_id") == sig_id), None)
                                    strat = matched_sig.get("strategy", "SCALPER_EMA") if matched_sig else "SCALPER_EMA"
                                    if "GAP" in strat.upper() or "FVG" in strat.upper():
                                        strat = "GAP_FVG"
                                    elif "BOL" in strat.upper():
                                        strat = "BOLLINGER_REV"
                                    elif "ORDER" in strat.upper() or "BLOCK" in strat.upper():
                                        strat = "ORDER_BLOCK"
                                    elif "CONSENSUS" in strat.upper() or "ML" in strat.upper():
                                        strat = "CONSENSUS_ML"
                                    elif "SWING" in strat.upper():
                                        strat = "SWING_FLOW"
                                    else:
                                        strat = "SCALPER_EMA"

                                    meta = self.STRATEGY_METADATA.get(strat, self.STRATEGY_METADATA["SCALPER_EMA"])
                                    tf = matched_sig.get("timeframe", meta["default_tf"]) if matched_sig else meta["default_tf"]

                                    cur_price = self.live_broker_quotes.get(sym, {}).get("price", exec_price)
                                    multiplier = 100.0 if "XAU" in sym or "GOLD" in sym else 1.0
                                    pnl = round(((cur_price - exec_price) if side == "BUY" else (exec_price - cur_price)) * lots * multiplier, 2)

                                    self.executed_trades.append({
                                        "ticket": ticket,
                                        "signal_id": sig_id,
                                        "symbol": sym,
                                        "side": side,
                                        "lots": lots,
                                        "executed_price": exec_price,
                                        "current_price": cur_price,
                                        "sl": sl,
                                        "tp": tp,
                                        "pnl": pnl,
                                        "pnl_status": "PROFIT" if pnl >= 0 else "LOSS",
                                        "strategy": strat,
                                        "strategy_name": meta["name"],
                                        "horizon": meta["horizon"],
                                        "timeframe": tf,
                                        "success": success,
                                        "executed_at": exec_at,
                                    })
                except Exception as e:
                    logger.debug(f"Error parsing autobot_results.txt: {e}")

    def close_all_positions(self) -> Dict[str, Any]:
        """Sends immediate emergency close command to MT5 EA and clears queued orders."""
        line = "CMD-CLOSEALL|XAUUSD|CLOSE_ALL|0|0|0|EmergencyClose|QUEUED\n"
        for d in self._get_mql5_files_dirs():
            try:
                os.makedirs(d, exist_ok=True)
                order_file = os.path.join(d, "autobot_orders.txt")
                with open(order_file, "w", encoding="utf-8") as f:
                    f.write(line)
            except Exception as e:
                logger.error(f"Failed to write CLOSE_ALL to {d}: {e}")
        self.pending_signals.clear()
        return {"status": "SUCCESS", "message": "Emergency close all command sent to MT5"}

    def pop_signals(self) -> List[Dict[str, Any]]:
        """Called by MT5 EA polling loop: retrieves and clears queued signals."""
        signals_to_send = [s for s in self.pending_signals if s["status"] == "QUEUED"]
        for s in signals_to_send:
            s["status"] = "SENT_TO_EA"
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

    def get_strategy_performance(self) -> Dict[str, Any]:
        """Calculates separate performance, PnL, and win-rates for each trading strategy."""
        self.sync_file_telemetry()
        results: List[Dict[str, Any]] = []

        # Current live spot price for floating mark-to-market
        spot = self.live_broker_quotes.get("XAUUSD", {}).get("price", 3520.0)

        for strat_id, meta in self.STRATEGY_METADATA.items():
            matching_trades = [t for t in self.executed_trades if t.get("strategy") == strat_id]
            # If no trades yet for this strategy, generate initial calibrated baseline from market telemetry
            total_trades = len(matching_trades)
            wins = sum(1 for t in matching_trades if t.get("pnl", 0.0) > 0)
            losses = sum(1 for t in matching_trades if t.get("pnl", 0.0) < 0)
            gross_profit = sum(t.get("pnl", 0.0) for t in matching_trades if t.get("pnl", 0.0) > 0)
            gross_loss = abs(sum(t.get("pnl", 0.0) for t in matching_trades if t.get("pnl", 0.0) < 0))
            net_pnl = round(gross_profit - gross_loss, 2)
            win_rate = round((wins / total_trades * 100.0), 1) if total_trades > 0 else 0.0
            profit_factor = round(gross_profit / max(gross_loss, 0.01), 2) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

            is_active = (self.active_strategy_filter == "ALL") or (self.active_strategy_filter == strat_id)

            results.append({
                "strategy_id": strat_id,
                "name": meta["name"],
                "horizon": meta["horizon"],
                "default_tf": meta["default_tf"],
                "description": meta["description"],
                "total_trades": total_trades,
                "wins": wins,
                "losses": losses,
                "win_rate": win_rate,
                "gross_profit": round(gross_profit, 2),
                "gross_loss": round(gross_loss, 2),
                "net_pnl": net_pnl,
                "profit_factor": profit_factor,
                "is_active": is_active,
                "is_isolated": self.active_strategy_filter == strat_id,
            })

        total_net = round(sum(r["net_pnl"] for r in results), 2)
        total_executed = sum(r["total_trades"] for r in results)

        return {
            "active_isolation": self.active_strategy_filter,
            "strategies": results,
            "total_net_pnl": total_net,
            "total_trades_count": total_executed,
            "active_count": sum(1 for r in results if r["is_active"]),
        }

    def get_recorded_trades(
        self,
        timeframe: Optional[str] = None,
        period: Optional[str] = None,
        strategy: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Returns recorded MT5 trades with full filtering by timeframe, date period, and strategy."""
        self.sync_file_telemetry()
        trades = list(self.executed_trades)

        # Update current floating PnL on open trades
        cur_price = self.live_broker_quotes.get("XAUUSD", {}).get("price", 3520.0)
        for t in trades:
            exec_p = t.get("executed_price", cur_price)
            side = t.get("side", "BUY")
            lots = t.get("lots", 0.05)
            pnl = round(((cur_price - exec_p) if side == "BUY" else (exec_p - cur_price)) * lots * 100.0, 2)
            t["current_price"] = cur_price
            t["pnl"] = pnl
            t["pnl_status"] = "PROFIT" if pnl >= 0 else "LOSS"

        # 1. Filter by Strategy
        if strategy and strategy.upper() != "ALL":
            trades = [t for t in trades if t.get("strategy") == strategy or t.get("strategy_name") == strategy]

        # 2. Filter by Timeframe (m1, m5, 15m, h1, h4, 1d, 1w, 1m)
        if timeframe and timeframe.upper() != "ALL":
            tf_norm = timeframe.lower().replace("m", "").replace("h", "")
            trades = [t for t in trades if timeframe.lower() in str(t.get("timeframe", "")).lower()]

        # 3. Filter by Period (today, week, month, all)
        now_utc = datetime.now(timezone.utc)
        if period and period.lower() != "all":
            filtered = []
            for t in trades:
                try:
                    dt_str = t.get("executed_at", "")
                    if "T" in dt_str:
                        t_dt = datetime.fromisoformat(dt_str)
                    else:
                        t_dt = datetime.strptime(dt_str, "%Y.%m.%d %H:%M").replace(tzinfo=timezone.utc)
                    delta_hours = (now_utc - t_dt).total_seconds() / 3600.0
                    if period.lower() == "today" and delta_hours <= 24.0:
                        filtered.append(t)
                    elif period.lower() == "week" and delta_hours <= 168.0:
                        filtered.append(t)
                    elif period.lower() == "month" and delta_hours <= 720.0:
                        filtered.append(t)
                except Exception:
                    filtered.append(t)
            trades = filtered

        total_trades = len(trades)
        wins = sum(1 for t in trades if t.get("pnl", 0.0) >= 0)
        losses = sum(1 for t in trades if t.get("pnl", 0.0) < 0)
        win_rate = round((wins / total_trades * 100.0), 1) if total_trades > 0 else 0.0
        gross_profit = sum(t.get("pnl", 0.0) for t in trades if t.get("pnl", 0.0) > 0)
        gross_loss = abs(sum(t.get("pnl", 0.0) for t in trades if t.get("pnl", 0.0) < 0))
        net_pnl = round(gross_profit - gross_loss, 2)
        profit_factor = round(gross_profit / max(gross_loss, 0.01), 2) if gross_loss > 0 else 1.0

        return {
            "total_trades": total_trades,
            "wins": wins,
            "losses": losses,
            "win_rate": win_rate,
            "net_pnl": net_pnl,
            "gross_profit": round(gross_profit, 2),
            "gross_loss": round(gross_loss, 2),
            "profit_factor": profit_factor,
            "current_equity": self.account_info.get("equity", 100000.0),
            "current_balance": self.account_info.get("balance", 100000.0),
            "trades": list(reversed(trades)),
        }

    def set_isolated_strategy(self, strategy_id: str) -> Dict[str, Any]:
        """Isolates active execution to a single strategy or resumes 'ALL'."""
        self.active_strategy_filter = strategy_id.strip()
        logger.info(f"MT5 active strategy isolated to: {self.active_strategy_filter}")
        return {
            "status": "SUCCESS",
            "active_strategy_filter": self.active_strategy_filter,
            "is_isolated": self.active_strategy_filter != "ALL",
        }

    def get_status(self) -> Dict[str, Any]:
        """Returns bridge status for frontend display."""
        self.sync_file_telemetry()
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
            "active_strategy_filter": self.active_strategy_filter,
        }


# Singleton bridge instance
mt5_bridge = MT5BridgeManager()
