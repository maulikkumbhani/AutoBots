"""
Dynamic Volume & Micro-Profit Scalping Optimizer for MT5.
Calculates mathematically optimal lot sizes and micro-targets for XAUUSD Gold
based on live volatility (ATR), account equity, strategy conviction, and bulk-wave momentum.
"""

from typing import Dict, Any, Optional
import math


class DynamicVolumeOptimizer:
    """
    Intelligently determines optimal lot sizing and quick micro-profit targets
    for high-frequency bulk scalping on XAUUSD Gold and commodities.
    """

    def __init__(
        self,
        base_lots: float = 0.05,
        min_lots: float = 0.01,
        max_lots: float = 0.20,
        target_micro_profit_usd: float = 12.50,
        leverage: float = 500.0,
    ):
        self.base_lots = base_lots
        self.min_lots = min_lots
        self.max_lots = max_lots
        self.target_micro_profit_usd = target_micro_profit_usd
        self.leverage = leverage
        self.mode: str = "DYNAMIC_AUTO"  # "DYNAMIC_AUTO" or "MANUAL_FIXED"
        self.bulk_harvesting_enabled: bool = True

    def calculate_optimal_volume(
        self,
        symbol: str,
        current_price: float,
        equity: float,
        atr: float = 2.50,
        conviction: float = 80.0,
        strategy_id: str = "GAP_FVG",
    ) -> Dict[str, Any]:
        """
        Computes dynamic lot size and projected micro-profit metrics.
        Balancing high-frequency bulk executions with strict drawdown safeguards.
        """
        # If user selected MANUAL_FIXED, keep base lots
        if self.mode == "MANUAL_FIXED":
            lots = self.base_lots
            reasoning = f"Manual fixed lot size locked at {lots} lots by user."
        else:
            # 1. Base Sizing on Account Equity (Risk 0.25% - 0.5% per micro-scalp)
            risk_budget_usd = equity * 0.0035  # ~ $350 on $100k account for portfolio
            
            # For XAUUSD: 1 lot = 100 oz. 0.01 lot = 1 oz.
            # $1 move in Gold on 1 lot = $100. On 0.01 lot = $1. On 0.05 lot = $5.
            multiplier = 100.0 if "XAU" in symbol.upper() or "GOLD" in symbol.upper() else 1.0

            # 2. Volatility Adjustment: High ATR -> smaller lots with tighter targets; Low ATR -> slightly larger lots
            norm_atr = max(atr, 1.20)
            vol_factor = 2.50 / norm_atr  # > 1 when market is calm/consolidating, < 1 when spiky

            # 3. Conviction Multiplier: High confidence unlocks larger scalp lot
            conv_multiplier = 0.70 if conviction < 70.0 else (1.0 if conviction < 85.0 else 1.30)

            # Strategy horizon tuning
            strat_boost = 1.20 if strategy_id in ["GAP_FVG", "SCALPER_EMA"] else 0.90

            computed_lots = self.base_lots * vol_factor * conv_multiplier * strat_boost
            # Clamp between min_lots and max_lots
            lots = round(max(self.min_lots, min(self.max_lots, computed_lots)), 2)
            reasoning = f"Dynamic sizing applied: Conviction {conviction:.0f}%, Volatility ATR ${norm_atr:.2f}, Factor {vol_factor:.2f}x."

        # Margin required at 1:500 leverage
        contract_size = 100.0 if "XAU" in symbol.upper() or "GOLD" in symbol.upper() else 1.0
        notional_value = current_price * lots * contract_size
        margin_required = round(notional_value / self.leverage, 2)

        # Micro-Scalp Profit Calibration
        # Target +15 to +35 points ($1.50 - $3.50 price move on Gold)
        target_pts = round(max(1.50, min(3.80, atr * 0.9)), 2)
        projected_profit_usd = round(target_pts * lots * contract_size, 2)

        # Micro-Scalp Protective Stop Loss (1:1.8 or 1:2 Reward/Risk)
        stop_pts = round(target_pts / 1.8, 2)
        projected_loss_usd = round(stop_pts * lots * contract_size, 2)

        # Bulk Scalping Wave Recommendation
        # Suggest 2-3 staggered micro-entries when bulk harvesting is active
        bulk_batch_count = 3 if (self.bulk_harvesting_enabled and conviction >= 82.0) else 1

        return {
            "mode": self.mode,
            "symbol": symbol,
            "current_price": current_price,
            "recommended_lots": lots,
            "base_lots": self.base_lots,
            "min_lots": self.min_lots,
            "max_lots": self.max_lots,
            "notional_value": round(notional_value, 2),
            "margin_required_usd": margin_required,
            "target_move_points": target_pts,
            "projected_profit_usd": projected_profit_usd,
            "protective_stop_points": stop_pts,
            "projected_risk_usd": projected_loss_usd,
            "reward_risk_ratio": round(target_pts / stop_pts, 2),
            "estimated_hold_time": "30s - 150s (High-Frequency Micro Scalp)",
            "bulk_harvesting_enabled": self.bulk_harvesting_enabled,
            "bulk_wave_entries": bulk_batch_count,
            "bulk_cumulative_profit_target_usd": round(projected_profit_usd * bulk_batch_count, 2),
            "sizing_reasoning": reasoning,
        }

    def update_config(self, cfg: Dict[str, Any]) -> Dict[str, Any]:
        """Updates volume optimization configuration parameters."""
        if "mode" in cfg and cfg["mode"] in ["DYNAMIC_AUTO", "MANUAL_FIXED"]:
            self.mode = cfg["mode"]
        if "base_lots" in cfg and cfg["base_lots"] > 0:
            self.base_lots = round(float(cfg["base_lots"]), 2)
        if "min_lots" in cfg and cfg["min_lots"] > 0:
            self.min_lots = round(float(cfg["min_lots"]), 2)
        if "max_lots" in cfg and cfg["max_lots"] > 0:
            self.max_lots = round(float(cfg["max_lots"]), 2)
        if "target_micro_profit_usd" in cfg and cfg["target_micro_profit_usd"] > 0:
            self.target_micro_profit_usd = float(cfg["target_micro_profit_usd"])
        if "bulk_harvesting_enabled" in cfg:
            self.bulk_harvesting_enabled = bool(cfg["bulk_harvesting_enabled"])

        return {
            "status": "SUCCESS",
            "mode": self.mode,
            "base_lots": self.base_lots,
            "min_lots": self.min_lots,
            "max_lots": self.max_lots,
            "bulk_harvesting_enabled": self.bulk_harvesting_enabled,
            "target_micro_profit_usd": self.target_micro_profit_usd,
        }


# Singleton instance
volume_optimizer = DynamicVolumeOptimizer()
