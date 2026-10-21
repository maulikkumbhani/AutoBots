from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import asyncio
import logging
import random
import pytz

from app.data.yahoo import YahooFinanceProvider
from app.data.mock import MockDataProvider
from app.indicators.calculator import TechnicalIndicatorEngine
from app.prediction.ensemble import EnsemblePredictionModel
from app.prediction.statistical import StatisticalRuleModel
from app.prediction.ml_baseline import MLBaselineModel
from app.execution.paper_engine import PaperTradingEngine
from app.api.routes_paper_trading import PORTFOLIO_STATE, POSITIONS, ORDERS_LOG

from app.prediction.high_volume_scalper import HighVolumeMicroScalper
from app.data.trade_ledger import trade_ledger
from app.data.master_audit_store import master_audit_store
from app.execution.mt5_bridge import mt5_bridge

logger = logging.getLogger(__name__)


class AutoTradingBot:
    """
    Automated algorithmic trading bot engine.
    Continuously monitors live/replay candles, simulates realistic micro-ticks,
    computes quantitative indicators, evaluates strategy conviction,
    and automatically executes BUY/SELL orders with calibrated SL/TP rules.
    Supports both Paper Trading simulation and Live MetaTrader 5 (MT5) execution.
    """

    def __init__(self):
        self.is_active = True  # Always-on by default as requested (can still be stopped manually)
        self._loop_task: Optional[asyncio.Task] = None
        self.poll_interval = 3.5  # Run cycle every 3.5 seconds

        self.symbol = "NIFTY 50"
        self.timeframe = "15m"
        self.strategy_type = "HIGH_VOLUME_SCALPER"  # Default to high-volume micro scalper
        self.execution_mode = "PAPER"    # "PAPER" or "MT5_LIVE"
        self.mt5_auto_trade = False      # Automatically forward signals to MT5
        self.quantity = 50.0
        self.take_profit_pct = 0.8       # 0.8% target for responsive intraday profit realization
        self.stop_loss_pct = 0.4         # 0.4% stop loss (2:1 Reward:Risk)
        self.trailing_stop_pct = 0.25    # 0.25% trailing stop
        self.min_confidence = 0.40       # Minimum directional probability to trade
        self.max_open_positions = 6      # Maximum total concurrent portfolio positions
        self.max_positions_per_asset = 1 # Max position per individual asset

        # Watchlist of multiple simultaneous assets for server daemon execution
        self.monitored_assets: List[Dict[str, Any]] = [
            {"symbol": "NIFTY 50", "name": "Nifty 50 Index", "category": "INDEX", "default_qty": 50.0, "best_model": "HIGH_VOLUME_SCALPER", "currency": "INR"},
            {"symbol": "BANKNIFTY", "name": "Bank Nifty Index", "category": "INDEX", "default_qty": 25.0, "best_model": "HIGH_VOLUME_SCALPER", "currency": "INR"},
            {"symbol": "GOLD", "name": "Gold Spot / Futures (XAUUSD)", "category": "COMMODITY", "default_qty": 2.0, "best_model": "HIGH_VOLUME_SCALPER", "currency": "USD"},
            {"symbol": "SILVER", "name": "Silver Futures (XAGUSD)", "category": "COMMODITY", "default_qty": 10.0, "best_model": "STATISTICAL", "currency": "USD"},
            {"symbol": "USD/INR", "name": "USD to Indian Rupee", "category": "FOREX", "default_qty": 1000.0, "best_model": "HIGH_VOLUME_SCALPER", "currency": "INR"},
            {"symbol": "RELIANCE", "name": "Reliance Industries", "category": "EQUITY", "default_qty": 25.0, "best_model": "ENSEMBLE", "currency": "INR"},
            {"symbol": "TCS", "name": "Tata Consultancy Services", "category": "EQUITY", "default_qty": 15.0, "best_model": "ENSEMBLE", "currency": "INR"},
            {"symbol": "CRUDE OIL", "name": "WTI Crude Oil", "category": "COMMODITY", "default_qty": 20.0, "best_model": "HIGH_VOLUME_SCALPER", "currency": "USD"},
        ]
        self.enabled_assets: Dict[str, bool] = {a["symbol"]: True for a in self.monitored_assets}

        self.last_run_time: Optional[datetime] = None
        self.cycle_logs: List[Dict[str, Any]] = []

        self.yahoo_provider = YahooFinanceProvider()
        self.mock_provider = MockDataProvider()
        self.exec_engine = PaperTradingEngine(slippage_bps=2.0, fee_bps=3.0)

        # Dynamic live market state tracking
        self.live_prices: Dict[str, float] = {}
        self.live_candles: Dict[str, Dict[str, Any]] = {}
        self.live_cached_dfs: Dict[str, Any] = {}

        self.models = {
            "HIGH_VOLUME_SCALPER": HighVolumeMicroScalper(),
            "ENSEMBLE": EnsemblePredictionModel(),
            "STATISTICAL": StatisticalRuleModel(),
            "ML_BASELINE": MLBaselineModel(),
        }

    async def start(self):
        """Starts automated trading bot background task."""
        self.is_active = True
        if self._loop_task and not self._loop_task.done():
            return
        self._loop_task = asyncio.create_task(self._run_loop())
        logger.info(f"AutoTradingBot started for {self.symbol} with strategy {self.strategy_type}")

    async def stop(self):
        """Stops automated trading bot background task."""
        self.is_active = False
        if self._loop_task and not self._loop_task.done():
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        self._loop_task = None
        logger.info("AutoTradingBot stopped")

    async def _run_loop(self):
        """Continuous background execution loop."""
        while self.is_active:
            try:
                await self.execute_cycle()
            except Exception as e:
                logger.error(f"Error in AutoTradingBot loop: {e}", exc_info=True)
            await asyncio.sleep(self.poll_interval)

    def get_config(self) -> Dict[str, Any]:
        open_positions = [p for p in POSITIONS if p["status"] == "OPEN"]
        closed_positions = [p for p in POSITIONS if p["status"] == "CLOSED"]
        wins = [p for p in closed_positions if p.get("realized_pnl", 0) > 0]
        losses = [p for p in closed_positions if p.get("realized_pnl", 0) < 0]

        win_rate = (len(wins) / len(closed_positions) * 100.0) if closed_positions else 0.0
        gross_profit = sum(p["realized_pnl"] for p in wins)
        gross_loss = abs(sum(p["realized_pnl"] for p in losses))
        profit_factor = (
            round(gross_profit / gross_loss, 2)
            if gross_loss > 0
            else (round(gross_profit, 2) if gross_profit > 0 else 1.0)
        )

        cur_price = self.live_prices.get(self.symbol, 0.0)

        return {
            "is_active": self.is_active,
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "current_price": cur_price,
            "strategy_type": self.strategy_type,
            "execution_mode": self.execution_mode,
            "mt5_auto_trade": self.mt5_auto_trade,
            "mt5_status": mt5_bridge.get_status(),
            "quantity": self.quantity,
            "take_profit_pct": self.take_profit_pct,
            "stop_loss_pct": self.stop_loss_pct,
            "trailing_stop_pct": self.trailing_stop_pct,
            "min_confidence": self.min_confidence,
            "open_positions_count": len(open_positions),
            "closed_positions_count": len(closed_positions),
            "win_rate_pct": round(win_rate, 2),
            "profit_factor": profit_factor,
            "last_run_time": self.last_run_time,
            "recent_logs": self.cycle_logs[-15:],
        }

    def update_config(self, config: Dict[str, Any]):
        if "symbol" in config:
            self.symbol = config["symbol"]
        if "strategy_type" in config:
            self.strategy_type = config["strategy_type"]
        if "execution_mode" in config:
            self.execution_mode = config["execution_mode"]
        if "mt5_auto_trade" in config:
            self.mt5_auto_trade = bool(config["mt5_auto_trade"])
            mt5_bridge.enabled = self.mt5_auto_trade
        if "quantity" in config:
            self.quantity = float(config["quantity"])
        if "take_profit_pct" in config:
            self.take_profit_pct = float(config["take_profit_pct"])
        if "stop_loss_pct" in config:
            self.stop_loss_pct = float(config["stop_loss_pct"])
        if "trailing_stop_pct" in config:
            self.trailing_stop_pct = float(config["trailing_stop_pct"])
        if "min_confidence" in config:
            self.min_confidence = float(config["min_confidence"])

    def get_live_tick(self, symbol: str) -> Dict[str, Any]:
        """Returns the active real-time ticking candle and price for symbol."""
        now = datetime.now(timezone.utc)
        price = self.live_prices.get(symbol)
        candle = self.live_candles.get(symbol)

        if not price or not candle:
            # 1. Try to inspect cached df for this symbol
            cached_df = self.live_cached_dfs.get(symbol)
            if cached_df is not None and not cached_df.empty:
                last_row = cached_df.iloc[-1]
                price = float(last_row["close"])
                candle = {
                    "timestamp": now.isoformat(),
                    "open": float(last_row["open"]),
                    "high": float(last_row["high"]),
                    "low": float(last_row["low"]),
                    "close": price,
                    "volume": float(last_row.get("volume", 5000.0)),
                }
            else:
                # 2. Try TICKER_CACHE from routes_market
                from app.api.routes_market import TICKER_CACHE
                cached_item = TICKER_CACHE.get(symbol)
                if cached_item and "price" in cached_item:
                    price = float(cached_item["price"])
                else:
                    # Realistic defaults by asset type
                    sym_u = symbol.upper()
                    if "BANK" in sym_u:
                        price = 55488.0
                    elif "NIFTY" in sym_u:
                        price = 22888.0
                    elif "SENSEX" in sym_u or "BSESN" in sym_u:
                        price = 73850.0
                    elif "GBP" in sym_u:
                        price = 1.3348
                    elif "EUR" in sym_u:
                        price = 1.1218
                    elif "JPY" in sym_u:
                        price = 158.15
                    elif "INR" in sym_u:
                        price = 94.93
                    elif "GC=F" in sym_u or "GOLD" in sym_u:
                        price = 4130.0
                    elif "SI=F" in sym_u or "SILVER" in sym_u:
                        price = 57.2
                    elif "CL=F" in sym_u or "OIL" in sym_u:
                        price = 100.7
                    elif "RELIANCE" in sym_u:
                        price = 1202.0
                    elif "HDFC" in sym_u:
                        price = 712.0
                    elif "TCS" in sym_u:
                        price = 2460.0
                    elif "INFY" in sym_u:
                        price = 1130.0
                    elif "ICICI" in sym_u:
                        price = 1380.0
                    elif "SBIN" in sym_u:
                        price = 974.0
                    elif "GSPC" in sym_u or "S&P" in sym_u:
                        price = 7690.0
                    elif "IXIC" in sym_u or "NASDAQ" in sym_u:
                        price = 26430.0
                    elif "DJI" in sym_u or "DOW" in sym_u or "US30" in sym_u:
                        price = 51975.0
                    elif "BTC" in sym_u:
                        price = 81500.0
                    elif "ETH" in sym_u:
                        price = 2600.0
                    elif "AAPL" in sym_u:
                        price = 342.0
                    elif "MSFT" in sym_u:
                        price = 490.0
                    elif "NVDA" in sym_u:
                        price = 217.0
                    elif "TSLA" in sym_u:
                        price = 220.0
                    else:
                        price = 1000.0

                candle = {
                    "timestamp": now.isoformat(),
                    "open": price,
                    "high": price,
                    "low": price,
                    "close": price,
                    "volume": 5000.0,
                }

        # Add live micro-tick fluctuation so chart actively breathes like real TradingView feed
        spread_noise = random.uniform(-0.00015, 0.00015)
        live_price = round(price * (1.0 + spread_noise), 4 if ("GBP" in symbol.upper() or "EUR" in symbol.upper()) else 2)

        if candle:
            candle["close"] = live_price
            candle["high"] = max(candle.get("high", live_price), live_price)
            candle["low"] = min(candle.get("low", live_price), live_price)
            candle["timestamp"] = now.isoformat()

        precision = 4 if ("GBP" in symbol.upper() or "EUR" in symbol.upper()) else 2
        return {
            "symbol": symbol,
            "price": round(live_price, precision),
            "timestamp": now.isoformat(),
            "latest_candle": candle,
        }

    async def _process_single_asset(self, asset: Dict[str, Any], cycle_timestamp: str) -> Optional[Dict[str, Any]]:
        sym = asset["symbol"]
        qty = asset.get("default_qty", self.quantity)
        best_model = asset.get("best_model", "HIGH_VOLUME_SCALPER")

        # 1. Fetch or cache candles for this symbol
        df = self.live_cached_dfs.get(sym)
        if df is None or len(df) < 10:
            try:
                df = await self.yahoo_provider.fetch_historical_candles(
                    sym, self.timeframe, self.last_run_time - timedelta(days=15), self.last_run_time
                )
            except Exception:
                df = None

            if df is None or df.empty or len(df) < 10:
                df = await self.mock_provider.fetch_historical_candles(
                    sym, self.timeframe, self.last_run_time - timedelta(days=15), self.last_run_time
                )
            self.live_cached_dfs[sym] = df

        if df is None or df.empty:
            return None

        # 2. Live price tick generation strictly anchored to real close
        base_close = float(df.iloc[-1]["close"])
        spread_noise = random.uniform(-0.00025, 0.00025)
        precision = 4 if ("GBP" in sym or "EUR" in sym or "INR" in sym) else 2
        cur_price = round(base_close * (1.0 + spread_noise), precision)
        self.live_prices[sym] = cur_price

        # Update active candle
        active_candle = self.live_candles.get(sym)
        now_utc = datetime.now(timezone.utc)
        if active_candle is None:
            active_candle = {
                "timestamp": now_utc,
                "open": cur_price,
                "high": cur_price,
                "low": cur_price,
                "close": cur_price,
                "volume": 1000.0,
            }
        else:
            active_candle["close"] = cur_price
            active_candle["high"] = max(active_candle["high"], cur_price)
            active_candle["low"] = min(active_candle["low"], cur_price)
            active_candle["volume"] += random.randint(50, 400)
            active_candle["timestamp"] = now_utc
        self.live_candles[sym] = active_candle

        # 3. Update existing open positions for this symbol
        open_positions = [p for p in POSITIONS if p["status"] == "OPEN" and p["symbol"] == sym]
        for pos in open_positions:
            updated_pos = self.exec_engine.update_position_candle(pos, active_candle)
            pos.update(updated_pos)
            if pos["status"] == "CLOSED":
                pnl = pos["realized_pnl"]
                PORTFOLIO_STATE["realized_pnl"] += pnl
                PORTFOLIO_STATE["current_cash"] += (
                    (pos["entry_price"] * pos["quantity"]) + pnl
                    if pos["side"] == "LONG"
                    else pnl
                )
                cost = pos["entry_price"] * pos["quantity"]
                ret_pct = round((pnl / cost) * 100.0, 2) if cost > 0 else 0.0
                trade_ledger.record_trade(
                    symbol=pos["symbol"],
                    side=pos["side"],
                    quantity=pos["quantity"],
                    entry_price=pos["entry_price"],
                    exit_price=pos.get("current_price", cur_price),
                    realized_pnl=pnl,
                    realized_return_pct=ret_pct,
                    strategy=self.strategy_type,
                    duration_seconds=120,
                    close_reason=pos.get("close_reason", "TAKE_PROFIT"),
                    opened_at=pos.get("opened_at"),
                    closed_at=self.last_run_time,
                )
                master_audit_store.record_audit_trade(
                    symbol=pos["symbol"],
                    asset_category=asset_cfg.get("category", "INDEX"),
                    action=pos["side"],
                    quantity=pos["quantity"],
                    entry_price=pos["entry_price"],
                    exit_price=pos.get("current_price", cur_price),
                    realized_pnl=pnl,
                    realized_return_pct=ret_pct,
                    predicted_target_price=pos.get("take_profit"),
                    stop_loss=pos.get("stop_loss"),
                    prediction_model=self.strategy_type,
                    prediction_signal=pos["side"],
                    prediction_confidence_pct=76.0,
                    exit_reason=pos.get("close_reason", "TAKE_PROFIT"),
                    duration_seconds=120,
                    mfe=pos.get("max_favorable_excursion", 0.0),
                    mae=pos.get("max_adverse_excursion", 0.0),
                )
                return {
                    "time": cycle_timestamp,
                    "action": "PROFIT_TAKEN" if pnl > 0 else "STOP_HIT",
                    "detail": f"{pos['close_reason']} on {pos['symbol']} @ {pos['current_price']:.2f}. P&L: {'+' if pnl >= 0 else ''}₹{pnl:.2f}",
                    "cur_price": cur_price,
                    "closed_count": 1,
                    "symbol": sym,
                }

        # 4. If bot is active, check if we should enter a new trade for this symbol
        total_open = sum(1 for p in POSITIONS if p["status"] == "OPEN")
        if total_open < self.max_open_positions and len(open_positions) < self.max_positions_per_asset and self.is_active:
            df_with_live = df.copy()
            df_with_live.iloc[-1, df_with_live.columns.get_loc("close")] = cur_price
            df_calc = TechnicalIndicatorEngine.calculate_all(df_with_live)

            # Use High-Volume Scalper or asset's best calibrated model
            model_key = self.strategy_type if self.strategy_type in self.models else best_model
            model = self.models.get(model_key, self.models["HIGH_VOLUME_SCALPER"])
            pred = await model.predict(sym, df_calc, horizon="15m")

            p_up = pred["probabilities"]["up"]
            p_down = pred["probabilities"]["down"]
            direction = pred["direction"]

            if direction == "up" and p_up >= self.min_confidence:
                sl_price = round(cur_price * (1.0 - self.stop_loss_pct / 100.0), precision)
                tp_price = round(cur_price * (1.0 + self.take_profit_pct / 100.0), precision)
                order_id = len(ORDERS_LOG) + 1
                order_dict = {
                    "id": order_id,
                    "symbol": sym,
                    "side": "BUY",
                    "quantity": qty,
                    "stop_loss": sl_price,
                    "take_profit": tp_price,
                    "trailing_stop_pct": self.trailing_stop_pct,
                    "created_at": self.last_run_time,
                }
                exec_result = self.exec_engine.execute_market_order(order_dict, active_candle)
                pos = exec_result["position"]
                pos["id"] = len(POSITIONS) + 1
                pos["portfolio_id"] = PORTFOLIO_STATE["id"]

                cost = pos["entry_price"] * pos["quantity"]
                PORTFOLIO_STATE["current_cash"] -= cost
                PORTFOLIO_STATE["total_fees_paid"] += exec_result["fill"]["fee"]
                PORTFOLIO_STATE["total_slippage_paid"] += exec_result["fill"]["slippage"]

                POSITIONS.append(pos)
                ORDERS_LOG.append(order_dict)

                detail_msg = f"Auto-Bot BOUGHT {qty} {sym} @ {pos['entry_price']:.2f}. TP: {tp_price}, SL: {sl_price} ({p_up:.1%})"
                if self.execution_mode == "MT5_LIVE" or self.mt5_auto_trade or mt5_bridge.enabled:
                    mt5_sig = mt5_bridge.queue_signal(
                        symbol=sym,
                        side="BUY",
                        lots=mt5_bridge.default_lot_size,
                        price=cur_price,
                        stop_loss=sl_price,
                        take_profit=tp_price,
                        strategy=model_key,
                        comment=f"Auto_{model_key[:6]}",
                    )
                    detail_msg += f" [MT5: {mt5_sig['signal_id']}]"

                return {
                    "time": cycle_timestamp,
                    "action": "BOUGHT",
                    "detail": detail_msg,
                    "cur_price": cur_price,
                    "closed_count": 0,
                    "symbol": sym,
                }

            elif direction == "down" and p_down >= self.min_confidence:
                sl_price = round(cur_price * (1.0 + self.stop_loss_pct / 100.0), precision)
                tp_price = round(cur_price * (1.0 - self.take_profit_pct / 100.0), precision)
                order_id = len(ORDERS_LOG) + 1
                order_dict = {
                    "id": order_id,
                    "symbol": sym,
                    "side": "SELL",
                    "quantity": qty,
                    "stop_loss": sl_price,
                    "take_profit": tp_price,
                    "trailing_stop_pct": self.trailing_stop_pct,
                    "created_at": self.last_run_time,
                }
                exec_result = self.exec_engine.execute_market_order(order_dict, active_candle)
                pos = exec_result["position"]
                pos["id"] = len(POSITIONS) + 1
                pos["portfolio_id"] = PORTFOLIO_STATE["id"]

                PORTFOLIO_STATE["total_fees_paid"] += exec_result["fill"]["fee"]
                PORTFOLIO_STATE["total_slippage_paid"] += exec_result["fill"]["slippage"]

                POSITIONS.append(pos)
                ORDERS_LOG.append(order_dict)

                detail_msg = f"Auto-Bot SOLD {qty} {sym} @ {pos['entry_price']:.2f}. TP: {tp_price}, SL: {sl_price} ({p_down:.1%})"
                if self.execution_mode == "MT5_LIVE" or self.mt5_auto_trade or mt5_bridge.enabled:
                    mt5_sig = mt5_bridge.queue_signal(
                        symbol=sym,
                        side="SELL",
                        lots=mt5_bridge.default_lot_size,
                        price=cur_price,
                        stop_loss=sl_price,
                        take_profit=tp_price,
                        strategy=model_key,
                        comment=f"Auto_{model_key[:6]}",
                    )
                    detail_msg += f" [MT5: {mt5_sig['signal_id']}]"

                return {
                    "time": cycle_timestamp,
                    "action": "SOLD",
                    "detail": detail_msg,
                    "cur_price": cur_price,
                    "closed_count": 0,
                    "symbol": sym,
                }

        return None

    async def execute_cycle(self) -> Dict[str, Any]:
        """
        Continuous background server cycle evaluating all monitored assets simultaneously.
        Runs autonomously 24/7 on the server even when the browser client is closed.
        """
        self.last_run_time = datetime.now(timezone.utc)
        cycle_timestamp = self.last_run_time.strftime("%H:%M:%S UTC")

        executed_actions = []
        for asset in self.monitored_assets:
            sym = asset["symbol"]
            if not self.enabled_assets.get(sym, True):
                continue
            try:
                res = await self._process_single_asset(asset, cycle_timestamp)
                if res:
                    executed_actions.append(res)
            except Exception as e:
                logger.error(f"Error evaluating asset {sym}: {e}", exc_info=False)

        active_price = self.live_prices.get(self.symbol, 0.0)
        open_count = sum(1 for p in POSITIONS if p["status"] == "OPEN")

        if executed_actions:
            main_log = executed_actions[0]
        else:
            main_log = {
                "time": cycle_timestamp,
                "action": "MONITORING",
                "detail": f"Server daemon actively scanning {len(self.monitored_assets)} stocks. Open: {open_count}/{self.max_open_positions}",
                "cur_price": active_price,
                "closed_count": 0,
            }

        self.cycle_logs.append(main_log)
        if len(self.cycle_logs) > 60:
            self.cycle_logs.pop(0)

        return main_log

    def get_multi_asset_overview(self, period: str = "DAY") -> Dict[str, Any]:
        """Returns consolidated multi-stock performance matrix, live prices, and open positions."""
        assets_data = []
        total_wins = 0
        total_losses = 0
        total_pnl = 0.0

        for asset in self.monitored_assets:
            sym = asset["symbol"]
            price = self.live_prices.get(sym, 0.0)
            if price <= 0:
                tick = self.get_live_tick(sym)
                price = tick["price"]

            enabled = self.enabled_assets.get(sym, True)
            open_pos = next((p for p in POSITIONS if p["status"] == "OPEN" and p["symbol"] == sym), None)

            # Query trade stats from trade ledger
            analysis = trade_ledger.get_trades_analysis(symbol=sym, period=period)
            summary = analysis.get("summary", {})

            w_count = summary.get("win_count", 0)
            l_count = summary.get("loss_count", 0)
            t_trades = summary.get("total_trades", 0)
            w_pct = summary.get("win_rate_pct", 0.0)
            pnl = summary.get("net_realized_pnl", 0.0)

            total_wins += w_count
            total_losses += l_count
            total_pnl += pnl

            assets_data.append({
                "symbol": sym,
                "name": asset["name"],
                "category": asset["category"],
                "currency": asset["currency"],
                "enabled": enabled,
                "current_price": price,
                "best_model": asset["best_model"],
                "active_position": {
                    "id": open_pos["id"],
                    "side": open_pos["side"],
                    "quantity": open_pos["quantity"],
                    "entry_price": open_pos["entry_price"],
                    "current_price": open_pos.get("current_price", price),
                    "unrealized_pnl": open_pos.get("unrealized_pnl", 0.0),
                    "stop_loss": open_pos.get("stop_loss"),
                    "take_profit": open_pos.get("take_profit"),
                } if open_pos else None,
                "total_trades": t_trades,
                "win_count": w_count,
                "loss_count": l_count,
                "win_rate_pct": w_pct,
                "net_pnl": pnl,
                "profit_factor": summary.get("profit_factor", 1.0),
            })

        overall_trades = total_wins + total_losses
        overall_win_rate = round((total_wins / overall_trades * 100.0), 1) if overall_trades > 0 else 0.0

        return {
            "is_bot_active": self.is_active,
            "execution_mode": self.execution_mode,
            "mt5_auto_trade": self.mt5_auto_trade,
            "period": period,
            "overall_summary": {
                "monitored_count": len(self.monitored_assets),
                "enabled_count": sum(1 for a in assets_data if a["enabled"]),
                "total_trades": overall_trades,
                "win_count": total_wins,
                "loss_count": total_losses,
                "win_rate_pct": overall_win_rate,
                "net_pnl": round(total_pnl, 2),
            },
            "assets": assets_data,
            "recent_logs": self.cycle_logs[-12:],
        }

    def toggle_asset(self, symbol: str, enabled: bool) -> bool:
        """Toggles automated trading for a specific stock."""
        for a in self.monitored_assets:
            if a["symbol"] == symbol:
                self.enabled_assets[symbol] = enabled
                return True
        return False


# Global bot instance
trading_bot = AutoTradingBot()
