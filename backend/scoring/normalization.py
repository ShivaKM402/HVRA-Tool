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
) -> float:
    """
    Min-max normalization to [target_min, target_max].

    Formula: (value - min) / (max - min) * (target_max - target_min) + target_min

    Args:
        value: Raw value to normalize
        min_val: Minimum value in the dataset
        max_val: Maximum value in the dataset
        target_min: Lower bound of target range (default 0)
        target_max: Upper bound of target range (default 10)

    Returns:
        Normalized value in [target_min, target_max].
        Returns target_min if max_val == min_val (no variance).
    """
    if max_val == min_val:
        return target_min  # All values are equal — assign minimum
    normalized = (value - min_val) / (max_val - min_val) * (target_max - target_min) + target_min
    return round(max(target_min, min(target_max, normalized)), 4)


def normalize_z_score(
    value: float,
    mean: float,
    std: float,
    target_min: float = 0.0,
    target_max: float = 10.0,
    clip_sigma: float = 3.0,
) -> float:
    """
    Z-score normalization clipped to ±clip_sigma standard deviations,
    then rescaled to [target_min, target_max].

    Args:
        value: Raw value
        mean: Mean of the dataset
        std: Standard deviation of the dataset
        target_min: Lower bound of target range
        target_max: Upper bound of target range
        clip_sigma: Clip z-scores beyond this many std deviations

    Returns:
        Normalized value in [target_min, target_max].
    """
    if std == 0:
        return (target_min + target_max) / 2  # All values equal

    z = (value - mean) / std
    z_clipped = max(-clip_sigma, min(clip_sigma, z))
    # Map [-clip_sigma, clip_sigma] → [target_min, target_max]
    normalized = (z_clipped + clip_sigma) / (2 * clip_sigma) * (target_max - target_min) + target_min
    return round(normalized, 4)


def normalize_rank(
    value: float,
    sorted_values: List[float],
    target_min: float = 0.0,
    target_max: float = 10.0,
) -> float:
    """
    Rank-based normalization.

    Assigns scores based on rank position in the sorted list.

    Args:
        value: Raw value to normalize
        sorted_values: All values in the dataset, sorted ascending
        target_min: Lower bound of target range
        target_max: Upper bound of target range

    Returns:
        Normalized value based on rank.
    """
    n = len(sorted_values)
    if n == 0:
        return target_min
    if n == 1:
        return (target_min + target_max) / 2

    # Find rank (1-indexed)
    rank = sorted(sorted_values).index(value) + 1 if value in sorted_values else n // 2 + 1
    normalized = (rank - 1) / (n - 1) * (target_max - target_min) + target_min
    return round(normalized, 4)


def normalize_batch(
    values: dict,  # {unit_id: raw_value}
    method: str = "min_max",
    target_min: float = 0.0,
    target_max: float = 10.0,
) -> dict:  # {unit_id: normalized_value}
    """
    Normalize a batch of values across all units in the assessment extent.
    This ensures normalization is relative within the selected extent.

    Args:
        values: Dict mapping unit_id → raw_value
        method: Normalization method ('min_max', 'z_score', 'rank')
        target_min: Target scale minimum
        target_max: Target scale maximum

    Returns:
        Dict mapping unit_id → normalized_value
    """
    if not values:
        return {}

    raw_vals = [v for v in values.values() if v is not None]

    if not raw_vals:
        return {k: target_min for k in values}

    if method == "min_max":
        min_val = min(raw_vals)
        max_val = max(raw_vals)
        return {
            uid: normalize_min_max(v, min_val, max_val, target_min, target_max)
            if v is not None else target_min
            for uid, v in values.items()
        }

    elif method == "z_score":
        mean = sum(raw_vals) / len(raw_vals)
        variance = sum((v - mean) ** 2 for v in raw_vals) / len(raw_vals)
        std = math.sqrt(variance)
        return {
            uid: normalize_z_score(v, mean, std, target_min, target_max)
            if v is not None else target_min
            for uid, v in values.items()
        }

    elif method == "rank":
        sorted_vals = sorted(raw_vals)
        return {
            uid: normalize_rank(v, sorted_vals, target_min, target_max)
            if v is not None else target_min
            for uid, v in values.items()
        }

    else:
        logger.warning(f"Unknown normalization method '{method}'. Using min_max.")
        return normalize_batch(values, method="min_max", target_min=target_min, target_max=target_max)
