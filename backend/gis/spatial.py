"""
gis/spatial.py — High-level spatial operations.

Orchestrates the full GIS processing pipeline for an assessment.
Called by the assessment processing engine (Phase 5).
"""
import logging
from typing import Dict, Any, List, Optional

from .overlays import compute_flood_prone_area_per_block, assign_events_to_blocks
from .geometry import compute_area_sqkm, compute_centroid, compute_bbox

logger = logging.getLogger(__name__)


def process_flood_assessment(
    blocks: List[Dict[str, Any]],
    flood_layers: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
    assessment_period_years: Optional[float] = None,
) -> Dict[int, Dict[str, Any]]:
    """
    Full GIS processing pipeline for a flood hazard assessment.

    Args:
        blocks: List of block dicts {id, geometry, area_sqkm, name}
        flood_layers: List of flood-prone polygon GeoJSON geometries
        events: List of event dicts {id, latitude, longitude, event_date}
        assessment_period_years: Period in years for frequency calculation

    Returns:
        Dict mapping block_id → {
            "total_area_sqkm": float,
            "flood_prone_area_sqkm": float,
            "flood_prone_percentage": float,
            "event_count": int,
            "event_frequency": float,  # events per year
        }
    """
    results = {}

    # Step 1: Compute flood-prone area per block
    logger.info(f"Computing flood-prone area for {len(blocks)} blocks...")
    flood_area_results = compute_flood_prone_area_per_block(blocks, flood_layers)

    # Step 2: Assign historical events to blocks
    logger.info(f"Assigning {len(events)} events to blocks...")
    event_assignments = assign_events_to_blocks(events, blocks)

    # Step 3: Calculate event frequency
    period_years = assessment_period_years or 10.0  # Default to 10 years if not specified

    for block in blocks:
        block_id = block["id"]
        flood_data = flood_area_results.get(block_id, {
            "flood_prone_area_sqkm": 0.0,
            "flood_prone_percentage": 0.0,
            "total_area_sqkm": block.get("area_sqkm", 0.0),
        })
        assigned_events = event_assignments.get(block_id, [])
        event_count = len(assigned_events)
        event_frequency = round(event_count / period_years, 4) if period_years > 0 else 0.0

        results[block_id] = {
            "block_id": block_id,
            "block_name": block.get("name", ""),
            "total_area_sqkm": flood_data["total_area_sqkm"],
            "flood_prone_area_sqkm": flood_data["flood_prone_area_sqkm"],
            "flood_prone_percentage": flood_data["flood_prone_percentage"],
            "event_count": event_count,
            "event_ids": assigned_events,
            "event_frequency": event_frequency,
            "period_years": period_years,
        }

    logger.info(f"GIS processing complete for {len(results)} blocks.")
    return results


def update_unit_geometry_metadata(unit) -> bool:
    """
    Update area_sqkm, centroid, and bbox for an AdministrativeUnit.

    Args:
        unit: AdministrativeUnit model instance

    Returns:
        True if updated successfully, False otherwise.
    """
    if not unit.geometry_geojson:
        return False

    geojson = unit.geometry
    if not geojson:
        return False

    area = compute_area_sqkm(geojson)
    centroid = compute_centroid(geojson)
    bbox = compute_bbox(geojson)

    updated = False

    if area is not None:
        unit.area_sqkm = area
        updated = True

    if centroid is not None:
        unit.centroid_lat, unit.centroid_lon = centroid
        updated = True

    if bbox is not None:
        unit.bbox_minx, unit.bbox_miny, unit.bbox_maxx, unit.bbox_maxy = bbox
        updated = True

    if updated:
        unit.save(update_fields=[
            "area_sqkm", "centroid_lat", "centroid_lon",
            "bbox_minx", "bbox_miny", "bbox_maxx", "bbox_maxy",
        ])

    return updated
