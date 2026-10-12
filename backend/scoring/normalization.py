"""
scoring/normalization.py — Normalize raw indicator values to a 0–10 scale.

Methods:
  - min_max: Min-max normalization across all units in the assessment extent
  - z_score: Z-score normalization (standardization)
  - rank: Rank-based normalization

The method is configurable per assessment.
Normalization happens in the backend — NEVER in React.

All functions are pure and independently testable.
"""
from typing import List, Optional
import math
import logging

logger = logging.getLogger(__name__)


def normalize_min_max(
    value: float,
    min_val: float,
    max_val: float,
    target_min: float = 0.0,
    target_max: float = 10.0,
    direction: str = "direct",
) -> float:
    """
    Min-max normalization to [target_min, target_max].

    Direct formula:   (value - min) / (max - min) * (target_max - target_min) + target_min
    Inverted formula: (max - value) / (max - min) * (target_max - target_min) + target_min

    Args:
        value: Raw value to normalize
        min_val: Lower reference threshold Li or dataset minimum
        max_val: Upper reference threshold Ui or dataset maximum
        target_min: Lower bound of target range (default 0)
        target_max: Upper bound of target range (default 10)
        direction: 'direct' (higher=worse) or 'inverted' (higher=better/resilient)

    Returns:
        Normalized score clamped to [target_min, target_max].
        Returns target_min if max_val == min_val (zero variance / zero range).
    """
    if max_val == min_val:
        return target_min
    
    if direction.lower() in ("inverted", "inverse", "reverse"):
        normalized = (max_val - value) / (max_val - min_val) * (target_max - target_min) + target_min
    else:
        normalized = (value - min_val) / (max_val - min_val) * (target_max - target_min) + target_min
        
    return round(max(target_min, min(target_max, normalized)), 4)


def normalize_reference(
    value: float,
    lower_ref: float,
    upper_ref: float,
    direction: str = "direct",
    target_min: float = 0.0,
    target_max: float = 10.0,
) -> float:
    """
    Normalize raw indicator data using documented reference thresholds Li and Ui.

    Direct (higher value = higher hazard/vulnerability/exposure):
        Si = 10 * (x - Li) / (Ui - Li)

    Inverted (higher value = lower hazard/vulnerability, higher coping capacity):
        Si = 10 * (Ui - x) / (Ui - Li)

    Args:
        value: Observed value x
        lower_ref: Documented lower reference threshold Li
        upper_ref: Documented upper reference threshold Ui
        direction: 'direct' or 'inverted'
        target_min: Scale lower bound (0.0)
        target_max: Scale upper bound (10.0)

    Returns:
        Clamped score on [target_min, target_max].
    """
    return normalize_min_max(
        value=value,
        min_val=lower_ref,
        max_val=upper_ref,
        target_min=target_min,
        target_max=target_max,
        direction=direction,
    )


def normalize_z_score(
    value: float,
    mean: float,
    std: float,
    target_min: float = 0.0,
    target_max: float = 10.0,
    clip_sigma: float = 3.0,
    direction: str = "direct",
) -> float:
    """
    Z-score normalization clipped to ±clip_sigma standard deviations,
    then rescaled to [target_min, target_max].
    """
    if std == 0:
        return (target_min + target_max) / 2

    z = (value - mean) / std
    if direction.lower() in ("inverted", "inverse", "reverse"):
        z = -z
    z_clipped = max(-clip_sigma, min(clip_sigma, z))
    normalized = (z_clipped + clip_sigma) / (2 * clip_sigma) * (target_max - target_min) + target_min
    return round(max(target_min, min(target_max, normalized)), 4)


def normalize_rank(
    value: float,
    sorted_values: List[float],
    target_min: float = 0.0,
    target_max: float = 10.0,
    direction: str = "direct",
) -> float:
    """
    Rank-based normalization.
    """
    n = len(sorted_values)
    if n == 0:
        return target_min
    if n == 1:
        return (target_min + target_max) / 2

    ordered = sorted(sorted_values, reverse=(direction.lower() in ("inverted", "inverse", "reverse")))
    rank = ordered.index(value) + 1 if value in ordered else n // 2 + 1
    normalized = (rank - 1) / (n - 1) * (target_max - target_min) + target_min
    return round(max(target_min, min(target_max, normalized)), 4)


def normalize_batch(
    values: dict,  # {unit_id: raw_value}
    method: str = "min_max",
    target_min: float = 0.0,
    target_max: float = 10.0,
    direction: str = "direct",
    lower_ref: Optional[float] = None,
    upper_ref: Optional[float] = None,
) -> dict:  # {unit_id: normalized_value}
    """
    Normalize a batch of values across all units in the assessment extent.

    Supports:
      1. Fixed reference intervals [lower_ref, upper_ref] when provided.
      2. Dynamic batch extremes [min(x), max(x)] as fallback.
      3. Directional inversion ('direct' vs 'inverted').

    Args:
        values: Dict mapping unit_id → raw_value
        method: Normalization method ('min_max', 'reference', 'z_score', 'rank')
        target_min: Target scale minimum (default 0.0)
        target_max: Target scale maximum (default 10.0)
        direction: 'direct' or 'inverted'
        lower_ref: Optional fixed lower threshold Li
        upper_ref: Optional fixed upper threshold Ui

    Returns:
        Dict mapping unit_id → normalized_value
    """
    if not values:
        return {}

    raw_vals = [v for v in values.values() if v is not None]

    if not raw_vals:
        return {k: target_min for k in values}

    # If explicit reference thresholds are supplied, use reference normalization
    if lower_ref is not None and upper_ref is not None:
        return {
            uid: normalize_reference(
                v, lower_ref, upper_ref,
                direction=direction,
                target_min=target_min,
                target_max=target_max,
            )
            if v is not None else target_min
            for uid, v in values.items()
        }

    if method in ("min_max", "reference"):
        min_val = min(raw_vals)
        max_val = max(raw_vals)
        return {
            uid: normalize_min_max(
                v, min_val, max_val,
                target_min=target_min,
                target_max=target_max,
                direction=direction,
            )
            if v is not None else target_min
            for uid, v in values.items()
        }

    elif method == "z_score":
        mean = sum(raw_vals) / len(raw_vals)
        variance = sum((v - mean) ** 2 for v in raw_vals) / len(raw_vals)
        std = math.sqrt(variance)
        return {
            uid: normalize_z_score(
                v, mean, std,
                target_min=target_min,
                target_max=target_max,
                direction=direction,
            )
            if v is not None else target_min
            for uid, v in values.items()
        }

    elif method == "rank":
        return {
            uid: normalize_rank(
                v, raw_vals,
                target_min=target_min,
                target_max=target_max,
                direction=direction,
            )
            if v is not None else target_min
            for uid, v in values.items()
        }

    else:
        logger.warning(f"Unknown normalization method '{method}'. Using min_max.")
        return normalize_batch(
            values, method="min_max",
            target_min=target_min,
            target_max=target_max,
            direction=direction,
            lower_ref=lower_ref,
            upper_ref=upper_ref,
        )
