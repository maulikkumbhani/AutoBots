from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Market Intelligence & Paper Trading Platform"
    API_V1_STR: str = "/api/v1"
    
    # Database configuration (defaults to SQLite async for seamless local zero-dependency operation)
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./market_intelligence.db",
        description="Async SQLAlchemy database URL (e.g. postgresql+asyncpg://... or sqlite+aiosqlite:///...)",
    )
    
    # Gemini AI Configuration
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        description="Google Gemini Flash API key for structured analysis and qualitative explanations",
    )
    GEMINI_MODEL: str = "gemini-2.0-flash"
    
    # Default Risk & Evaluation Parameters
    DEFAULT_NEUTRAL_THRESHOLD_PCT: float = 0.15  # 0.15% return band considered sideways
    DEFAULT_SLIPPAGE_BPS: float = 2.0           # 2 basis points slippage default
    DEFAULT_FEE_BPS: float = 3.0                # 3 basis points exchange/brokerage fees
    
    # Default Initial Paper Portfolio Cash
    DEFAULT_PAPER_CASH: float = 1_000_000.0     # 1,000,000 (INR or USD depending on portfolio)
    
    # Supported Initial Instruments
    DEFAULT_INSTRUMENTS: List[str] = [
        "NIFTY 50",
        "BANK NIFTY",
        "RELIANCE.NS",
        "HDFCBANK.NS",
        "^GSPC",       # S&P 500
        "^IXIC",       # Nasdaq-100
        "AAPL",
        "MSFT",
        "GC=F",        # Gold Futures
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
