"""
scoring/classification.py — Classify composite hazard scores.

Documented classes (from specification):
  NH = No Hazard    → score 0
  LH = Low Hazard   → score 4
  MH = Medium Hazard → score 6
  HH = High Hazard  → score 8

The specification says classification is relative to neighbouring units
in the selected extent.

THEREFORE:
  - Classification method is configurable
  - Default is threshold-based classification
  - Relative/quantile classification is also supported
  - Do NOT assume one universal formula beyond documented requirements
"""
import logging
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Documented classification thresholds (from specification)
# -------------------------------------------------------
DEFAULT_THRESHOLDS = {
    "NH": 0.0,   # No Hazard (< 4.0)
    "LH": 4.0,   # Low Hazard (4.0 - < 6.0)
    "MH": 6.0,   # Medium Hazard (6.0 - < 8.0)
    "HH": 8.0,   # High Hazard (>= 8.0)
}

CLASSIFICATION_COLORS = {
    "NH": "#22c55e",   # Green
    "LH": "#eab308",   # Yellow
    "MH": "#f97316",   # Orange
    "HH": "#ef4444",   # Red
}

CLASSIFICATION_LABELS = {
    "NH": "No Hazard",
    "LH": "Low Hazard",
    "MH": "Medium Hazard",
    "HH": "High Hazard",
}


def classify_by_threshold(
    score: float,
    thresholds: Optional[Dict[str, float]] = None,
) -> str:
    """
    Classify a hazard score using threshold-based classification.

    Documented thresholds:
      score < LH_threshold → NH
      LH_threshold ≤ score < MH_threshold → LH
      MH_threshold ≤ score < HH_threshold → MH
      score ≥ HH_threshold → HH

    Args:
        score: Composite hazard score (0–10)
        thresholds: Custom thresholds dict {NH: 0, LH: 4, MH: 6, HH: 8}

    Returns:
        Classification string: 'NH', 'LH', 'MH', or 'HH'
    """
    t = thresholds or DEFAULT_THRESHOLDS

    nh_t = t.get("NH", 0.0)
    lh_t = t.get("LH", 4.0)
    mh_t = t.get("MH", 6.0)
    hh_t = t.get("HH", 8.0)

    if score >= hh_t:
        return "HH"
    elif score >= mh_t:
        return "MH"
    elif score >= lh_t:
        return "LH"
    else:
        return "NH"


def classify_by_quantile(
    score: float,
    all_scores: List[float],
    quantiles: Optional[Dict[str, float]] = None,
) -> str:
    """
    Classify a score relative to the distribution of scores in the assessment extent.

    This is a relative classification (as the specification suggests).

    Args:
        score: Composite hazard score to classify
        all_scores: All composite scores in the assessment extent
        quantiles: Custom quantile thresholds {LH: 0.25, MH: 0.50, HH: 0.75}

    Returns:
        Classification string: 'NH', 'LH', 'MH', or 'HH'
    """
    if not all_scores:
        return "NH"

    q = quantiles or {"NH": 0.0, "LH": 0.25, "MH": 0.50, "HH": 0.75}
    sorted_scores = sorted(all_scores)
    n = len(sorted_scores)

    def quantile_val(p):
        idx = p * (n - 1)
        lower = int(idx)
        upper = min(lower + 1, n - 1)
        frac = idx - lower
        return sorted_scores[lower] + frac * (sorted_scores[upper] - sorted_scores[lower])

    hh_val = quantile_val(q.get("HH", 0.75))
    mh_val = quantile_val(q.get("MH", 0.50))
    lh_val = quantile_val(q.get("LH", 0.25))

    if score >= hh_val:
        return "HH"
    elif score >= mh_val:
        return "MH"
    elif score >= lh_val:
        return "LH"
    else:
        return "NH"


def classify_batch(
    scores: Dict[int, float],
    method: str = "threshold",
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[int, str]:
    """
    Classify a batch of scores (one per administrative unit).

    Args:
        scores: Dict mapping unit_id → composite_score
        method: 'threshold' or 'quantile'
        thresholds: Custom thresholds (for threshold method)

    Returns:
        Dict mapping unit_id → classification ('NH', 'LH', 'MH', 'HH')
    """
    if not scores:
        return {}

    if method == "quantile":
        all_scores = list(scores.values())
        return {
            uid: classify_by_quantile(score, all_scores)
            for uid, score in scores.items()
        }
    else:
        # Default: threshold
        return {
            uid: classify_by_threshold(score, thresholds)
            for uid, score in scores.items()
        }


def get_classification_summary(classifications: Dict[int, str]) -> Dict[str, int]:
    """
    Get count of each classification class.

    Returns:
        Dict {NH: count, LH: count, MH: count, HH: count}
    """
    summary = {"NH": 0, "LH": 0, "MH": 0, "HH": 0}
    for cls in classifications.values():
        if cls in summary:
            summary[cls] += 1
    return summary
