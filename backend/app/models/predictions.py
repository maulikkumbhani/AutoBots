from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Float, DateTime, ForeignKey, Boolean, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class PredictionModel(Base):
    __tablename__ = "prediction_models"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), index=True)
    version: Mapped[str] = mapped_column(String(32))
    model_type: Mapped[str] = mapped_column(String(32))  # STATISTICAL, ML_CLASSIFIER, GEMINI_FLASH, ENSEMBLE
    description: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    parameters_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


class Forecast(Base):
    __tablename__ = "forecasts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("prediction_models.id"), index=True)
    
    # Point-in-time reference
    cutoff_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    as_of_price: Mapped[float] = mapped_column(Float)
    horizon: Mapped[str] = mapped_column(String(16), index=True)  # 5m, 15m, 30m, 60m, SESSION_CLOSE, 1D, 5D
    
    # Forecast outputs
    direction: Mapped[str] = mapped_column(String(16), index=True)  # UP, DOWN, SIDEWAYS, UNCERTAIN
    prob_up: Mapped[float] = mapped_column(Float, default=0.0)
    prob_down: Mapped[float] = mapped_column(Float, default=0.0)
    prob_sideways: Mapped[float] = mapped_column(Float, default=0.0)
    
    expected_return_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    predicted_range_lower: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    predicted_range_upper: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Explainability & integrity metadata
    supporting_factors_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    conflicting_factors_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_factors_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_quality: Mapped[str] = mapped_column(String(16), default="GOOD")  # GOOD, LIMITED, INSUFFICIENT
    features_snapshot_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    evaluation: Mapped[Optional["ForecastEvaluation"]] = relationship(
        "ForecastEvaluation", back_populates="forecast", uselist=False
    )

    __table_args__ = (
        Index("idx_forecasts_inst_cutoff", "instrument_id", "cutoff_timestamp"),
    )


class ForecastEvaluation(Base):
    __tablename__ = "forecast_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    forecast_id: Mapped[int] = mapped_column(ForeignKey("forecasts.id"), unique=True, index=True)
    
    # Realized evaluation values
    target_evaluation_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    realized_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    realized_return_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    realized_direction: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # UP, DOWN, SIDEWAYS
    
    neutral_threshold_pct: Mapped[float] = mapped_column(Float, default=0.15)
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    brier_score_contribution: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    evaluation_status: Mapped[str] = mapped_column(
        String(16), default="UNRESOLVED", index=True
    )  # RESOLVED, UNRESOLVED, DATA_GAP, EXPIRED
    
    evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    forecast: Mapped["Forecast"] = relationship("Forecast", back_populates="evaluation")
