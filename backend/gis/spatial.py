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


def process_linear_hazard_assessment(
    blocks: List[Dict[str, Any]],
    line_layers: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
    buffer_km: float = 15.0,
    period_years: float = 10.0,
) -> Dict[int, Dict[str, Any]]:
    """
    Buffered-proximity assessment for LINEAR-feature hazards (HVRA §4.3).

    Fault lines and cyclone tracks are LineString layers. Instead of a polygon
    overlay, each unit is scored by its distance to the nearest linear feature:

        affected_share = max(0, 1 - distance_km / buffer_km) * 100

    Distances are computed with haversine point-to-segment math (no GeoPandas
    dependency) from the unit centroid. Event counts/frequency are carried
    through the same event-assignment logic.

    Returns:
        Dict mapping block_id → {
            "hazard_prone_percentage": float (0–100),
            "hazard_prone_area_sqkm": float,
            "total_area_sqkm": float,
            "nearest_distance_km": float,
            "event_count": int,
            "event_ids": list[int],
            "event_frequency": float,
            "period_years": float,
        }
    """
    import math

    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371.0
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lon2 - lon1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return 2 * r * math.asin(min(1.0, math.sqrt(a)))

    def _clamp(x: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, x))

    def _point_segment_km(p_lat: float, p_lon: float,
                          a_lat: float, a_lon: float,
                          b_lat: float, b_lon: float) -> float:
        """Rough point-to-segment distance in km (equirectangular local grid)."""
        lat_m = (a_lat + b_lat) / 2.0
        dx_scale = 111.32 * math.cos(math.radians(abs(lat_m)) + 1e-9)  # km per deg lon
        dy_scale = 110.574  # km per deg lat
        ax, ay = (a_lon - 0.0) * dx_scale, (a_lat - 0.0) * dy_scale
        bx, by = (b_lon - 0.0) * dx_scale, (b_lat - 0.0) * dy_scale
        px, py = (p_lon - 0.0) * dx_scale, (p_lat - 0.0) * dy_scale
        abx, aby = bx - ax, by - ay
        length2 = abx * abx + aby * aby
        if length2 < 1e-12:
            return math.hypot(px - ax, py - ay)
        t = _clamp(((px - ax) * abx + (py - ay) * aby) / length2, 0.0, 1.0)
        return math.hypot(px - (ax + t * abx), py - (ay + t * aby))

    def _unwrap(layer: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Unwrap {"geometry": [...]} wrappers to the bare GeoJSON geometry."""
        if not isinstance(layer, dict):
            return None
        if "geometry" in layer and layer.get("type") not in (
            "Feature", "FeatureCollection", "Polygon", "MultiPolygon",
            "LineString", "MultiLineString", "Point", "MultiPoint",
            "GeometryCollection",
        ):
            return _unwrap(layer.get("geometry"))
        return layer

    def _segments(layer: Dict[str, Any]) -> List[tuple]:
        """Yield (lat, lon) vertex pairs as segments from a LINE layer entry."""
        raw = _unwrap(layer)
        if not raw:
            return []
        gtype = raw.get("type", "")
        coords = raw.get("coordinates") or []
        segs: List[tuple] = []

        def push(parts):
            for i in range(len(parts) - 1):
                try:
                    segs.append(((parts[i][1], parts[i][0]), (parts[i + 1][1], parts[i + 1][0])))
                except (IndexError, TypeError):
                    continue

        if gtype == "Feature":
            return _segments({"type": raw.get("geometry", {}).get("type", ""),
                              "coordinates": raw.get("geometry", {}).get("coordinates", [])})
        if gtype == "FeatureCollection":
            for f in raw.get("features", []):
                segs.extend(_segments(f))
        elif gtype == "LineString":
            push(coords)
        elif gtype == "MultiLineString":
            for part in coords:
                push(part)
        return segs

    # Collect all line segments once
    all_segments: List[tuple] = []
    for layer in line_layers:
        all_segments.extend(_segments(layer))
    logger.info(f"Collected {len(all_segments)} linear-feature segments "
                f"across {len(line_layers)} line layer(s).")

    # Event assignment (same as polygon pipeline)
    event_assignments = assign_events_to_blocks(events, blocks)

    results: Dict[int, Dict[str, Any]] = {}
    for block in blocks:
        block_id = block["id"]
        lat, lon = None, None
        if block.get("centroid_lat") is not None and block.get("centroid_lon") is not None:
            lat, lon = block["centroid_lat"], block["centroid_lon"]
        elif block.get("geometry"):
            centroid = compute_centroid(block.get("geometry"))
            if centroid:
                lat, lon = centroid
        if lat is None or lon is None:
            lat, lon = 10.5, 76.2

        nearest_km = None
        for (a_lat, a_lon), (b_lat, b_lon) in all_segments:
            d = _point_segment_km(lat, lon, a_lat, a_lon, b_lat, b_lon)
            nearest_km = d if nearest_km is None else min(nearest_km, d)
        if nearest_km is None:
            nearest_km = float(buffer_km + 1.0)

        share = max(0.0, 1.0 - nearest_km / buffer_km) * 100.0
        total_area = block.get("area_sqkm") or 120.0
        assigned_events = event_assignments.get(block_id, [])
        event_count = len(assigned_events)
        event_frequency = round(event_count / period_years, 4) if period_years > 0 else 0.0

        results[block_id] = {
            "block_id": block_id,
            "block_name": block.get("name", ""),
            "total_area_sqkm": round(float(total_area), 4),
            "hazard_prone_area_sqkm": round(float(total_area) * share / 100.0, 4),
            "hazard_prone_percentage": round(min(share, 100.0), 2),
            "flood_prone_percentage": round(min(share, 100.0), 2),
            "flood_prone_area_sqkm": round(float(total_area) * share / 100.0, 4),
            "nearest_distance_km": round(nearest_km, 2),
            "buffer_km": buffer_km,
            "event_count": event_count,
            "event_ids": assigned_events,
            "event_frequency": event_frequency,
            "period_years": period_years,
            "linear_feature": True,
        }

    logger.info(f"Linear-feature GIS processing complete for {len(results)} units.")
    return results
