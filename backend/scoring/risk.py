"""
scoring/risk.py — Module 4: Composite Risk engine.

Combines the unit-level composite scores of Hazard (H), Vulnerability (V) and
Exposure (E) assessments into a single risk score on the 0–10 scale, following
the HVRA concept note:

    Risk = H × V × E   (multiplicative)

with optional user-adjustable module weights for scenario testing. Regular
weights are treated as exponents in a weighted geometric mean:

    Risk = (H^wH · V^wV · E^wE)^(1 / (wH + wV + wE))

which keeps the result on the 0–10 scale and reduces to the pure product when
all weights are equal. An additive (weighted sum) formula is also provided for
scenario comparison.

Risk classes (prototype thresholds, configurable):
    < 4.0                  → LOW
    4.0 – < 6.0            → MODERATE
    6.0 – < 8.0            → HIGH
    ≥ 8.0                  → VERY_HIGH

All functions are pure and independently testable.
"""
import logging
import math
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Risk class thresholds and presentation
# -------------------------------------------------------
RISK_CLASS_THRESHOLDS = {
    "MODERATE": 4.0,
    "HIGH": 6.0,
    "VERY_HIGH": 8.0,
}

RISK_CLASS_COLORS = {
    "VERY_HIGH": "#7f1d1d",   # deep red (highest priority)
    "HIGH": "#ef4444",        # red
    "MODERATE": "#f59e0b",    # amber
    "LOW": "#22c55e",         # green
}

RISK_CLASS_LABELS = {
    "VERY_HIGH": "Very High Risk",
    "HIGH": "High Risk",
    "MODERATE": "Moderate Risk",
    "LOW": "Low Risk",
}

RISK_CLASS_ORDER = ["VERY_HIGH", "HIGH", "MODERATE", "LOW"]


def weighted_geometric_mean(scores: Dict[str, float], weights: Dict[str, float]) -> float:
    """
    Weighted geometric mean of component scores on the 0–10 scale.

    Args:
        scores:  {component: score (0–10)}
        weights: {component: weight ≥ 0} (need not sum to 1)

    Returns:
        Score on 0–10 scale. 0.0 when any contributing component is 0
        (multiplicative semantics).
    """
    result = 0.0
    total_weight = 0.0
    try:
        for comp, score in scores.items():
            weight = max(weights.get(comp, 0.0), 0.0)
            if weight <= 0:
                continue
            total_weight += weight
            safe_score = max(0.0, min(10.0, float(score or 0.0)))
            result += weight * math.log(safe_score) if safe_score > 0 else -math.inf
        if total_weight <= 0:
            return 0.0
        if math.isinf(result) and result < 0:
            return 0.0
        return round(max(0.0, min(10.0, math.exp(result / total_weight))), 4)
    except Exception as e:  # defensive
        logger.error(f"Geometric mean failed: {e}")
        return 0.0


def weighted_sum(scores: Dict[str, float], weights: Dict[str, float]) -> float:
    """
    Additive risk combination: Σ(w_i · score_i) / Σ(w_i). Range 0–10.
    """
    num = 0.0
    den = 0.0
    for comp, score in scores.items():
        weight = max(weights.get(comp, 0.0), 0.0)
        if weight <= 0:
            continue
        num += weight * max(0.0, min(10.0, float(score or 0.0)))
        den += weight
    if den <= 0:
        return 0.0
    return round(num / den, 4)


def compute_risk_scores(
    module_scores: Dict[int, Dict[str, Optional[float]]],
    weights: Dict[str, float],
    formula: str = "MULTIPLICATIVE",
) -> Dict[int, Dict[str, Any]]:
    """
    Combine per-unit module composite scores into risk scores.

    Args:
        module_scores: {unit_id: {"hazard": float|None, "vulnerability": float|None,
                                  "exposure": float|None}}
        weights:       {"hazard": float, "vulnerability": float, "exposure": float}
        formula:       "MULTIPLICATIVE" (default) or "ADDITIVE"

    Returns:
        {unit_id: {"hazard_score": float|None, "vulnerability_score": float|None,
                   "exposure_score": float|None, "risk_score": float,
                   "risk_class": str}}
    """
    results: Dict[int, Dict[str, Any]] = {}
    total_weight = sum(max(w, 0.0) for w in weights.values())

    for unit_id, comps in module_scores.items():
        h = comps.get("hazard")
        v = comps.get("vulnerability")
        e = comps.get("exposure")

        # Components are optional; missing ones are dropped (weight effectively 0).
        active: Dict[str, float] = {}
        active_weights: Dict[str, float] = {}
        if h is not None:
            active["hazard"] = h
            active_weights["hazard"] = max(weights.get("hazard", 0.0), 0.0)
        if v is not None:
            active["vulnerability"] = v
            active_weights["vulnerability"] = max(weights.get("vulnerability", 0.0), 0.0)
        if e is not None:
            active["exposure"] = e
            active_weights["exposure"] = max(weights.get("exposure", 0.0), 0.0)

        if not active or sum(active_weights.values()) <= 0:
            results[unit_id] = {
                "hazard_score": h,
                "vulnerability_score": v,
                "exposure_score": e,
                "risk_score": 0.0,
                "risk_class": "LOW",
                "components_used": [],  # informational
            }
            continue

        if formula == "ADDITIVE":
            risk_score = weighted_sum(active, active_weights)
        else:
            risk_score = weighted_geometric_mean(active, active_weights)

        results[unit_id] = {
            "hazard_score": h,
            "vulnerability_score": v,
            "exposure_score": e,
            "risk_score": risk_score,
            "risk_class": classify_risk(risk_score),
            "total_weight": round(total_weight, 2),
        }

    return results


def classify_risk(score: float, thresholds: Optional[Dict[str, float]] = None) -> str:
    """
    Map a risk score (0–10) to a risk class:
        < 4.0        → LOW
        4.0 – < 6.0  → MODERATE
        6.0 – < 8.0  → HIGH
        ≥ 8.0        → VERY_HIGH
    """
    t = thresholds or RISK_CLASS_THRESHOLDS
    if score >= t.get("VERY_HIGH", 8.0):
        return "VERY_HIGH"
    if score >= t.get("HIGH", 6.0):
        return "HIGH"
    if score >= t.get("MODERATE", 4.0):
        return "MODERATE"
    return "LOW"


def classify_risk_batch(
    scores: Dict[int, float],
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[int, str]:
    """Classify a batch of risk scores."""
    return {uid: classify_risk(s, thresholds) for uid, s in scores.items()}


def get_risk_class_summary(classes: List[str]) -> Dict[str, int]:
    """Count of each risk class, keyed by class name."""
    summary = {c: 0 for c in RISK_CLASS_ORDER}
    for cls in classes:
        if cls in summary:
            summary[cls] += 1
    return summary