"""
Fix block geometries for all three demo districts.
Assigns realistic geographic positions and larger polygon sizes.

Usage:
    python manage.py fix_block_geometries
"""
import json
from django.core.management.base import BaseCommand
from apps.administration.models import AdministrativeUnit

# Real approximate centroids for each block, sized to ~0.15° (~16km) squares
BLOCK_COORDS = {
    # ── Kottayam ──────────────────────────────────────────────────────────────
    # spread across lat 9.35–9.85, lon 76.35–76.95
    "Changanacherry [DEMO]":  (9.45, 76.54, 0.14),
    "Erattupetta [DEMO]":     (9.70, 76.80, 0.13),
    "Ettumanoor [DEMO]":      (9.58, 76.47, 0.13),
    "Kaduthuruthy [DEMO]":    (9.64, 76.60, 0.13),
    "Kanjirappally [DEMO]":   (9.56, 76.78, 0.14),
    "Kottayam [DEMO]":        (9.59, 76.52, 0.14),
    "Lalam [DEMO]":           (9.67, 76.68, 0.12),
    "Madappally [DEMO]":      (9.50, 76.43, 0.13),
    "Meenachil [DEMO]":       (9.52, 76.65, 0.13),
    "Pala [DEMO]":            (9.71, 76.68, 0.13),
    "Uzhavoor [DEMO]":        (9.62, 76.71, 0.12),
    "Vaikom [DEMO]":          (9.75, 76.40, 0.13),

    # ── Thiruvananthapuram ────────────────────────────────────────────────────
    "Nedumangad [DEMO]":            (8.60, 77.01, 0.14),
    "Chirayinkeezhu [DEMO]":        (8.68, 76.85, 0.13),
    "Kattakada [DEMO]":             (8.44, 77.08, 0.13),
    "Varkala [DEMO]":               (8.73, 76.72, 0.12),
    "Thiruvananthapuram [DEMO]":    (8.52, 76.94, 0.15),
    "Neyyattinkara [DEMO]":         (8.40, 77.09, 0.13),
    "Parassala [DEMO]":             (8.32, 77.04, 0.13),
    "Vellanad [DEMO]":              (8.59, 77.03, 0.12),
    "Aruvikkara [DEMO]":            (8.48, 76.99, 0.12),
    "Anchuthengu [DEMO]":           (8.67, 76.78, 0.12),

    # ── Ernakulam ─────────────────────────────────────────────────────────────
    "Aluva [DEMO]":         (10.10, 76.35, 0.14),
    "Angamaly [DEMO]":      (10.20, 76.38, 0.13),
    "Ernakulam [DEMO]":     (9.98,  76.30, 0.15),
    "Kanayannur [DEMO]":    (9.95,  76.28, 0.13),
    "Kothamangalam [DEMO]": (10.06, 76.63, 0.14),
    "Kunnathunadu [DEMO]":  (10.01, 76.50, 0.14),
    "Muvattupuzha [DEMO]":  (9.99,  76.58, 0.13),
    "North Paravur [DEMO]": (10.15, 76.21, 0.13),
    "Paravur [DEMO]":       (10.01, 76.21, 0.13),
    "Thrikkakara [DEMO]":   (10.03, 76.34, 0.13),
}


def make_polygon(lat, lon, size):
    """Return a square GeoJSON Polygon centred on lat/lon."""
    h = size / 2
    return {
        "type": "Polygon",
        "coordinates": [[
            [lon - h, lat - h],
            [lon + h, lat - h],
            [lon + h, lat + h],
            [lon - h, lat + h],
            [lon - h, lat - h],
        ]],
    }


class Command(BaseCommand):
    help = "Fix block geometries so they appear in the correct geographic positions on the map"

    def handle(self, *args, **kwargs):
        updated = 0
        blocks = AdministrativeUnit.objects.filter(level="BLOCK")
        for block in blocks:
            coords = BLOCK_COORDS.get(block.name)
            if coords is None:
                self.stdout.write(f"  No coords for '{block.name}' — skipping.")
                continue
            lat, lon, size = coords
            geom = make_polygon(lat, lon, size)
            block.geometry_geojson = json.dumps(geom)
            block.centroid_lat = lat
            block.centroid_lon = lon
            block.save(update_fields=["geometry_geojson", "centroid_lat", "centroid_lon"])
            updated += 1
            self.stdout.write(f"  Updated: {block.name} → ({lat}, {lon})")

        self.stdout.write(f"\nUpdated {updated} blocks.")
        self.stdout.write("Please re-run the seed commands to refresh assessment results:")
        self.stdout.write("  python manage.py seed_demo_assessment")
        self.stdout.write("  python manage.py seed_all_districts")
