"""
gis/overlays.py — Polygon overlay operations.

Handles:
- Computing intersection area between flood-prone polygons and admin blocks
- Computing flood-prone percentage per block
- Assigning point events to blocks
"""
import logging
from typing import List, Dict, Any, Optional

try:
    import geopandas as gpd
    from shapely.geometry import shape, mapping
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False

from .geometry import geojson_to_shapely, compute_area_sqkm

logger = logging.getLogger(__name__)


def compute_flood_prone_area_per_block(
    blocks: List[Dict[str, Any]],
    flood_polygons: List[Dict[str, Any]],
) -> Dict[int, Dict[str, float]]:
    """
    Compute flood-prone area within each administrative block.

    Args:
        blocks: List of dicts with keys: id, geometry (GeoJSON dict)
        flood_polygons: List of GeoJSON geometry dicts for flood-prone areas

    Returns:
        Dict mapping block_id → {
            "flood_prone_area_sqkm": float,
            "flood_prone_percentage": float,
            "total_area_sqkm": float,
        }

    Formula:
        flood_prone_percentage = flood_prone_area / total_block_area × 100
    """
    if not HAS_GEOPANDAS:
        logger.error("GeoPandas not available — cannot compute flood-prone area.")
        return {}

    results = {}

    # Build a union of all flood polygons for efficiency
    flood_geoms = []
    for layer in flood_polygons:
        # layer may be a bare geometry, Feature, FeatureCollection, or {"geometry": {...}} wrapper
        if isinstance(layer, dict):
            if "geometry" in layer and layer.get("type") not in ("Feature", "FeatureCollection", "Polygon", "MultiPolygon", "GeometryCollection"):
                # It's a wrapper dict like {"geometry": <geojson>}
                raw = layer["geometry"]
            else:
                raw = layer
        else:
            raw = layer
        geom = geojson_to_shapely(raw)
        if geom and not geom.is_empty:
            flood_geoms.append(geom)

    if not flood_geoms:
        logger.warning("No valid flood polygons provided.")
        # Return zero flood area for all blocks
        for block in blocks:
            results[block["id"]] = {
                "flood_prone_area_sqkm": 0.0,
                "flood_prone_percentage": 0.0,
                "total_area_sqkm": block.get("area_sqkm", 0.0),
            }
        return results

    try:
        from shapely.ops import unary_union
        flood_union = unary_union(flood_geoms)
    except Exception as e:
        logger.error(f"Failed to union flood polygons: {e}")
        flood_union = None

    for block in blocks:
        block_id = block["id"]
        block_geojson = block.get("geometry")

        if not block_geojson:
            results[block_id] = {
                "flood_prone_area_sqkm": 0.0,
                "flood_prone_percentage": 0.0,
                "total_area_sqkm": block.get("area_sqkm", 0.0),
            }
            continue

        block_geom = geojson_to_shapely(block_geojson)
        if block_geom is None or block_geom.is_empty:
            results[block_id] = {
                "flood_prone_area_sqkm": 0.0,
                "flood_prone_percentage": 0.0,
                "total_area_sqkm": block.get("area_sqkm", 0.0),
            }
            continue

        # Compute block area
        total_area = block.get("area_sqkm") or compute_area_sqkm(block_geojson) or 0.0

        # Compute intersection
        flood_prone_area = 0.0
        if flood_union is not None:
            try:
                intersection = block_geom.intersection(flood_union)
                if not intersection.is_empty:
                    # Project intersection to equal-area CRS for area computation
                    intersection_geojson = mapping(intersection)
                    flood_prone_area = compute_area_sqkm(intersection_geojson) or 0.0
            except Exception as e:
                logger.error(f"Intersection failed for block {block_id}: {e}")

        flood_prone_pct = (flood_prone_area / total_area * 100) if total_area > 0 else 0.0

        results[block_id] = {
            "flood_prone_area_sqkm": round(flood_prone_area, 4),
            "flood_prone_percentage": round(min(flood_prone_pct, 100.0), 2),
            "total_area_sqkm": round(total_area, 4),
        }

    return results


def assign_events_to_blocks(
    events: List[Dict[str, Any]],
    blocks: List[Dict[str, Any]],
) -> Dict[int, List[int]]:
    """
    Assign point events to blocks using spatial containment.

    Args:
        events: List of dicts with keys: id, latitude, longitude
        blocks: List of dicts with keys: id, geometry (GeoJSON dict)

    Returns:
        Dict mapping block_id → list of event IDs within that block
    """
    if not HAS_GEOPANDAS:
        return {}

    from shapely.geometry import Point

    # Build block geometries
    block_geoms = {}
    for block in blocks:
        geom = geojson_to_shapely(block.get("geometry", {}))
        if geom:
            block_geoms[block["id"]] = geom

    assignments = {block["id"]: [] for block in blocks}

    for event in events:
        lat = event.get("latitude")
        lon = event.get("longitude")
        if lat is None or lon is None:
            continue

        point = Point(lon, lat)
        for block_id, block_geom in block_geoms.items():
            try:
                if block_geom.contains(point) or block_geom.boundary.contains(point):
                    assignments[block_id].append(event["id"])
                    break  # assign to first matching block
            except Exception as e:
                logger.error(f"Point assignment failed for event {event['id']}: {e}")

    return assignments
