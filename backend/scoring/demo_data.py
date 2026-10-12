"""
scoring/demo_data.py — Deterministic demo indicator values for the Vulnerability
and Exposure modules.

There is no live Census / SECC feed wired into the prototype, so the V and E
modules generate stable, per-block demo values (seeded from the block id so a
value never changes between runs). Every value produced here is used to compute
prototype scores ONLY, and the reports/maps flag all of this as DEMO DATA.

The raw values are relative across blocks in the selected extent — exactly like
the seeded hazard layers — so the existing normalization → weightage →
classification pipeline works unchanged.
"""
import hashlib
import random
from typing import Dict, Any, List

# Which modules are supported by the demo generator
SUPPORTED_MODULES = ("VULNERABILITY", "EXPOSURE")

# ------------------------------------------------------------------
# Per-indicator generator: code → (low, high, rounding)
# (prototype ranges; not official statistics)
# ------------------------------------------------------------------
VULNERABILITY_RANGES = {
    "POP_DENSITY": (150, 2600, 1),          # persons / sq.km
    "DEPENDENT_POPULATION": (8, 42, 1),     # % under 5 + over 60
    "DIFFERENTLY_ABLED": (1.5, 7.0, 1),     # %
    "BPL_HOUSEHOLDS": (5, 60, 1),           # %
    "LOW_LITERACY": (2, 40, 1),             # % without formal literacy
    "MARGINAL_WORKERS": (3, 35, 1),         # %
    "KUTCHA_HOUSING": (1, 45, 1),           # %
    "HEALTH_ACCESS_GAP": (2, 55, 1),        # index (0-100 gap)
    "NO_DISASTER_PLAN": (0.5, 40, 1),       # % units without DM plan
    "NO_EARLY_WARNING": (1, 55, 1),         # % households without EWS
    "HOUSE_DAMAGE_PERCENT": (0.1, 7.5, 2),  # % house damages from 2018-19 floods (KSDMA Table 2)

    # Flood Hazard-Specific Vulnerability (§6.1: Socio-Economic, Physical, Environmental, Other)
    "FLD_BPL_HOUSEHOLDS": (8.0, 55.0, 1),       # % BPL in floodplains
    "FLD_DEPENDENT_POP": (10.0, 40.0, 1),       # % dependent population
    "FLD_MARGINAL_WORKERS": (5.0, 32.0, 1),     # % daily-wage/marginal workers
    "FLD_KUTCHA_HOUSING": (3.0, 42.0, 1),       # % non-engineered housing
    "FLD_DRAINAGE_DEFICIT": (12.0, 78.0, 1),    # % stormwater drainage deficit
    "FLD_ROAD_SUBMERGENCE": (1.5, 28.0, 1),     # km low-lying submersible roads
    "FLD_WETLAND_LOSS": (4.0, 50.0, 1),         # % wetland reclamation
    "FLD_IMPERVIOUS_SURFACE": (15.0, 65.0, 1),  # % impervious runoff factor
    "FLD_HEALTH_ACCESS_GAP": (5.0, 60.0, 1),    # index health access gap
    "FLD_NO_EARLY_WARNING": (8.0, 70.0, 1),     # % households lacking EWS alert
    "FLD_NO_DM_SHELTER": (500, 8500, 0),        # shortfall in relief shelter capacity
}

EXPOSURE_RANGES = {
    "POP_IN_HAZARD_ZONE": (2000, 65000, 0),    # population counted in zone
    "CRITICAL_FACILITIES_EXPOSED": (1, 25, 0), # hospitals/schools/shelters in zone
    "AGRI_ASSETS_EXPOSED": (2, 62, 1),         # % agricultural land in zone
    "BUILTUP_EXPOSED": (3, 40, 1),             # % built-up area in zone
    "LIFELINE_LENGTH_EXPOSED": (3, 90, 1),     # km of roads/utilities in zone
    "ECONOMIC_VALUE_EXPOSED": (20, 900, 0),    # INR crore in hazard zone

    # Flood Hazard-Specific Exposure (§6.2)
    "FLD_POP_EXPOSED": (1500, 55000, 0),       # persons in inundation zone
    "FLD_RESIDENTIAL_EXPOSED": (350, 12000, 0),# count residential buildings
    "FLD_CRITICAL_FACILITIES": (2, 30, 0),     # count hospitals, schools, substations
    "FLD_AGRI_CROP_EXPOSED": (120, 4800, 0),   # hectares paddy/crop land
    "FLD_PWD_ROADS_EXPOSED": (4.0, 85.0, 1),   # km PWD & highway roads
    "FLD_ECONOMIC_ASSETS": (15, 750, 0),       # INR crore commercial assets
}

CODE_RANGES = {"VULNERABILITY": VULNERABILITY_RANGES, "EXPOSURE": EXPOSURE_RANGES}


def _stable_rng(block_id: int, code: str, salt: str = "") -> random.Random:
    """Deterministic RNG for (block, indicator) so values are stable across runs."""
    seed_str = f"{block_id}:{code}:{salt}"
    seed = int(hashlib.md5(seed_str.encode("utf-8")).hexdigest()[:12], 16)
    return random.Random(seed)


def generate_demo_indicator_values(
    blocks: List[Dict[str, Any]],
    indicator_codes: List[str],
    module_type: str,
) -> Dict[int, Dict[str, float]]:
    """
    Produce stable per-block raw indicator values for the given indicator codes.

    Args:
        blocks: List of dicts with at least {"id": int, "name": str}
        indicator_codes: Codes to generate values for (e.g. ["POP_DENSITY", ...])
        module_type: "VULNERABILITY" or "EXPOSURE"

    Returns:
        {block_id: {indicator_code: raw_value}}
    """
    ranges = CODE_RANGES.get(module_type, {})
    results: Dict[int, Dict[str, float]] = {}

    for block in blocks:
        block_id = block["id"]
        block_values: Dict[str, float] = {}
        for code in indicator_codes:
            low, high, ndigits = ranges.get(code, (0.0, 10.0, 1))
            rng = _stable_rng(block_id, code)
            value = rng.uniform(low, high)
            block_values[code] = round(value, ndigits)
        results[block_id] = block_values

    return results


def generate_demo_gis_result(
    blocks: List[Dict[str, Any]],
    indicator_codes: List[str],
    module_type: str,
) -> Dict[int, Dict[str, Any]]:
    """
    Return demo values in the same shape as gis/spatial.process_flood_assessment
    so it can be fed directly into scoring.scoring.compute_assessment_scores.
    """
    values = generate_demo_indicator_values(blocks, indicator_codes, module_type)
    out: Dict[int, Dict[str, Any]] = {}
    for block in blocks:
        block_id = block["id"]
        rec: Dict[str, Any] = {
            "block_id": block_id,
            "block_name": block.get("name", ""),
            "demo_generated": True,
            "module_type": module_type,
        }
        rec.update(values.get(block_id, {}))
        out[block_id] = rec
    return out


def default_indicators_for_module(module_type: str):
    """Look up the default active indicators for a module from the database."""
    from apps.hazards.models import HazardIndicator
    return list(
        HazardIndicator.objects.filter(
            module_type=module_type, is_active=True
        ).order_by("order")
    )