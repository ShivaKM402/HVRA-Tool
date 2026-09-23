"""
scoring/scoring.py — Composite hazard score computation.

Architecture:
  raw_value → normalized_value → weighted_score → composite_score

The scoring engine is isolated and independently testable.
All scoring happens in the backend — NEVER in React.
"""
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


def compute_weighted_score(
    normalized_value: float,
    weight: float,
    total_weight: float,
) -> float:
    """
    Compute weighted score for a single indicator.

    Formula: weighted_score = normalized_value × (weight / total_weight)

    Args:
        normalized_value: Value on 0–10 scale
        weight: Indicator weight (0–10)
        total_weight: Sum of all indicator weights

    Returns:
        Weighted score contribution.
    """
    if total_weight <= 0:
        return 0.0
    return round(normalized_value * (weight / total_weight), 4)


def compute_composite_score(
    indicator_scores: List[Dict[str, float]],
) -> float:
    """
    Compute composite hazard score from multiple indicator weighted scores.

    Args:
        indicator_scores: List of dicts with keys:
          - normalized_value: float (0–10)
          - weight: float (0–10)

    Returns:
        Composite score on 0–10 scale.
    """
    if not indicator_scores:
        return 0.0

    total_weight = sum(s.get("weight", 0.0) for s in indicator_scores)
    if total_weight <= 0:
        return 0.0

    composite = sum(
        s.get("normalized_value", 0.0) * s.get("weight", 0.0)
        for s in indicator_scores
    ) / total_weight

    return round(max(0.0, min(10.0, composite)), 4)


def compute_assessment_scores(
    gis_results: Dict[int, Dict[str, Any]],
    indicator_configs: List[Dict[str, Any]],
    normalization_method: str = "min_max",
) -> Dict[int, Dict[str, Any]]:
    """
    Full scoring pipeline for all blocks in an assessment.

    Pipeline:
      GIS raw values
      → indicator-level scores (weightage rules)
      → batch normalization (relative to assessment extent)
      → weighted scores
      → composite score

    Args:
        gis_results: Dict mapping block_id → GIS results dict
                     Keys: flood_prone_percentage, event_count, event_frequency
        indicator_configs: List of dicts with:
          - code: indicator code
          - weight: user-configured weight
          - normalization_method: override (optional)
        normalization_method: Default normalization method

    Returns:
        Dict mapping block_id → {
            "raw_values": {indicator_code: float},
            "indicator_scores": {indicator_code: {raw, normalized, weight, weighted}},
            "composite_score": float,
        }
    """
    from .normalization import normalize_batch
    from .weightage import (
        get_flood_prone_area_score,
        get_event_count_score,
        get_event_frequency_score,
        load_rules_from_db,
    )

    if not gis_results or not indicator_configs:
        return {}

    # -------------------------------------------------------
    # Step 1: Extract raw values per indicator per block
    # -------------------------------------------------------
    raw_values_by_indicator = {}  # {indicator_code: {block_id: raw_value}}

    for indicator in indicator_configs:
        code = indicator["code"]
        raw_values_by_indicator[code] = {}

        for block_id, gis_data in gis_results.items():
            if code == "FLOOD_PRONE_AREA":
                raw = gis_data.get("flood_prone_percentage", 0.0)
            elif code == "HISTORICAL_FLOOD_EVENTS":
                raw = float(gis_data.get("event_count", 0))
            elif code == "FLOOD_FREQUENCY":
                raw = gis_data.get("event_frequency", 0.0)
            elif code == "TOTAL_AREA":
                raw = gis_data.get("total_area_sqkm", 0.0)
            else:
                raw = 0.0
            raw_values_by_indicator[code][block_id] = raw

    # -------------------------------------------------------
    # Step 2: Get indicator-level scores (pre-normalization)
    # Using weightage rules for flood-specific scoring
    # -------------------------------------------------------
    indicator_rule_scores = {}  # {indicator_code: {block_id: rule_score}}

    for indicator in indicator_configs:
        code = indicator["code"]
        db_rules = load_rules_from_db(code)
        indicator_rule_scores[code] = {}

        for block_id, raw in raw_values_by_indicator[code].items():
            if code == "FLOOD_PRONE_AREA":
                score = get_flood_prone_area_score(raw, db_rules)
            elif code == "HISTORICAL_FLOOD_EVENTS":
                score = get_event_count_score(raw, db_rules)
            elif code == "FLOOD_FREQUENCY":
                score = get_event_frequency_score(raw, db_rules)
            elif code == "TOTAL_AREA":
                score = raw  # Pass through area (normalized separately)
            else:
                score = raw
            indicator_rule_scores[code][block_id] = score

    # -------------------------------------------------------
    # Step 3: Normalize rule scores across blocks
    # (relative normalization within the assessment extent)
    # -------------------------------------------------------
    normalized_scores_by_indicator = {}

    for indicator in indicator_configs:
        code = indicator["code"]
        method = indicator.get("normalization_method") or normalization_method
        raw_scores = indicator_rule_scores[code]
        normalized_scores_by_indicator[code] = normalize_batch(
            raw_scores, method=method
        )

    # -------------------------------------------------------
    # Step 4: Compute composite score per block
    # -------------------------------------------------------
    total_weight = sum(ind.get("weight", 0.0) for ind in indicator_configs)
    results = {}

    for block_id in gis_results:
        block_indicator_data = []
        indicator_detail = {}

        for indicator in indicator_configs:
            code = indicator["code"]
            weight = indicator.get("weight", 5.0)
            raw_val = raw_values_by_indicator[code].get(block_id, 0.0)
            rule_score = indicator_rule_scores[code].get(block_id, 0.0)
            norm_val = normalized_scores_by_indicator[code].get(block_id, 0.0)
            w_score = compute_weighted_score(norm_val, weight, total_weight)

            indicator_detail[code] = {
                "raw_value": raw_val,
                "rule_score": rule_score,
                "normalized_value": norm_val,
                "weight": weight,
                "weighted_score": w_score,
            }
            block_indicator_data.append({
                "normalized_value": norm_val,
                "weight": weight,
            })

        composite = compute_composite_score(block_indicator_data)

        results[block_id] = {
            "block_id": block_id,
            "raw_values": {code: raw_values_by_indicator[code].get(block_id) for code in raw_values_by_indicator},
            "indicator_scores": indicator_detail,
            "composite_score": composite,
        }

    return results
