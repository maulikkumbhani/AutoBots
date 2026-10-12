from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, DateTime, Float, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    headline: Mapped[str] = mapped_column(String(512), index=True)
    source: Mapped[str] = mapped_column(String(128))
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)  # UTC
    content_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    symbols_json: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)  # JSON list of symbols
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # -1.0 to 1.0
    url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("idx_news_published_at", "published_at"),
    )


class EconomicEvent(Base):
    __tablename__ = "economic_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_name: Mapped[str] = mapped_column(String(256), index=True)
    country: Mapped[str] = mapped_column(String(32), index=True)  # IN, US, GLOBAL
    impact: Mapped[str] = mapped_column(String(16))  # LOW, MEDIUM, HIGH
    event_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    actual_value: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    forecast_value: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    previous_value: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
