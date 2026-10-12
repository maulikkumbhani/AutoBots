from abc import ABC, abstractmethod
from typing import Dict, Any, List
import pandas as pd
from app.schemas.prediction import GeminiForecastResponse, DirectionalProbabilities, PriceRange


class BasePredictionModel(ABC):
    """
    Abstract interface for all prediction models.
    Takes point-in-time indicators & market context and outputs structured forecast.
    """

    @abstractmethod
    def get_model_name(self) -> str:
        pass

    @abstractmethod
    def get_model_version(self) -> str:
        pass

    @abstractmethod
    async def predict(
        self,
        symbol: str,
        past_df: pd.DataFrame,
        horizon: str = "60m",
        market_context: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Generates forecast for given horizon.
        Must return dict compatible with GeminiForecastResponse schema:
        - instrument, as_of, horizon, direction ('up', 'down', 'sideways', 'uncertain')
        - probabilities: {'up': float, 'down': float, 'sideways': float}
        - expected_return, predicted_range: {'lower': float, 'upper': float}
        - supporting_factors, conflicting_factors, risk_factors
        - data_quality, model_version
        """
        pass
