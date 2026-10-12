from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import pytz


class PaperTradingEngine:
    """
    Automated Simulated Paper Execution Engine.
    Implements conservative intra-candle execution rules (SL prior to TP on collision),
    realistic slippage, exchange fees, trailing stops, and MFE/MAE tracking.
    """

    def __init__(
        self,
        slippage_bps: float = 2.0,
        fee_bps: float = 3.0,
        conservative_collision_rule: bool = True,
    ):
        self.slippage_bps = slippage_bps
        self.fee_bps = fee_bps
        self.conservative_collision_rule = conservative_collision_rule

    def calculate_cost(self, price: float, quantity: float) -> Tuple[float, float]:
        """Calculates (slippage_cost, fee_cost) based on basis points."""
        notional = price * quantity
        slippage = notional * (self.slippage_bps / 10000.0)
        fee = notional * (self.fee_bps / 10000.0)
        return round(slippage, 2), round(fee, 2)

    def execute_market_order(
        self,
        order_dict: Dict[str, Any],
        current_candle: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Executes simulated market order against current market price.
        Applies slippage unfavorably to entry price.
        """
        symbol = order_dict["symbol"]
        side = order_dict["side"].upper()  # BUY or SELL
        quantity = order_dict["quantity"]
        raw_price = current_candle["close"]

        slippage, fee = self.calculate_cost(raw_price, quantity)
        # Unfavorable slippage
        fill_price = raw_price + (slippage / quantity if side == "BUY" else -slippage / quantity)

        fill_time = current_candle.get("timestamp", datetime.now(timezone.utc))

        fill = {
            "symbol": symbol,
            "side": side,
            "fill_price": round(fill_price, 2),
            "quantity": quantity,
            "slippage": slippage,
            "fee": fee,
            "fill_time": fill_time,
        }

        position = {
            "symbol": symbol,
            "side": "LONG" if side == "BUY" else "SHORT",
            "quantity": quantity,
            "entry_price": round(fill_price, 2),
            "current_price": round(fill_price, 2),
            "stop_loss": order_dict.get("stop_loss"),
            "take_profit": order_dict.get("take_profit"),
            "trailing_stop_pct": order_dict.get("trailing_stop_pct"),
            "peak_price": round(fill_price, 2),
            "trough_price": round(fill_price, 2),
            "unrealized_pnl": -fee - slippage,
            "realized_pnl": 0.0,
            "max_favorable_excursion": 0.0,
            "max_adverse_excursion": 0.0,
            "status": "OPEN",
            "opened_at": fill_time,
            "closed_at": None,
            "close_reason": None,
        }

        return {"fill": fill, "position": position}

    def update_position_candle(
        self,
        pos: Dict[str, Any],
        candle: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Processes subsequent candle for open position:
        Checks SL, TP, Trailing Stop, updates MFE/MAE.
        """
        if pos["status"] != "OPEN":
            return pos

        pos = dict(pos)
        high = float(candle["high"])
        low = float(candle["low"])
        close = float(candle["close"])
        candle_time = candle.get("timestamp", datetime.now(timezone.utc))

        side = pos["side"]
        entry = pos["entry_price"]
        qty = pos["quantity"]
        sl = pos.get("stop_loss")
        tp = pos.get("take_profit")
        trail_pct = pos.get("trailing_stop_pct")

        # Update peak / trough
        if high > pos["peak_price"]:
            pos["peak_price"] = high
        if low < pos["trough_price"]:
            pos["trough_price"] = low

        # Trailing Stop dynamic adjustment
        if trail_pct is not None and trail_pct > 0:
            if side == "LONG":
                trailed_sl = pos["peak_price"] * (1.0 - trail_pct / 100.0)
                if sl is None or trailed_sl > sl:
                    pos["stop_loss"] = round(trailed_sl, 2)
                    sl = pos["stop_loss"]
            elif side == "SHORT":
                trailed_sl = pos["trough_price"] * (1.0 + trail_pct / 100.0)
                if sl is None or trailed_sl < sl:
                    pos["stop_loss"] = round(trailed_sl, 2)
                    sl = pos["stop_loss"]

        # Check triggers
        hit_sl = False
        hit_tp = False

        if side == "LONG":
            hit_sl = sl is not None and low <= sl
            hit_tp = tp is not None and high >= tp
            
            # Conservative collision rule: if both hit in the same bar, assume SL triggered first!
            if hit_sl and hit_tp and self.conservative_collision_rule:
                exit_price = sl
                exit_reason = "STOP_LOSS_COLLISION"
                is_closed = True
            elif hit_sl:
                exit_price = sl
                exit_reason = "STOP_LOSS"
                is_closed = True
            elif hit_tp:
                exit_price = tp
                exit_reason = "TAKE_PROFIT"
                is_closed = True
            else:
                is_closed = False
                pos["current_price"] = close
                pos["unrealized_pnl"] = round((close - entry) * qty, 2)

            # MFE & MAE
            pos["max_favorable_excursion"] = round(max(0.0, (pos["peak_price"] - entry) * qty), 2)
            pos["max_adverse_excursion"] = round(max(0.0, (entry - pos["trough_price"]) * qty), 2)

        else:  # SHORT
            hit_sl = sl is not None and high >= sl
            hit_tp = tp is not None and low <= tp

            if hit_sl and hit_tp and self.conservative_collision_rule:
                exit_price = sl
                exit_reason = "STOP_LOSS_COLLISION"
                is_closed = True
            elif hit_sl:
                exit_price = sl
                exit_reason = "STOP_LOSS"
                is_closed = True
            elif hit_tp:
                exit_price = tp
                exit_reason = "TAKE_PROFIT"
                is_closed = True
            else:
                is_closed = False
                pos["current_price"] = close
                pos["unrealized_pnl"] = round((entry - close) * qty, 2)

            pos["max_favorable_excursion"] = round(max(0.0, (entry - pos["trough_price"]) * qty), 2)
            pos["max_adverse_excursion"] = round(max(0.0, (pos["peak_price"] - entry) * qty), 2)

        if is_closed:
            slip, fee = self.calculate_cost(exit_price, qty)
            gross_pnl = (exit_price - entry) * qty if side == "LONG" else (entry - exit_price) * qty
            net_pnl = gross_pnl - slip - fee

            pos["status"] = "CLOSED"
            pos["closed_at"] = candle_time
            pos["close_reason"] = exit_reason
            pos["current_price"] = exit_price
            pos["realized_pnl"] = round(net_pnl, 2)
            pos["unrealized_pnl"] = 0.0

        return pos
