import math
from typing import Dict, List, Any, Optional, Tuple
import numpy as np


class EvaluationMetricsEngine:
    """
    Rigorously computes forecast evaluation metrics, directional accuracy,
    Brier score, calibration curves, confusion matrix, precision/recall,
    and statistical confidence intervals.
    """

    @staticmethod
    def calculate_wilson_confidence_interval(
        successes: int, total: int, confidence: float = 0.95
    ) -> Tuple[float, float]:
        """
        Calculates Wilson score interval for binomial proportions.
        Reliable even for small sample sizes.
        """
        if total <= 0:
            return 0.0, 0.0
        
        # 1.96 for 95%
        z = 1.95996 if confidence == 0.95 else 2.576
        p_hat = successes / total
        denominator = 1.0 + (z**2) / total
        centre_adj_prob = p_hat + (z**2) / (2 * total)
        adjusted_std = math.sqrt((p_hat * (1 - p_hat) + (z**2) / (4 * total)) / total)
        
        lower = max(0.0, (centre_adj_prob - z * adjusted_std) / denominator)
        upper = min(1.0, (centre_adj_prob + z * adjusted_std) / denominator)
        return round(lower * 100, 2), round(upper * 100, 2)

    @staticmethod
    def classify_realized_direction(
        return_pct: float, neutral_threshold_pct: float = 0.15
    ) -> str:
        """Classifies realized return against neutral band."""
        if return_pct > neutral_threshold_pct:
            return "UP"
        elif return_pct < -neutral_threshold_pct:
            return "DOWN"
        else:
            return "SIDEWAYS"

    @staticmethod
    def calculate_brier_score_single(
        prob_up: float,
        prob_down: float,
        prob_sideways: float,
        realized_direction: str,
    ) -> float:
        """
        Calculates multi-class Brier score for single prediction:
        Sum over classes of (predicted_prob - actual_binary)^2
        Lower is better (0.0 = perfect calibration, 2.0 = worst).
        """
        y_up = 1.0 if realized_direction == "UP" else 0.0
        y_down = 1.0 if realized_direction == "DOWN" else 0.0
        y_sideways = 1.0 if realized_direction == "SIDEWAYS" else 0.0

        brier = (
            (prob_up - y_up) ** 2
            + (prob_down - y_down) ** 2
            + (prob_sideways - y_sideways) ** 2
        )
        return round(float(brier), 4)

    @classmethod
    def evaluate_batch(
        cls,
        evaluations: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Computes aggregate metrics across evaluated predictions:
        Excludes unresolved forecasts from denominator.
        """
        total_predictions = len(evaluations)
        resolved = [e for e in evaluations if e.get("evaluation_status") == "RESOLVED"]
        unresolved = [e for e in evaluations if e.get("evaluation_status") != "RESOLVED"]

        n_resolved = len(resolved)
        if n_resolved == 0:
            return {
                "total_predictions": total_predictions,
                "fully_evaluated": 0,
                "unresolved": len(unresolved),
                "accuracy_pct": None,
                "accuracy_ci_95": None,
                "sample_size_warning": True,
                "brier_score_mean": None,
            }

        correct_count = sum(1 for e in resolved if e.get("is_correct") is True)
        accuracy_pct = round((correct_count / n_resolved) * 100.0, 2)
        ci_lower, ci_upper = cls.calculate_wilson_confidence_interval(correct_count, n_resolved)

        # Breakdowns by predicted direction
        direction_stats = {}
        for d in ["UP", "DOWN", "SIDEWAYS"]:
            d_preds = [e for e in resolved if e.get("predicted_direction") == d]
            d_total = len(d_preds)
            d_correct = sum(1 for e in d_preds if e.get("is_correct") is True)
            d_acc = round((d_correct / d_total * 100), 2) if d_total > 0 else None
            d_ci = cls.calculate_wilson_confidence_interval(d_correct, d_total) if d_total > 0 else None
            direction_stats[d] = {
                "sample_size": d_total,
                "correct": d_correct,
                "accuracy_pct": d_acc,
                "confidence_interval_95": d_ci,
            }

        # Confusion Matrix & Precision / Recall
        classes = ["UP", "DOWN", "SIDEWAYS"]
        confusion = {actual: {pred: 0 for pred in classes} for actual in classes}
        for e in resolved:
            pred = e.get("predicted_direction", "SIDEWAYS")
            actual = e.get("realized_direction", "SIDEWAYS")
            if actual in confusion and pred in confusion[actual]:
                confusion[actual][pred] += 1

        precision_recall = {}
        for c in classes:
            tp = confusion[c][c]
            fp = sum(confusion[other][c] for other in classes if other != c)
            fn = sum(confusion[c][other] for other in classes if other != c)
            
            precision = round((tp / (tp + fp) * 100), 2) if (tp + fp) > 0 else 0.0
            recall = round((tp / (tp + fn) * 100), 2) if (tp + fn) > 0 else 0.0
            f1 = round((2 * precision * recall / (precision + recall)), 2) if (precision + recall) > 0 else 0.0
            
            precision_recall[c] = {
                "precision_pct": precision,
                "recall_pct": recall,
                "f1_score": f1,
            }

        # Brier Score Mean
        brier_scores = [e["brier_score"] for e in resolved if "brier_score" in e and e["brier_score"] is not None]
        mean_brier = round(float(np.mean(brier_scores)), 4) if brier_scores else None

        return {
            "total_predictions": total_predictions,
            "fully_evaluated": n_resolved,
            "unresolved": len(unresolved),
            "correct": correct_count,
            "incorrect": n_resolved - correct_count,
            "accuracy_pct": accuracy_pct,
            "confidence_interval_95": (ci_lower, ci_upper),
            "sample_size_warning": n_resolved < 30,
            "brier_score_mean": mean_brier,
            "by_direction": direction_stats,
            "precision_recall_f1": precision_recall,
            "confusion_matrix": confusion,
        }
