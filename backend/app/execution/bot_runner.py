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

logger = logging.getLogger(__name__)


class AutoTradingBot:
    """
    Automated algorithmic trading bot engine.
    Continuously monitors live/replay candles, simulates realistic micro-ticks,
    computes quantitative indicators, evaluates strategy conviction,
    and automatically executes BUY/SELL orders with calibrated SL/TP rules.
    """

    def __init__(self):
        self.is_active = False
        self._loop_task: Optional[asyncio.Task] = None
        self.poll_interval = 3.5  # Run cycle every 3.5 seconds

        self.symbol = "NIFTY 50"
        self.timeframe = "15m"
        self.strategy_type = "ENSEMBLE"  # ENSEMBLE, STATISTICAL, ML_BASELINE
        self.quantity = 50.0
        self.take_profit_pct = 0.8       # 0.8% target for responsive intraday profit realization
        self.stop_loss_pct = 0.4         # 0.4% stop loss (2:1 Reward:Risk)
        self.trailing_stop_pct = 0.25    # 0.25% trailing stop
        self.min_confidence = 0.40       # Minimum directional probability to trade
        self.max_open_positions = 3

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
            "ENSEMBLE": EnsemblePredictionModel(),
            "STATISTICAL": StatisticalRuleModel(),
            "ML_BASELINE": MLBaselineModel(),
        }

    async def start(self):
        """Starts automated trading bot background task."""
        if self.is_active:
            return
        self.is_active = True
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
            # Anchor to real market close
            default_p = 22363.35 if "NIFTY" in symbol else (54918.0 if "BANK" in symbol else 100.0)
            price = default_p
            candle = {
                "timestamp": now.isoformat(),
                "open": default_p,
                "high": default_p,
                "low": default_p,
                "close": default_p,
                "volume": 5000.0,
            }

        return {
            "symbol": symbol,
            "price": round(price, 2),
            "timestamp": now.isoformat(),
            "latest_candle": candle,
        }

    async def execute_cycle(self) -> Dict[str, Any]:
        """
        Executes one full automated bot cycle:
        1. Fetches latest candles or uses cached live df.
        2. Simulates realistic market micro-tick movements anchored to real close.
        3. Updates all open positions, triggers SL, TP, Trailing Stop.
        4. Evaluates strategy signals and places new orders automatically.
        """
        self.last_run_time = datetime.now(timezone.utc)
        cycle_timestamp = self.last_run_time.strftime("%H:%M:%S UTC")

        # 1. Fetch or cache candles
        df = self.live_cached_dfs.get(self.symbol)
        if df is None or len(df) < 10:
            try:
                df = await self.yahoo_provider.fetch_historical_candles(
                    self.symbol, self.timeframe, self.last_run_time - timedelta(days=15), self.last_run_time
                )
            except Exception:
                df = None

            if df is None or df.empty or len(df) < 10:
                df = await self.mock_provider.fetch_historical_candles(
                    self.symbol, self.timeframe, self.last_run_time - timedelta(days=15), self.last_run_time
                )
            self.live_cached_dfs[self.symbol] = df

        if df.empty:
            log_entry = {"time": cycle_timestamp, "action": "NO_DATA", "detail": "Waiting for market feed..."}
            self.cycle_logs.append(log_entry)
            return log_entry

        # 2. Live price tick generation:
        # Strictly anchored to real market close from latest candle
        base_close = float(df.iloc[-1]["close"])

        # Micro-fluctuation around base_close (mean-reverting tiny spread variation)
        # Prevents runaway drift while providing responsive live ticking
        spread_noise = random.uniform(-0.0003, 0.0003)
        cur_price = round(base_close * (1.0 + spread_noise), 2)
        self.live_prices[self.symbol] = cur_price

        # Update active candle
        active_candle = self.live_candles.get(self.symbol)
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

        self.live_candles[self.symbol] = active_candle

        # 3. Update existing open positions for this symbol
        open_positions = [p for p in POSITIONS if p["status"] == "OPEN" and p["symbol"] == self.symbol]
        closed_this_cycle = []
        for pos in open_positions:
            updated_pos = self.exec_engine.update_position_candle(pos, active_candle)
            pos.update(updated_pos)
            if pos["status"] == "CLOSED":
                closed_this_cycle.append(pos)
                pnl = pos["realized_pnl"]
                PORTFOLIO_STATE["realized_pnl"] += pnl
                PORTFOLIO_STATE["current_cash"] += (
                    (pos["entry_price"] * pos["quantity"]) + pnl
                    if pos["side"] == "LONG"
                    else pnl
                )
                self.cycle_logs.append({
                    "time": cycle_timestamp,
                    "action": "PROFIT_TAKEN" if pnl > 0 else "STOP_HIT",
                    "detail": f"{pos['close_reason']} on {pos['symbol']} @ {pos['current_price']:.2f}. Realized P&L: {'+' if pnl >= 0 else ''}₹{pnl:.2f}",
                    "cur_price": cur_price,
                })

        # 4. Check if bot is active and should open a new trade
        open_count = sum(1 for p in POSITIONS if p["status"] == "OPEN")
        action_taken = "MONITORING"
        detail_msg = f"Live Tick: ₹{cur_price:.2f}. Open Positions: {open_count}/{self.max_open_positions}"

        if open_count < self.max_open_positions and self.is_active:
            # Calculate indicators on past candles + live bar
            df_with_live = df.copy()
            # Replace last row close with current price
            df_with_live.iloc[-1, df_with_live.columns.get_loc("close")] = cur_price
            df_calc = TechnicalIndicatorEngine.calculate_all(df_with_live)

            # Query strategy model
            model = self.models.get(self.strategy_type, self.models["ENSEMBLE"])
            pred = await model.predict(self.symbol, df_calc, horizon="60m")

            p_up = pred["probabilities"]["up"]
            p_down = pred["probabilities"]["down"]
            direction = pred["direction"]

            # Evaluate execution trigger
            if direction == "up" and p_up >= self.min_confidence:
                # BUY Order
                sl_price = round(cur_price * (1.0 - self.stop_loss_pct / 100.0), 2)
                tp_price = round(cur_price * (1.0 + self.take_profit_pct / 100.0), 2)

                order_id = len(ORDERS_LOG) + 1
                order_dict = {
                    "id": order_id,
                    "symbol": self.symbol,
                    "side": "BUY",
                    "quantity": self.quantity,
                    "stop_loss": sl_price,
                    "take_profit": tp_price,
                    "trailing_stop_pct": self.trailing_stop_pct,
                    "created_at": self.last_run_time,
                }
                exec_result = self.exec_engine.execute_market_order(order_dict, active_candle)
                pos = exec_result["position"]
                pos["id"] = len(POSITIONS) + 1
                pos["portfolio_id"] = PORTFOLIO_STATE["id"]

                # Deduct cash & fees
                cost = pos["entry_price"] * pos["quantity"]
                PORTFOLIO_STATE["current_cash"] -= cost
                PORTFOLIO_STATE["total_fees_paid"] += exec_result["fill"]["fee"]
                PORTFOLIO_STATE["total_slippage_paid"] += exec_result["fill"]["slippage"]

                POSITIONS.append(pos)
                ORDERS_LOG.append(order_dict)

                action_taken = "BOUGHT"
                detail_msg = (
                    f"Auto-Bot BOUGHT {self.quantity} {self.symbol} @ ₹{pos['entry_price']:.2f}. "
                    f"TP: ₹{tp_price} (+{self.take_profit_pct}%), SL: ₹{sl_price} (-{self.stop_loss_pct}%). Conviction: {p_up:.1%}"
                )

            elif direction == "down" and p_down >= self.min_confidence:
                # SHORT / SELL Order
                sl_price = round(cur_price * (1.0 + self.stop_loss_pct / 100.0), 2)
                tp_price = round(cur_price * (1.0 - self.take_profit_pct / 100.0), 2)

                order_id = len(ORDERS_LOG) + 1
                order_dict = {
                    "id": order_id,
                    "symbol": self.symbol,
                    "side": "SELL",
                    "quantity": self.quantity,
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

                action_taken = "SOLD"
                detail_msg = (
                    f"Auto-Bot SOLD {self.quantity} {self.symbol} @ ₹{pos['entry_price']:.2f}. "
                    f"TP: ₹{tp_price} (-{self.take_profit_pct}%), SL: ₹{sl_price} (+{self.stop_loss_pct}%). Conviction: {p_down:.1%}"
                )

        log_entry = {
            "time": cycle_timestamp,
            "action": action_taken,
            "detail": detail_msg,
            "cur_price": cur_price,
            "closed_count": len(closed_this_cycle),
        }
        self.cycle_logs.append(log_entry)
        if len(self.cycle_logs) > 60:
            self.cycle_logs.pop(0)

        return log_entry


# Global bot instance
trading_bot = AutoTradingBot()
