from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from app.core.database import Base


class MT5TradeRecord(Base):
    """
    Persistent SQLite database model for all executed MT5 trades,
    scalp orders, and closed trade outcomes with microsecond tracking.
    """
    __tablename__ = "mt5_trade_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket = Column(String(64), unique=True, index=True, nullable=False)
    symbol = Column(String(32), index=True, nullable=False, default="XAUUSD")
    side = Column(String(16), nullable=False)  # BUY or SELL
    lots = Column(Float, nullable=False, default=0.05)
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    close_price = Column(Float, nullable=True)
    sl = Column(Float, nullable=False, default=0.0)
    tp = Column(Float, nullable=False, default=0.0)
    pnl = Column(Float, nullable=False, default=0.0)
    pnl_status = Column(String(16), nullable=False, default="PROFIT")
    status = Column(String(16), index=True, nullable=False, default="OPEN")  # OPEN or CLOSED
    strategy = Column(String(64), index=True, nullable=False, default="HIGH_VOLUME_SCALPER")
    strategy_name = Column(String(128), nullable=True)
    horizon = Column(String(64), nullable=False, default="Ultra-Short (1m-5m)")
    timeframe = Column(String(16), nullable=False, default="15m")
    executed_at = Column(String(64), index=True, nullable=False)
    closed_at = Column(String(64), nullable=True)
    close_reason = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "ticket": self.ticket,
            "symbol": self.symbol,
            "side": self.side,
            "lots": self.lots,
            "executed_price": self.entry_price,
            "entry_price": self.entry_price,
            "current_price": self.current_price,
            "close_price": self.close_price,
            "sl": self.sl,
            "tp": self.tp,
            "pnl": self.pnl,
            "pnl_status": self.pnl_status,
            "status": self.status,
            "strategy": self.strategy,
            "strategy_name": self.strategy_name or self.strategy,
            "horizon": self.horizon,
            "timeframe": self.timeframe,
            "executed_at": self.executed_at,
            "closed_at": self.closed_at,
            "close_reason": self.close_reason,
            "is_closed": self.status == "CLOSED",
        }


class MT5AccountSnapshot(Base):
    """
    Historical balance, equity, and margin snapshots for equity curve analysis.
    """
    __tablename__ = "mt5_account_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_login = Column(String(64), index=True, nullable=False)
    server = Column(String(64), nullable=False)
    balance = Column(Float, nullable=False)
    equity = Column(Float, nullable=False)
    margin = Column(Float, nullable=False, default=0.0)
    free_margin = Column(Float, nullable=False, default=0.0)
    open_positions_count = Column(Integer, nullable=False, default=0)
    floating_pnl = Column(Float, nullable=False, default=0.0)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "account_login": self.account_login,
            "server": self.server,
            "balance": self.balance,
            "equity": self.equity,
            "margin": self.margin,
            "free_margin": self.free_margin,
            "open_positions_count": self.open_positions_count,
            "floating_pnl": self.floating_pnl,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }


class MT5ActivityLog(Base):
    """
    Audit log of all background synchronization events, orders placed,
    closed trades, risk guard actions, and telemetry heartbeats.
    """
    __tablename__ = "mt5_activity_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(64), index=True, nullable=False)
    ticket = Column(String(64), nullable=True, index=True)
    symbol = Column(String(32), default="XAUUSD")
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "event_type": self.event_type,
            "ticket": self.ticket,
            "symbol": self.symbol,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }
