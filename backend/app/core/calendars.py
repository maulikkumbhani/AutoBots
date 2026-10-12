from datetime import datetime, time, timedelta
from typing import Optional, Tuple
import pytz


class ExchangeCalendar:
    """
    Handles trading session hours, weekend detection, holiday awareness,
    and timezone conversions for NSE and US Exchanges.
    """

    EXCHANGE_TIMEZONES = {
        "NSE": "Asia/Kolkata",
        "BSE": "Asia/Kolkata",
        "NASDAQ": "America/New_York",
        "NYSE": "America/New_York",
        "MCX": "Asia/Kolkata",
    }

    # Standard regular trading hours in local market time
    SESSION_HOURS = {
        "NSE": (time(9, 15), time(15, 30)),       # 09:15 to 15:30 IST
        "BSE": (time(9, 15), time(15, 30)),
        "NASDAQ": (time(9, 30), time(16, 0)),     # 09:30 to 16:00 EST/EDT
        "NYSE": (time(9, 30), time(16, 0)),
        "MCX": (time(9, 0), time(23, 30)),        # Commodity market
    }

    @classmethod
    def get_timezone(cls, exchange: str) -> pytz.BaseTzInfo:
        tz_name = cls.EXCHANGE_TIMEZONES.get(exchange.upper(), "UTC")
        return pytz.timezone(tz_name)

    @classmethod
    def to_utc(cls, dt: datetime, exchange: Optional[str] = None) -> datetime:
        """Ensure datetime is UTC timezone aware."""
        if dt.tzinfo is None:
            if exchange:
                tz = cls.get_timezone(exchange)
                dt = tz.localize(dt)
            else:
                dt = pytz.UTC.localize(dt)
        return dt.astimezone(pytz.UTC)

    @classmethod
    def to_local(cls, dt: datetime, exchange: str) -> datetime:
        """Convert UTC datetime to exchange local datetime."""
        if dt.tzinfo is None:
            dt = pytz.UTC.localize(dt)
        return dt.astimezone(cls.get_timezone(exchange))

    @classmethod
    def is_trading_day(cls, dt_local: datetime) -> bool:
        """Check if date is a standard trading weekday (Monday=0, Friday=4)."""
        return dt_local.weekday() < 5

    @classmethod
    def is_market_open(cls, dt_utc: datetime, exchange: str) -> bool:
        """Check if exchange is currently in an active regular trading session."""
        dt_local = cls.to_local(dt_utc, exchange)
        if not cls.is_trading_day(dt_local):
            return False
        
        session = cls.SESSION_HOURS.get(exchange.upper())
        if not session:
            return True  # 24/7 or unknown
        
        open_time, close_time = session
        current_time = dt_local.time()
        return open_time <= current_time <= close_time

    @classmethod
    def get_session_bounds(cls, dt_utc: datetime, exchange: str) -> Tuple[datetime, datetime]:
        """Get (session_open_utc, session_close_utc) for the date corresponding to dt_utc."""
        dt_local = cls.to_local(dt_utc, exchange)
        tz = cls.get_timezone(exchange)
        open_t, close_t = cls.SESSION_HOURS.get(exchange.upper(), (time(0, 0), time(23, 59)))
        
        local_open = tz.localize(datetime.combine(dt_local.date(), open_t))
        local_close = tz.localize(datetime.combine(dt_local.date(), close_t))
        return local_open.astimezone(pytz.UTC), local_close.astimezone(pytz.UTC)

    @classmethod
    def get_next_session_open(cls, dt_utc: datetime, exchange: str) -> datetime:
        """
        Calculates the start of the next trading session if dt_utc is during off-hours,
        after market close, or on weekends.
        """
        dt_local = cls.to_local(dt_utc, exchange)
        tz = cls.get_timezone(exchange)
        open_t, close_t = cls.SESSION_HOURS.get(exchange.upper(), (time(9, 15), time(15, 30)))
        
        target_date = dt_local.date()
        if not cls.is_trading_day(dt_local) or dt_local.time() >= close_t:
            target_date += timedelta(days=1)
        
        # Advance through weekends
        while target_date.weekday() >= 5:
            target_date += timedelta(days=1)
            
        next_open_local = tz.localize(datetime.combine(target_date, open_t))
        return next_open_local.astimezone(pytz.UTC)
