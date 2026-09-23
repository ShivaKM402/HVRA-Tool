"""
gis/geometry.py — Geometry utilities.

Handles:
- Loading geometries from GeoJSON (dict or text)
- Computing area in sq. km
- Computing centroids
- Computing bounding boxes
- Checking geometry validity
- Reprojecting to/from WGS84
"""
import json
import logging
from typing import Optional, Tuple, Dict, Any

try:
    import geopandas as gpd
    from shapely.geometry import shape, mapping
    from shapely.validation import explain_validity
    import pyproj
    from pyproj import Transformer
    HAS_GEOPANDAS = True
except ImportError:
    HAS_GEOPANDAS = False
    logging.warning("GeoPandas/Shapely not available. GIS features will be limited.")

logger = logging.getLogger(__name__)


def geojson_to_shapely(geojson: Dict[str, Any]):
    """
    Convert a GeoJSON geometry dict to a Shapely geometry.

    Args:
        geojson: GeoJSON geometry dict or Feature dict.
                 Handles both {"type": "Polygon", ...} and {"type": "Feature", "geometry": {...}}.

    Returns:
        Shapely geometry object, or None if conversion fails.
    """
    if not HAS_GEOPANDAS:
        logger.error("Shapely not available.")
        return None
    if geojson is None:
        return None
    try:
        # Unwrap Feature to bare geometry if needed
        geo_type = geojson.get("type", "") if isinstance(geojson, dict) else ""
        if geo_type.lower() == "feature":
            geojson = geojson.get("geometry")
        elif geo_type.lower() == "featurecollection":
            # Return union of all feature geometries
            from shapely.ops import unary_union
            geoms = [
                shape(f["geometry"])
                for f in geojson.get("features", [])
                if f.get("geometry")
            ]
            return unary_union(geoms) if geoms else None
        if not geojson:
            return None
        return shape(geojson)
    except Exception as e:
        logger.error(f"Failed to convert GeoJSON to Shapely: {e}")
        return None


def shapely_to_geojson(geom) -> Optional[Dict[str, Any]]:
    """
    Convert a Shapely geometry to a GeoJSON dict.

    Args:
        geom: Shapely geometry object

    Returns:
        GeoJSON geometry dict, or None.
    """
    if not HAS_GEOPANDAS or geom is None:
        return None
    try:
        return mapping(geom)
    except Exception as e:
        logger.error(f"Failed to convert Shapely to GeoJSON: {e}")
        return None


def compute_area_sqkm(geojson: Dict[str, Any]) -> Optional[float]:
    """
    Compute the area of a polygon geometry in square kilometres.

    The geometry is assumed to be in WGS84 (EPSG:4326).
    We reproject to an equal-area projection (EPSG:6933) for accurate area calculation.

    Args:
        geojson: GeoJSON geometry dict in WGS84

    Returns:
        Area in sq. km, or None if computation fails.
    """
    if not HAS_GEOPANDAS:
        return None

    geom = geojson_to_shapely(geojson)
    if geom is None or geom.is_empty:
        return None

    try:
        # Create a GeoDataFrame and reproject
        gdf = gpd.GeoDataFrame(geometry=[geom], crs="EPSG:4326")
        gdf_projected = gdf.to_crs("EPSG:6933")  # Equal-area projection
        area_m2 = float(gdf_projected.geometry.iloc[0].area)
        area_sqkm = area_m2 / 1_000_000
        return round(area_sqkm, 4)
    except Exception as e:
        logger.error(f"Area calculation failed: {e}")
        return None


def compute_centroid(geojson: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    """
    Compute the centroid of a geometry.

    Returns:
        (latitude, longitude) tuple in WGS84, or None.
    """
    if not HAS_GEOPANDAS:
        return None

    geom = geojson_to_shapely(geojson)
    if geom is None:
        return None

    try:
        centroid = geom.centroid
        return (round(centroid.y, 6), round(centroid.x, 6))
    except Exception as e:
        logger.error(f"Centroid calculation failed: {e}")
        return None


def compute_bbox(geojson: Dict[str, Any]) -> Optional[Tuple[float, float, float, float]]:
    """
    Compute the bounding box of a geometry.

    Returns:
        (minx, miny, maxx, maxy) tuple, or None.
    """
    if not HAS_GEOPANDAS:
        return None

    geom = geojson_to_shapely(geojson)
    if geom is None:
        return None

    try:
        return geom.bounds  # (minx, miny, maxx, maxy)
    except Exception as e:
        logger.error(f"Bounding box calculation failed: {e}")
        return None


def is_valid_geometry(geojson: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Check if a geometry is valid.

    Returns:
        (is_valid, reason) tuple.
    """
    if not HAS_GEOPANDAS:
        return (True, "Validation skipped — Shapely not available.")

    geom = geojson_to_shapely(geojson)
    if geom is None:
        return (False, "Could not parse geometry.")

    if geom.is_valid:
        return (True, "Valid")
    else:
        reason = explain_validity(geom)
        return (False, reason)


def point_in_polygon(point_lon: float, point_lat: float, polygon_geojson: Dict[str, Any]) -> bool:
    """
    Check if a point (lon, lat) is within a polygon.

    Args:
        point_lon: Longitude
        point_lat: Latitude
        polygon_geojson: GeoJSON polygon geometry dict

    Returns:
        True if point is within or on the boundary of the polygon.
    """
    if not HAS_GEOPANDAS:
        return False

    try:
        from shapely.geometry import Point
        point = Point(point_lon, point_lat)
        polygon = geojson_to_shapely(polygon_geojson)
        if polygon is None:
            return False
        return polygon.contains(point) or polygon.boundary.contains(point)
    except Exception as e:
        logger.error(f"Point-in-polygon test failed: {e}")
        return False
