import os
import sqlite3
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger("AutoBot.DatabaseSync")

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../market_intelligence.db"))


class MT5DatabaseSyncManager:
    """
    High-performance background synchronization engine that binds MetaTrader 5
    live trading telemetry, executed orders, and audit activities to a local SQLite database.
    """

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._is_running = False
        self._last_sync_time: Optional[str] = None
        self._sync_count = 0
        self._last_logged_balance = 0.0
        self._last_logged_equity = 0.0
        self.ensure_tables()

    def _get_connection(self) -> sqlite3.Connection:
        """Returns a thread-safe connection to the SQLite database with WAL mode."""
        conn = sqlite3.connect(self.db_path, timeout=15.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA synchronous=NORMAL;")
        except Exception:
            pass
        return conn

    def ensure_tables(self):
        """Initializes all required MT5 tables in the local SQLite database."""
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            with self._get_connection() as conn:
                cursor = conn.cursor()

                # 1. MT5 Trades Table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS mt5_trade_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticket TEXT UNIQUE NOT NULL,
                        symbol TEXT NOT NULL DEFAULT 'XAUUSD',
                        side TEXT NOT NULL,
                        lots REAL NOT NULL DEFAULT 0.05,
                        entry_price REAL NOT NULL,
                        current_price REAL NOT NULL,
                        close_price REAL,
                        sl REAL NOT NULL DEFAULT 0.0,
                        tp REAL NOT NULL DEFAULT 0.0,
                        pnl REAL NOT NULL DEFAULT 0.0,
                        pnl_status TEXT NOT NULL DEFAULT 'PROFIT',
                        status TEXT NOT NULL DEFAULT 'OPEN',
                        strategy TEXT NOT NULL DEFAULT 'HIGH_VOLUME_SCALPER',
                        strategy_name TEXT,
                        horizon TEXT NOT NULL DEFAULT 'Ultra-Short (1m-5m)',
                        timeframe TEXT NOT NULL DEFAULT '15m',
                        executed_at TEXT NOT NULL,
                        closed_at TEXT,
                        close_reason TEXT,
                        created_at TEXT DEFAULT (datetime('now')),
                        updated_at TEXT DEFAULT (datetime('now'))
                    );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mt5_trades_ticket ON mt5_trade_records (ticket);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mt5_trades_status ON mt5_trade_records (status);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mt5_trades_strategy ON mt5_trade_records (strategy);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mt5_trades_symbol ON mt5_trade_records (symbol);")

                # 2. MT5 Account Snapshots (for equity curves and telemetry tracking)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS mt5_account_snapshots (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        account_login TEXT NOT NULL,
                        server TEXT NOT NULL,
                        balance REAL NOT NULL,
                        equity REAL NOT NULL,
                        margin REAL NOT NULL DEFAULT 0.0,
                        free_margin REAL NOT NULL DEFAULT 0.0,
                        open_positions_count INTEGER NOT NULL DEFAULT 0,
                        floating_pnl REAL NOT NULL DEFAULT 0.0,
                        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
                    );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mt5_snapshots_time ON mt5_account_snapshots (timestamp);")

                # 3. MT5 Activity Audit Logs
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS mt5_activity_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_type TEXT NOT NULL,
                        ticket TEXT,
                        symbol TEXT DEFAULT 'XAUUSD',
                        message TEXT NOT NULL,
                        details TEXT,
                        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
                    );
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mt5_logs_type ON mt5_activity_logs (event_type);")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_mt5_logs_time ON mt5_activity_logs (timestamp);")

                conn.commit()
                logger.info(f"Local SQLite database initialized at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize SQLite database tables: {e}")

    def seed_from_existing_history(self, trades: List[Dict[str, Any]]) -> int:
        """Seeds the local SQLite database from existing memory/JSON trades without duplication."""
        if not trades:
            return 0
        inserted = 0
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                for t in trades:
                    ticket = str(t.get("ticket") or "").strip()
                    if not ticket or ticket.startswith("TEMP"):
                        continue

                    cursor.execute("""
                        INSERT INTO mt5_trade_records (
                            ticket, symbol, side, lots, entry_price, current_price, close_price,
                            sl, tp, pnl, pnl_status, status, strategy, strategy_name,
                            horizon, timeframe, executed_at, closed_at, close_reason, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                        ON CONFLICT(ticket) DO UPDATE SET
                            current_price = excluded.current_price,
                            close_price = COALESCE(excluded.close_price, mt5_trade_records.close_price),
                            pnl = excluded.pnl,
                            pnl_status = excluded.pnl_status,
                            status = excluded.status,
                            closed_at = COALESCE(excluded.closed_at, mt5_trade_records.closed_at),
                            close_reason = COALESCE(excluded.close_reason, mt5_trade_records.close_reason),
                            updated_at = datetime('now');
                    """, (
                        ticket,
                        t.get("symbol", "XAUUSD"),
                        t.get("side", "BUY"),
                        float(t.get("lots", 0.05)),
                        float(t.get("executed_price") or t.get("entry_price") or 3570.0),
                        float(t.get("current_price") or t.get("executed_price") or 3570.0),
                        float(t.get("close_price")) if t.get("close_price") is not None else None,
                        float(t.get("sl", 0.0)),
                        float(t.get("tp", 0.0)),
                        float(t.get("pnl", 0.0)),
                        t.get("pnl_status", "PROFIT"),
                        t.get("status", "OPEN"),
                        t.get("strategy", "HIGH_VOLUME_SCALPER"),
                        t.get("strategy_name") or t.get("strategy", "High-Volume Scalper"),
                        t.get("horizon", "Ultra-Short (1m-5m)"),
                        t.get("timeframe", "15m"),
                        str(t.get("executed_at", datetime.now(timezone.utc).strftime("%Y.%m.%d %H:%M"))),
                        t.get("closed_at"),
                        t.get("close_reason"),
                    ))
                    inserted += 1
                conn.commit()
                self._last_sync_time = datetime.now(timezone.utc).isoformat()
        except Exception as e:
            logger.error(f"Error seeding trades to database: {e}")
        return inserted

    def record_trade(self, t: Dict[str, Any]) -> bool:
        """Upserts a single trade into the SQLite database."""
        ticket = str(t.get("ticket") or "").strip()
        if not ticket:
            return False
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO mt5_trade_records (
                        ticket, symbol, side, lots, entry_price, current_price, close_price,
                        sl, tp, pnl, pnl_status, status, strategy, strategy_name,
                        horizon, timeframe, executed_at, closed_at, close_reason, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(ticket) DO UPDATE SET
                        current_price = excluded.current_price,
                        close_price = COALESCE(excluded.close_price, mt5_trade_records.close_price),
                        pnl = excluded.pnl,
                        pnl_status = excluded.pnl_status,
                        status = excluded.status,
                        closed_at = COALESCE(excluded.closed_at, mt5_trade_records.closed_at),
                        close_reason = COALESCE(excluded.close_reason, mt5_trade_records.close_reason),
                        updated_at = datetime('now');
                """, (
                    ticket,
                    t.get("symbol", "XAUUSD"),
                    t.get("side", "BUY"),
                    float(t.get("lots", 0.05)),
                    float(t.get("executed_price") or t.get("entry_price") or 3570.0),
                    float(t.get("current_price") or 3570.0),
                    float(t.get("close_price")) if t.get("close_price") is not None else None,
                    float(t.get("sl", 0.0)),
                    float(t.get("tp", 0.0)),
                    float(t.get("pnl", 0.0)),
                    t.get("pnl_status", "PROFIT"),
                    t.get("status", "OPEN"),
                    t.get("strategy", "HIGH_VOLUME_SCALPER"),
                    t.get("strategy_name") or t.get("strategy"),
                    t.get("horizon", "Ultra-Short (1m-5m)"),
                    t.get("timeframe", "15m"),
                    str(t.get("executed_at", datetime.now(timezone.utc).strftime("%Y.%m.%d %H:%M"))),
                    t.get("closed_at"),
                    t.get("close_reason"),
                ))
                conn.commit()
                self._last_sync_time = datetime.now(timezone.utc).isoformat()
                return True
        except Exception as e:
            logger.error(f"Failed to record trade #{ticket} to SQLite: {e}")
            return False

    def record_account_snapshot(self, acc: Dict[str, Any]) -> bool:
        """Records an account balance and equity snapshot to track the live equity curve."""
        balance = float(acc.get("balance", 0.0))
        equity = float(acc.get("equity", 0.0))
        if balance <= 0 and equity <= 0:
            return False

        # Only insert if balance/equity shifted or every ~30 sync cycles to keep DB lean
        if abs(balance - self._last_logged_balance) < 0.01 and abs(equity - self._last_logged_equity) < 0.01 and self._sync_count % 15 != 0:
            return False

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO mt5_account_snapshots (
                        account_login, server, balance, equity, margin, free_margin,
                        open_positions_count, floating_pnl, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));
                """, (
                    str(acc.get("account_login", "115610153")),
                    str(acc.get("server", "MetaQuotes-Demo")),
                    balance,
                    equity,
                    float(acc.get("margin", 0.0)),
                    float(acc.get("free_margin", 0.0)),
                    int(acc.get("open_positions_count", 0)),
                    round(equity - balance, 2),
                ))
                conn.commit()
                self._last_logged_balance = balance
                self._last_logged_equity = equity
                return True
        except Exception as e:
            logger.debug(f"Snapshot insert error: {e}")
            return False

    def log_activity(self, event_type: str, message: str, ticket: Optional[str] = None, symbol: str = "XAUUSD", details: Optional[str] = None) -> bool:
        """Appends an operational audit record to the local database."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO mt5_activity_logs (event_type, ticket, symbol, message, details, timestamp)
                    VALUES (?, ?, ?, ?, ?, datetime('now'));
                """, (event_type, str(ticket) if ticket else None, symbol, message, str(details) if details else None))
                conn.commit()
                return True
        except Exception as e:
            logger.debug(f"Activity log error: {e}")
            return False

    def get_database_stats(self) -> Dict[str, Any]:
        """Returns database health, path, size, and total recorded rows."""
        file_size_kb = 0.0
        if os.path.exists(self.db_path):
            file_size_kb = round(os.path.getsize(self.db_path) / 1024.0, 1)

        total_trades = 0
        open_trades = 0
        closed_trades = 0
        total_snapshots = 0
        total_activities = 0

        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT count(*) FROM mt5_trade_records;")
                total_trades = cursor.fetchone()[0]

                cursor.execute("SELECT count(*) FROM mt5_trade_records WHERE status = 'OPEN';")
                open_trades = cursor.fetchone()[0]

                cursor.execute("SELECT count(*) FROM mt5_trade_records WHERE status = 'CLOSED';")
                closed_trades = cursor.fetchone()[0]

                cursor.execute("SELECT count(*) FROM mt5_account_snapshots;")
                total_snapshots = cursor.fetchone()[0]

                cursor.execute("SELECT count(*) FROM mt5_activity_logs;")
                total_activities = cursor.fetchone()[0]
        except Exception as e:
            logger.debug(f"Stats query error: {e}")

        return {
            "status": "CONNECTED",
            "database_type": "SQLite3 (WAL Mode)",
            "database_path": self.db_path,
            "database_size_kb": file_size_kb,
            "total_trades": total_trades,
            "open_trades": open_trades,
            "closed_trades": closed_trades,
            "total_snapshots": total_snapshots,
            "total_activities": total_activities,
            "last_sync_time": self._last_sync_time,
            "is_background_sync_active": self._is_running,
        }

    def get_trades(
        self,
        timeframe: Optional[str] = None,
        period: Optional[str] = None,
        strategy: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 200,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Queries trades directly from SQLite database with full query filtering."""
        query = "SELECT * FROM mt5_trade_records WHERE 1=1"
        params: List[Any] = []

        if status and status.strip().lower() != "all":
            query += " AND status = ?"
            params.append(status.strip().upper())

        if strategy and strategy.strip().upper() != "ALL":
            query += " AND (strategy LIKE ? OR strategy_name LIKE ?)"
            s_like = f"%{strategy.strip()}%"
            params.extend([s_like, s_like])

        if timeframe and timeframe.strip().upper() != "ALL":
            query += " AND timeframe = ?"
            params.append(timeframe.strip())

        query += " ORDER BY id DESC LIMIT ? OFFSET ?;"
        params.extend([limit, offset])

        trades: List[Dict[str, Any]] = []
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, params)
                rows = cursor.fetchall()
                for r in rows:
                    trades.append({
                        "ticket": r["ticket"],
                        "symbol": r["symbol"],
                        "side": r["side"],
                        "lots": r["lots"],
                        "executed_price": r["entry_price"],
                        "entry_price": r["entry_price"],
                        "current_price": r["current_price"],
                        "close_price": r["close_price"],
                        "sl": r["sl"],
                        "tp": r["tp"],
                        "pnl": r["pnl"],
                        "pnl_status": r["pnl_status"],
                        "status": r["status"],
                        "strategy": r["strategy"],
                        "strategy_name": r["strategy_name"] or r["strategy"],
                        "horizon": r["horizon"],
                        "timeframe": r["timeframe"],
                        "executed_at": r["executed_at"],
                        "closed_at": r["closed_at"],
                        "close_reason": r["close_reason"],
                        "is_closed": r["status"] == "CLOSED",
                    })
        except Exception as e:
            logger.error(f"Error querying trades from SQLite: {e}")

        stats = self.get_database_stats()
        return {
            "total_trades": stats["total_trades"],
            "open_count": stats["open_trades"],
            "closed_count": stats["closed_trades"],
            "returned_count": len(trades),
            "trades": trades,
        }

    def get_recent_activities(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns the most recent activity audit entries from SQLite."""
        activities = []
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, event_type, ticket, symbol, message, details, timestamp
                    FROM mt5_activity_logs
                    ORDER BY id DESC LIMIT ?;
                """, (limit,))
                for r in cursor.fetchall():
                    activities.append({
                        "id": r["id"],
                        "event_type": r["event_type"],
                        "ticket": r["ticket"],
                        "symbol": r["symbol"],
                        "message": r["message"],
                        "details": r["details"],
                        "timestamp": r["timestamp"],
                    })
        except Exception as e:
            logger.error(f"Error fetching activities: {e}")
        return activities

    def get_equity_curve(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Returns historical account balance & equity points for chart visualization."""
        points = []
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT id, account_login, server, balance, equity, floating_pnl, open_positions_count, timestamp
                    FROM mt5_account_snapshots
                    ORDER BY id ASC LIMIT ?;
                """, (limit,))
                for r in cursor.fetchall():
                    points.append({
                        "id": r["id"],
                        "balance": r["balance"],
                        "equity": r["equity"],
                        "floating_pnl": r["floating_pnl"],
                        "open_positions": r["open_positions_count"],
                        "timestamp": r["timestamp"],
                    })
        except Exception as e:
            logger.error(f"Error fetching equity curve: {e}")
        return points

    async def run_background_sync(self, interval_sec: float = 2.0):
        """
        Continuous background synchronization coroutine.
        Synchronizes live MT5 telemetry and memory trades to the SQLite database.
        """
        self._is_running = True
        logger.info("Starting background MT5 SQLite database synchronization loop...")
        self.log_activity("STARTUP", "AutoBots Local Database Synchronization Engine started.")

        from app.execution.mt5_bridge import mt5_bridge

        # Initial seed on startup
        if mt5_bridge.executed_trades:
            seeded = self.seed_from_existing_history(mt5_bridge.executed_trades)
            logger.info(f"Database sync initialized with {seeded} historical trades.")

        while self._is_running:
            try:
                self._sync_count += 1

                # 1. Sync telemetry from MT5 files
                mt5_bridge.sync_file_telemetry()

                # 2. Reconcile account snapshot to database
                if mt5_bridge.account_info:
                    self.record_account_snapshot(mt5_bridge.account_info)

                # 3. Synchronize in-memory trades to database
                if mt5_bridge.executed_trades:
                    self.seed_from_existing_history(mt5_bridge.executed_trades)

                self._last_sync_time = datetime.now(timezone.utc).isoformat()
            except Exception as e:
                logger.debug(f"Background sync iteration warning: {e}")

            await asyncio.sleep(interval_sec)

    def stop(self):
        """Stops the background synchronization loop."""
        self._is_running = False
        self.log_activity("SHUTDOWN", "Database synchronization engine stopped.")


# Global Singleton Instance
db_sync_manager = MT5DatabaseSyncManager()
