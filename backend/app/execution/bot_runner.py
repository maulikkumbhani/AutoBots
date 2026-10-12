from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import asyncio
import logging
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
    Monitors live or historical replay candles, computes quantitative indicators,
    evaluates strategy conviction, and automatically executes BUY/SELL orders
    with calibrated Stop-Loss and Take-Profit rules to maximize risk-adjusted alpha.
    """

    def __init__(self):
        self.is_active = False
        self.symbol = "NIFTY 50"
        self.timeframe = "15m"
        self.strategy_type = "ENSEMBLE"  # ENSEMBLE, STATISTICAL, ML_BASELINE
        self.quantity = 50.0
        self.take_profit_pct = 1.0       # 1.0% target
        self.stop_loss_pct = 0.5         # 0.5% stop loss (2:1 Reward to Risk)
        self.trailing_stop_pct = 0.35    # Trailing stop
        self.min_confidence = 0.44       # Minimum directional probability to trade
        self.max_open_positions = 2

        self.last_run_time: Optional[datetime] = None
        self.cycle_logs: List[Dict[str, Any]] = []
        self.total_trades_count = 0
        self.winning_trades_count = 0

        self.yahoo_provider = YahooFinanceProvider()
        self.mock_provider = MockDataProvider()
        self.exec_engine = PaperTradingEngine(slippage_bps=2.0, fee_bps=3.0)

        self.models = {
            "ENSEMBLE": EnsemblePredictionModel(),
            "STATISTICAL": StatisticalRuleModel(),
            "ML_BASELINE": MLBaselineModel(),
        }

    def get_config(self) -> Dict[str, Any]:
        open_positions = [p for p in POSITIONS if p["status"] == "OPEN"]
        closed_positions = [p for p in POSITIONS if p["status"] == "CLOSED"]
        wins = [p for p in closed_positions if p.get("realized_pnl", 0) > 0]
        losses = [p for p in closed_positions if p.get("realized_pnl", 0) < 0]

        win_rate = (len(wins) / len(closed_positions) * 100.0) if closed_positions else 0.0
        gross_profit = sum(p["realized_pnl"] for p in wins)
        gross_loss = abs(sum(p["realized_pnl"] for p in losses))
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (round(gross_profit, 2) if gross_profit > 0 else 1.0)

        return {
            "is_active": self.is_active,
            "symbol": self.symbol,
            "timeframe": self.timeframe,
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
            "recent_logs": self.cycle_logs[-10:],
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

    async def execute_cycle(self) -> Dict[str, Any]:
        """
        Executes one full automated bot intelligence cycle:
        1. Fetch candles & calculate indicators.
        2. Update & evaluate open positions against latest market price.
        3. If capacity allows, predict market direction & execute automated trade.
        """
        self.last_run_time = datetime.now(timezone.utc)
        cycle_timestamp = self.last_run_time.strftime("%Y-%m-%d %H:%M:%S UTC")

        # 1. Fetch candles
        try:
            df = await self.yahoo_provider.fetch_historical_candles(
                self.symbol, self.timeframe, self.last_run_time, self.last_run_time
            )
            if df.empty or len(df) < 20:
                df = await self.mock_provider.fetch_historical_candles(
                    self.symbol, self.timeframe, self.last_run_time, self.last_run_time
                )
        except Exception:
            df = await self.mock_provider.fetch_historical_candles(
                self.symbol, self.timeframe, self.last_run_time, self.last_run_time
            )

        if df.empty:
            log_entry = {"time": cycle_timestamp, "action": "NO_DATA", "detail": "No market candles available"}
            self.cycle_logs.append(log_entry)
            return log_entry

        # 2. Compute technical indicators
        df_calc = TechnicalIndicatorEngine.calculate_all(df)
        last_candle = df_calc.iloc[-1].to_dict()
        cur_price = float(last_candle["close"])

        # 3. Update existing open positions for this symbol
        open_positions = [p for p in POSITIONS if p["status"] == "OPEN" and p["symbol"] == self.symbol]
        closed_this_cycle = []
        for pos in open_positions:
            updated_pos = self.exec_engine.update_position_candle(pos, last_candle)
            # Update in place
            pos.update(updated_pos)
            if pos["status"] == "CLOSED":
                closed_this_cycle.append(pos)
                PORTFOLIO_STATE["realized_pnl"] += pos["realized_pnl"]
                PORTFOLIO_STATE["current_cash"] += (
                    (pos["entry_price"] * pos["quantity"]) + pos["realized_pnl"]
                    if pos["side"] == "LONG"
                    else pos["realized_pnl"]
                )

        # 4. Check if we should open a new trade
        open_count = sum(1 for p in POSITIONS if p["status"] == "OPEN")
        action_taken = "MONITORING"
        detail_msg = f"Price at {cur_price:.2f}. Open positions: {open_count}/{self.max_open_positions}"

        if open_count < self.max_open_positions and self.is_active:
            # Generate quantitative prediction
            model = self.models.get(self.strategy_type, self.models["ENSEMBLE"])
            pred = await model.predict(self.symbol, df_calc, horizon="60m")
            
            p_up = pred["probabilities"]["up"]
            p_down = pred["probabilities"]["down"]
            direction = pred["direction"]

            # Signal evaluation
            if direction == "up" and p_up >= self.min_confidence:
                # BUY Signal
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
                exec_result = self.exec_engine.execute_market_order(order_dict, last_candle)
                pos = exec_result["position"]
                pos["id"] = len(POSITIONS) + 1
                pos["portfolio_id"] = PORTFOLIO_STATE["id"]

                # Cash deduction
                cost = pos["entry_price"] * pos["quantity"]
                PORTFOLIO_STATE["current_cash"] -= cost
                PORTFOLIO_STATE["total_fees_paid"] += exec_result["fill"]["fee"]
                PORTFOLIO_STATE["total_slippage_paid"] += exec_result["fill"]["slippage"]

                POSITIONS.append(pos)
                ORDERS_LOG.append(order_dict)

                action_taken = "BOUGHT"
                detail_msg = (
                    f"Auto-Bot BOUGHT {self.quantity} {self.symbol} @ {pos['entry_price']:.2f}. "
                    f"SL: {sl_price}, TP: {tp_price}. Confidence: {p_up:.1%}"
                )

            elif direction == "down" and p_down >= self.min_confidence:
                # SELL / Short Signal
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
                exec_result = self.exec_engine.execute_market_order(order_dict, last_candle)
                pos = exec_result["position"]
                pos["id"] = len(POSITIONS) + 1
                pos["portfolio_id"] = PORTFOLIO_STATE["id"]

                PORTFOLIO_STATE["total_fees_paid"] += exec_result["fill"]["fee"]
                PORTFOLIO_STATE["total_slippage_paid"] += exec_result["fill"]["slippage"]

                POSITIONS.append(pos)
                ORDERS_LOG.append(order_dict)

                action_taken = "SOLD"
                detail_msg = (
                    f"Auto-Bot SOLD {self.quantity} {self.symbol} @ {pos['entry_price']:.2f}. "
                    f"SL: {sl_price}, TP: {tp_price}. Confidence: {p_down:.1%}"
                )

        log_entry = {
            "time": cycle_timestamp,
            "action": action_taken,
            "detail": detail_msg,
            "cur_price": cur_price,
            "closed_count": len(closed_this_cycle),
        }
        self.cycle_logs.append(log_entry)
        if len(self.cycle_logs) > 50:
            self.cycle_logs.pop(0)

        return log_entry


# Global bot instance
trading_bot = AutoTradingBot()
