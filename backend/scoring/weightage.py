"""
scoring/weightage.py — Indicator weightage rules for Kerala HVRA Framework.

Implements the documented heuristic criteria and weightage tables from:
"Hazard, Vulnerability and Risk Assessment – Kerala Atlas (2020-22)"
Published by Risk Lab, KSEOC, Kerala State Disaster Management Authority (KSDMA).

Includes:
  - Flood Susceptibility (100-year return period + 2018 event inundation)
  - Physical Vulnerability (House damage percentage thresholds: <0.77%, 0.78-3.1%, >3.1%)
  - Social Vulnerability (Total population, elderly >=60, children 0-6, disabled, SC/ST, households, literacy, sex ratio)
  - Economic Vulnerability (Working pop, marginal workers, house structural types, colonies, welfare beneficiaries)
  - Environmental Vulnerability (Forests, plantations, lakes, reservoirs, beaches, rivers, wetlands)
"""
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


# -------------------------------------------------------------------------
# 1. Flood Hazard Susceptibility Rules (HVRA Table 1)
# -------------------------------------------------------------------------
FLOOD_SUSCEPTIBILITY_DEFAULT_RULES = [
    # (range_min, range_max_exclusive, score, label, is_official)
    (0.0, 0.0001, 0.0, "No Susceptibility", True),
    (0.0001, None, 10.0, "Susceptible (100-yr & 2018 Event)", True),
]

FLOOD_PRONE_AREA_DEFAULT_RULES = [
    # (range_min, range_max_exclusive, score, label, is_official)
    (0.0, 25.0001, 4.0, "Low (≤25%)", True),
    (25.0001, 50.0001, 6.0, "Moderate (25–50%)", True),
    (50.0001, 75.0001, 8.0, "High (50–75%)", True),
    (75.0001, None, 9.0, "Very High (>75%)", True),
]

FLOOD_EVENT_FREQUENCY_DEFAULT_RULES = [
    (0.0, 0.0001, 0.0, "No events", False),
    (0.0001, 0.2, 6.0, "Low (1–2 events / decade)", False),
    (0.2, 0.5, 8.0, "Moderate (2–5 events / decade)", False),
    (0.5, None, 10.0, "High (>5 events / decade)", False),
]

FLOOD_EVENT_COUNT_DEFAULT_RULES = [
    (0.0, 0.0001, 0.0, "No events", False),
    (0.0001, 3.0, 6.0, "Low (1–3 events)", False),
    (3.0, 6.0, 8.0, "Moderate (3–6 events)", False),
    (6.0, None, 10.0, "High (>6 events)", False),
]


# -------------------------------------------------------------------------
# 2. Physical Vulnerability Rules (HVRA Table 2)
# Base parameter: Percentage of house damages during 2018-2019 floods
# -------------------------------------------------------------------------
PHYSICAL_VULNERABILITY_HOUSE_DAMAGE_RULES = [
    # (range_min, range_max_exclusive, score, label, is_official)
    (0.0, 0.7701, 2.0, "Low Damage (<0.77%)", True),
    (0.7701, 3.1001, 6.0, "Moderate Damage (0.78–3.1%)", True),
    (3.1001, None, 10.0, "High Damage (>3.1%)", True),
]


# -------------------------------------------------------------------------
# 3. Social Vulnerability Rules (HVRA Table 3)
# -------------------------------------------------------------------------
SOCIAL_TOTAL_POPULATION_RULES = [
    (0.0, 15000.0, 2.0, "<15,000", True),
    (15000.0, 25000.0, 5.0, "15,000–25,000", True),
    (25000.0, 35000.0, 7.0, "25,000–35,000", True),
    (35000.0, None, 10.0, ">35,000", True),
]

SOCIAL_ELDERLY_COUNT_RULES = [
    (0.0, 5000.0, 3.0, "<5,000", True),
    (5000.0, 10000.0, 7.0, "5,000–10,000", True),
    (10000.0, None, 10.0, ">10,000", True),
]

SOCIAL_ELDERLY_PERCENT_RULES = [
    (0.0, 10.0001, 2.0, "<10%", True),
    (10.0001, 25.0001, 5.0, "10–25%", True),
    (25.0001, 50.0001, 8.0, "25–50%", True),
    (50.0001, None, 10.0, ">50%", True),
]

SOCIAL_CHILD_POPULATION_RULES = [
    (0.0, 1000.0, 2.0, "<1,000", True),
    (1000.0, 3000.0, 5.0, "1,000–3,000", True),
    (3000.0, 5000.0, 7.0, "3,000–5,000", True),
    (5000.0, None, 10.0, ">5,000", True),
]

SOCIAL_DISABLED_PERSONS_RULES = [
    (0.0, 400.0, 2.0, "<400", True),
    (400.0, 1000.0, 6.0, "400–1,000", True),
    (1000.0, None, 10.0, ">1,000", True),
]

SOCIAL_SC_ST_POPULATION_RULES = [
    (0.0, 1500.0, 3.0, "<1,500", True),
    (1500.0, 3000.0, 6.0, "1,500–3,000", True),
    (3000.0, 4500.0, 8.0, "3,000–4,500", True),
    (4500.0, None, 10.0, ">4,500", True),
]

SOCIAL_HOUSEHOLDS_COUNT_RULES = [
    (0.0, 5000.0, 2.0, "<5,000", True),
    (5000.0, 7500.0, 5.0, "5,000–7,500", True),
    (7500.0, 10000.0, 8.0, "7,500–10,000", True),
    (10000.0, None, 10.0, ">10,000", True),
]

SOCIAL_LITERACY_RATE_RULES = [
    (90.0, None, 1.0, "High Literacy (>90%)", True),
    (0.0, 90.0, 5.0, "Moderate/Low Literacy (≤90%)", True),
]

SOCIAL_SEX_RATIO_RULES = [
    (0.0, 1100.0, 5.0, "<1,100", True),
    (1100.0, None, 8.0, ">1,100 (Higher female demographic exposure)", True),
]


# -------------------------------------------------------------------------
# 4. Economic Vulnerability Rules (HVRA Table 4)
# -------------------------------------------------------------------------
ECONOMIC_WORKING_POP_RULES = [
    (0.0, 1000.0, 7.0, "<1,000 (Low economic resilience)", True),
    (1000.0, 5000.0, 4.0, "1,000–5,000", True),
    (5000.0, None, 1.0, ">5,000 (High resilience)", True),
]

ECONOMIC_MARGINAL_WORKERS_RULES = [
    (0.0, 1000.0, 2.0, "<1,000", True),
    (1000.0, None, 5.0, ">1,000", True),
]

ECONOMIC_VULNERABLE_HOUSES_RULES = [
    (0.0, 500.0, 3.0, "<500 kutcha/semi-pucca units", True),
    (500.0, 2500.0, 7.0, "500–2,500 units", True),
    (2500.0, None, 9.0, ">2,500 units", True),
]

ECONOMIC_COLONIES_RULES = [
    (0.0, 10.0, 2.0, "<10 colonies", True),
    (10.0, 25.0, 5.0, "10–25 colonies", True),
    (25.0, None, 8.0, ">25 colonies", True),
]

ECONOMIC_AAY_BENEFICIARIES_RULES = [
    (0.0, 100.0, 3.0, "<100 AAY households", True),
    (100.0, 250.0, 6.0, "100–250 AAY households", True),
    (250.0, None, 10.0, ">250 AAY households", True),
]

ECONOMIC_PHH_BENEFICIARIES_RULES = [
    (0.0, 500.0, 3.0, "<500 PHH households", True),
    (500.0, 1000.0, 8.0, "500–1,000 PHH households", True),
    (1000.0, None, 10.0, ">1,000 PHH households", True),
]


# -------------------------------------------------------------------------
# Rule evaluation helpers
# -------------------------------------------------------------------------
def apply_range_rule(
    value: float,
    rules: List[tuple],
) -> Optional[float]:
    """
    Apply a set of range-based weightage rules to a numeric value.

    Args:
        value: The indicator value to evaluate
        rules: List of (min, max_exclusive, score, label, is_official) tuples
               max_exclusive=None represents no upper bound

    Returns:
        Score from the matching rule, or None if no rule matches.
    """
    try:
        val = float(value)
    except (ValueError, TypeError):
        return None

    for rule_min, rule_max, score, label, is_official in rules:
        if rule_max is None:
            if val >= rule_min:
                return float(score)
        else:
            if rule_min <= val < rule_max:
                return float(score)
    return None


def get_flood_prone_area_score(percentage: float, rules: Optional[List] = None) -> float:
    """Get score for flood-prone area percentage (0-10 scale)."""
    active_rules = rules or FLOOD_PRONE_AREA_DEFAULT_RULES
    score = apply_range_rule(percentage, active_rules)
    return score if score is not None else 4.0


def get_house_damage_physical_score(damage_pct: float, rules: Optional[List] = None) -> float:
    """
    Get physical vulnerability score based on 2018-2019 flood house damages (Table 2).
    <0.77% -> 2.0, 0.78-3.1% -> 6.0, >3.1% -> 10.0.
    """
    active_rules = rules or PHYSICAL_VULNERABILITY_HOUSE_DAMAGE_RULES
    score = apply_range_rule(damage_pct, active_rules)
    return score if score is not None else 2.0


def get_event_frequency_score(frequency: float, rules: Optional[List] = None) -> float:
    """Get score for flood event frequency."""
    active_rules = rules or FLOOD_EVENT_FREQUENCY_DEFAULT_RULES
    score = apply_range_rule(frequency, active_rules)
    return score if score is not None else 6.0


def get_event_count_score(count: float, rules: Optional[List] = None) -> float:
    """Get score for flood historical event count."""
    active_rules = rules or FLOOD_EVENT_COUNT_DEFAULT_RULES
    score = apply_range_rule(float(count), active_rules)
    return score if score is not None else 6.0


def load_rules_from_db(indicator_code: str) -> Optional[List[tuple]]:
    """Load weightage rules from database for a specific indicator code."""
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
