"""
scoring/risk.py — Module 4: Composite Risk engine.

Combines the unit-level composite scores of Hazard (H), Vulnerability (V) and
Exposure (E) assessments into a single risk score following:
1. The KSDMA Kerala HVRA Formula:
       Risk = H × V × Amount (Multi-criteria evaluation of loss potential)
2. The Generalized Weighted Geometric Mean (Multiplicative):
       Risk = (H^wH · V^wV · E^wE)^(1 / (wH + wV + wE))
3. The Additive Weighted Sum:
       Risk = (wH·H + wV·V + wE·E) / (wH + wV + wE)

Risk classes (Kerala HVRA + Unified Scale):
    < 4.0                  → LOW (or NIL / LOW)
    4.0 – < 6.0            → MODERATE / MEDIUM
    6.0 – < 8.0            → HIGH
    ≥ 8.0                  → VERY_HIGH / CRITICAL
"""
import logging
import math
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Risk class thresholds and presentation
# -------------------------------------------------------
# Default 4-Tier Scale (Kerala HVRA Atlas Standard)
RISK_CLASS_THRESHOLDS = {
    "MODERATE": 4.0,
    "HIGH": 6.0,
    "VERY_HIGH": 8.0,
}

RISK_CLASS_COLORS = {
    "VERY_HIGH": "#7f1d1d",   # deep maroon (critical compound risk)
    "HIGH": "#dc2626",        # crimson red (high risk)
    "MODERATE": "#f59e0b",    # amber / orange (moderate / medium risk)
    "LOW": "#16a34a",         # emerald green (low / negligible risk)
}

RISK_CLASS_LABELS = {
    "VERY_HIGH": "Very High Risk",
    "HIGH": "High Risk",
    "MODERATE": "Moderate Risk",
    "LOW": "Low Risk",
}

RISK_CLASS_ORDER = ["VERY_HIGH", "HIGH", "MODERATE", "LOW"]

# Alternative 5-Tier Scale (Unified Model)
# Low: 0.0–2.0, Moderate: 2.0–4.0, High: 4.0–6.0, Very High: 6.0–8.0, Extreme: 8.0–10.0
RISK_CLASS_THRESHOLDS_5_TIER = {
    "LOW": 0.0,
    "MODERATE": 2.0,
    "HIGH": 4.0,
    "VERY_HIGH": 6.0,
    "EXTREME": 8.0,
}

RISK_CLASS_COLORS_5_TIER = {
    "EXTREME": "#450a0a",     # deepest maroon/burgundy
    "VERY_HIGH": "#991b1b",   # dark red
    "HIGH": "#ea580c",        # vivid amber/orange-red
    "MODERATE": "#eab308",    # yellow/gold
    "LOW": "#16a34a",         # green
}

RISK_CLASS_LABELS_5_TIER = {
    "EXTREME": "Extreme Risk",
    "VERY_HIGH": "Very High Risk",
    "HIGH": "High Risk",
    "MODERATE": "Moderate Risk",
    "LOW": "Low Risk",
}

RISK_CLASS_ORDER_5_TIER = ["EXTREME", "VERY_HIGH", "HIGH", "MODERATE", "LOW"]


def weighted_geometric_mean(scores: Dict[str, float], weights: Dict[str, float]) -> float:
    """
    Weighted geometric mean of component scores on the 0–10 scale.
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
    except Exception as e:
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


def compute_ksdma_flood_risk(
    hazard_score: float,
    vulnerability_score: float,
    exposure_or_amount: float = 5.0,
) -> float:
    """
    Compute Risk according to Kerala HVRA guiding formula:
        R = H * V * Amount / Exposure (normalized to 0-10 scale).
    """
    h_norm = max(0.0, min(10.0, float(hazard_score or 0.0))) / 10.0
    v_norm = max(0.0, min(10.0, float(vulnerability_score or 0.0))) / 10.0
    e_norm = max(0.0, min(10.0, float(exposure_or_amount or 5.0))) / 10.0

    # Compound product scaled to 0-10
    product = (h_norm * v_norm * e_norm) ** (1.0 / 3.0) * 10.0
    return round(max(0.0, min(10.0, product)), 4)


def compute_risk_scores(
    module_scores: Dict[int, Dict[str, Optional[float]]],
    weights: Dict[str, float],
    formula: str = "MULTIPLICATIVE",
    tier_system: str = "4_tier",
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[int, Dict[str, Any]]:
    """
    Combine per-unit module composite scores into risk scores.

    Args:
        module_scores: {unit_id: {"hazard": float|None, "vulnerability": float|None,
                                  "exposure": float|None}}
        weights:       {"hazard": float, "vulnerability": float, "exposure": float}
        formula:       "MULTIPLICATIVE" (default), "ADDITIVE", or "KSDMA_HVRA"
        tier_system:   "4_tier" (default KSDMA) or "5_tier"
        thresholds:    Optional custom risk classification threshold dict

    Returns:
        {unit_id: {"hazard_score": float|None, "vulnerability_score": float|None,
                   "exposure_score": float|None, "risk_score": float,
                   "risk_class": str, "components_used": list,
                   "missing_components": list, "is_complete": bool,
                   "data_completeness_warning": str|None}}
    """
    results: Dict[int, Dict[str, Any]] = {}
    total_weight = sum(max(w, 0.0) for w in weights.values())
    expected_components = ["hazard", "vulnerability", "exposure"]

    for unit_id, comps in module_scores.items():
        h = comps.get("hazard")
        v = comps.get("vulnerability")
        e = comps.get("exposure")

        missing_components = [c for c in expected_components if comps.get(c) is None]
        is_complete = len(missing_components) == 0

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
                "components_used": [],
                "missing_components": missing_components,
                "is_complete": False,
                "data_completeness_warning": "No active components available for evaluation.",
                "total_weight": round(total_weight, 2),
            }
            continue

        if formula == "KSDMA_HVRA":
            risk_score = compute_ksdma_flood_risk(
                h or 0.0, v or 0.0, e if e is not None else 5.0
            )
        elif formula == "ADDITIVE":
            risk_score = weighted_sum(active, active_weights)
        else:
            risk_score = weighted_geometric_mean(active, active_weights)

        risk_class = classify_risk(risk_score, thresholds=thresholds, tier_system=tier_system)

        warning = None
        if not is_complete:
            warning = f"Incomplete HVRA profile. Missing component(s): {', '.join(missing_components)}."

        results[unit_id] = {
            "hazard_score": h,
            "vulnerability_score": v,
            "exposure_score": e,
            "risk_score": risk_score,
            "risk_class": risk_class,
            "components_used": list(active.keys()),
            "missing_components": missing_components,
            "is_complete": is_complete,
            "data_completeness_warning": warning,
            "total_weight": round(total_weight, 2),
        }

    return results


def classify_risk(
    score: float,
    thresholds: Optional[Dict[str, float]] = None,
    tier_system: str = "4_tier",
) -> str:
    """
    Map a risk score (0–10) to a risk class.

    Default 4-tier (KSDMA HVRA Unified Scale):
        < 4.0        → LOW
        4.0 – < 6.0  → MODERATE
        6.0 – < 8.0  → HIGH
        ≥ 8.0        → VERY_HIGH

    Optional 5-tier system:
        < 2.0        → LOW
        2.0 – < 4.0  → MODERATE
        4.0 – < 6.0  → HIGH
        6.0 – < 8.0  → VERY_HIGH
        ≥ 8.0        → EXTREME
    """
    if thresholds is not None:
        sorted_thresholds = sorted(thresholds.items(), key=lambda x: x[1], reverse=True)
        for label, threshold in sorted_thresholds:
            if score >= threshold:
                return label
        return sorted_thresholds[-1][0] if sorted_thresholds else "LOW"

    if tier_system == "5_tier":
        if score >= 8.0:
            return "EXTREME"
        if score >= 6.0:
            return "VERY_HIGH"
        if score >= 4.0:
            return "HIGH"
        if score >= 2.0:
            return "MODERATE"
        return "LOW"

    t = RISK_CLASS_THRESHOLDS
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
    tier_system: str = "4_tier",
) -> Dict[int, str]:
    """Classify a batch of risk scores."""
    return {uid: classify_risk(s, thresholds, tier_system) for uid, s in scores.items()}


def get_risk_class_summary(
    classes: List[str],
    tier_system: str = "4_tier",
) -> Dict[str, int]:
    """Count of each risk class, keyed by class name."""
    order = RISK_CLASS_ORDER_5_TIER if tier_system == "5_tier" else RISK_CLASS_ORDER
    summary = {c: 0 for c in order}
    for cls in classes:
        if cls in summary:
            summary[cls] += 1
    return summary