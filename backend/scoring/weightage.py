"""
scoring/weightage.py — Indicator weightage rules.

Applies documented weightage rules from the specification.

IMPORTANT:
  These thresholds are from the source specification document.
  Where thresholds are NOT specified, they are stored as PROTOTYPE thresholds
  and clearly flagged as configurable, not official.

All thresholds are loaded from the database (IndicatorWeightageRule),
NOT hard-coded in Python.

For the prototype, fallback defaults are provided.
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Documented weightage rules (from specification)
# Flood-prone area percentage → score
# -------------------------------------------------------
FLOOD_PRONE_AREA_DEFAULT_RULES = [
    # (range_min, range_max_exclusive, score, label, is_official)
    # Documented rules: ≤25% → 4, >25–50% → 6, >50–75% → 8, >75% → 9
    (0.0, 25.0001, 4.0, "Low", True),      # ≤25% → 4 (documented; 25.0001 ensures 25.0 is included)
    (25.0001, 50.0001, 6.0, "Moderate", True),  # >25–50% → 6 (documented)
    (50.0001, 75.0001, 8.0, "High", True),      # >50–75% → 8 (documented)
    (75.0001, None, 9.0, "Very High", True),    # >75% → 9 (documented)
]

# -------------------------------------------------------
# PROTOTYPE thresholds — event frequency scoring
# These are NOT from the specification. They are configurable.
# -------------------------------------------------------
FLOOD_EVENT_FREQUENCY_DEFAULT_RULES = [
    # (range_min, range_max_exclusive, score, label, is_official)
    (0.0, 0.0001, 0.0, "No events", False),   # 0 events → 0 (PROTOTYPE)
    (0.0001, 0.2, 6.0, "Low", False),         # 1–2 events/10yr → 6 (PROTOTYPE)
    (0.2, 0.5, 8.0, "Moderate", False),       # 2–5 events/10yr → 8 (PROTOTYPE)
    (0.5, None, 10.0, "High", False),         # >5 events/10yr → 10 (PROTOTYPE)
]

# -------------------------------------------------------
# PROTOTYPE thresholds — historical event count scoring
# -------------------------------------------------------
FLOOD_EVENT_COUNT_DEFAULT_RULES = [
    (0.0, 0.0001, 0.0, "No events", False),   # PROTOTYPE
    (0.0001, 3.0, 6.0, "Low", False),         # PROTOTYPE
    (3.0, 6.0, 8.0, "Moderate", False),       # PROTOTYPE
    (6.0, None, 10.0, "High", False),         # PROTOTYPE
]


def apply_range_rule(
    value: float,
    rules: List[tuple],
) -> Optional[float]:
    """
    Apply a set of range-based weightage rules to a value.

    Args:
        value: The indicator value to classify
        rules: List of (min, max_exclusive, score, label, is_official) tuples
               max_exclusive=None means no upper bound

    Returns:
        Score from the matching rule, or None if no rule matches.
    """
    for rule_min, rule_max, score, label, is_official in rules:
        if rule_max is None:
            if value >= rule_min:
                return score
        else:
            if rule_min <= value < rule_max:
                return score
    return None


def get_flood_prone_area_score(percentage: float, rules: Optional[List] = None) -> float:
    """
    Get score for flood-prone area percentage using documented rules.

    Documented rules (from specification):
      ≤25%    → 4
      25–50%  → 6
      50–75%  → 8
      >75%    → 9

    Args:
        percentage: Flood-prone area as percentage of total block area
        rules: Custom rules to override defaults (loaded from DB)

    Returns:
        Score (0–10 scale)
    """
    active_rules = rules or FLOOD_PRONE_AREA_DEFAULT_RULES
    score = apply_range_rule(percentage, active_rules)
    if score is None:
        logger.warning(f"No matching rule for flood_prone_area={percentage}%. Using 4.")
        return 4.0
    return score


def get_event_frequency_score(frequency: float, rules: Optional[List] = None) -> float:
    """
    Get score for event frequency using prototype thresholds.

    NOTE: These thresholds are PROTOTYPE values, not official government values.
    They are configurable via IndicatorWeightageRule.

    Args:
        frequency: Events per year
        rules: Custom rules to override defaults

    Returns:
        Score (0–10 scale)
    """
    active_rules = rules or FLOOD_EVENT_FREQUENCY_DEFAULT_RULES
    score = apply_range_rule(frequency, active_rules)
    if score is None:
        logger.warning(f"No matching rule for event_frequency={frequency}. Using 6.")
        return 6.0
    return score


def get_event_count_score(count: float, rules: Optional[List] = None) -> float:
    """
    Get score for historical event count using prototype thresholds.

    NOTE: PROTOTYPE thresholds. Configurable.

    Args:
        count: Number of historical events
        rules: Custom rules to override defaults

    Returns:
        Score (0–10 scale)
    """
    active_rules = rules or FLOOD_EVENT_COUNT_DEFAULT_RULES
    score = apply_range_rule(float(count), active_rules)
    if score is None:
        logger.warning(f"No matching rule for event_count={count}. Using 6.")
        return 6.0
    return score


def load_rules_from_db(indicator_code: str) -> Optional[List[tuple]]:
    """
    Load weightage rules from the database for a given indicator.

    Returns:
        List of (range_min, range_max, score, label, is_official) tuples,
        or None if no DB rules found.
    """
    try:
        from apps.hazards.models import IndicatorWeightageRule, HazardIndicator
        indicator = HazardIndicator.objects.filter(code=indicator_code).first()
        if not indicator:
            return None
        rules = IndicatorWeightageRule.objects.filter(indicator=indicator).order_by("range_min")
        if not rules.exists():
            return None
        return [
            (r.range_min, r.range_max, r.score, r.label, not r.is_prototype_threshold)
            for r in rules
        ]
    except Exception as e:
        logger.error(f"Failed to load rules from DB for {indicator_code}: {e}")
        return None
