import pytest
from app.evaluation.metrics import EvaluationMetricsEngine


def test_wilson_confidence_interval():
    # 8 correct out of 10
    lower, upper = EvaluationMetricsEngine.calculate_wilson_confidence_interval(8, 10)
    assert 40.0 < lower < 80.0
    assert 80.0 <= upper <= 100.0

    # 0 total
    lower_zero, upper_zero = EvaluationMetricsEngine.calculate_wilson_confidence_interval(0, 0)
    assert lower_zero == 0.0 and upper_zero == 0.0


def test_direction_classification():
    assert EvaluationMetricsEngine.classify_realized_direction(0.25, 0.15) == "UP"
    assert EvaluationMetricsEngine.classify_realized_direction(-0.30, 0.15) == "DOWN"
    assert EvaluationMetricsEngine.classify_realized_direction(0.05, 0.15) == "SIDEWAYS"
    assert EvaluationMetricsEngine.classify_realized_direction(-0.10, 0.15) == "SIDEWAYS"


def test_brier_score_single():
    # Perfect prediction: predicted 1.0 on UP, actual was UP
    brier_perfect = EvaluationMetricsEngine.calculate_brier_score_single(1.0, 0.0, 0.0, "UP")
    assert brier_perfect == 0.0

    # Completely wrong prediction: predicted 1.0 on DOWN, actual was UP
    brier_worst = EvaluationMetricsEngine.calculate_brier_score_single(0.0, 1.0, 0.0, "UP")
    assert brier_worst == 2.0


def test_batch_evaluation_excludes_unresolved():
    evals = [
        {"predicted_direction": "UP", "realized_direction": "UP", "is_correct": True, "brier_score": 0.1, "evaluation_status": "RESOLVED"},
        {"predicted_direction": "DOWN", "realized_direction": "UP", "is_correct": False, "brier_score": 0.9, "evaluation_status": "RESOLVED"},
        {"predicted_direction": "UP", "realized_direction": None, "is_correct": None, "brier_score": None, "evaluation_status": "UNRESOLVED"},
    ]

    res = EvaluationMetricsEngine.evaluate_batch(evals)
    # Total predictions = 3, fully evaluated = 2, unresolved = 1
    assert res["total_predictions"] == 3
    assert res["fully_evaluated"] == 2
    assert res["unresolved"] == 1
    assert res["accuracy_pct"] == 50.0  # 1 / 2 = 50.0%, NOT 1 / 3 = 33.3%
    assert res["sample_size_warning"] == True  # < 30 samples
