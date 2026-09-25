"""
Management command: seed_linear_hazard_layers

Seeds LINEAR-feature hazard layers (HVRA §4.3) for hazards that are
line-referenced rather than polygon-referenced:

  EARTHQUAKE → active fault lineaments (with a buffer band for proximity scoring)
  CYCLONE    → historical storm tracks crossing the district

Geometry is stored as GeoJSON FeatureCollections of LineStrings. All content is
clearly labelled is_demo=True.
"""
import json
import random

from django.core.management.base import BaseCommand

from apps.administration.models import AdministrativeUnit
from apps.hazards.models import HazardLayer


def _linestring(fc_features, c_lat, c_lon, points, properties):
    coords = [
        [round(c_lon + dx, 5), round(c_lat + dy, 5)]
        for dx, dy in points
    ]
    fc_features.append({
        "type": "Feature",
        "properties": properties,
        "geometry": {"type": "LineString", "coordinates": coords},
    })


class Command(BaseCommand):
    help = "Seed demo LINE hazard layers (earthquake faults, cyclone tracks) per district."

    def handle(self, *args, **options):
        districts = AdministrativeUnit.objects.filter(level="DISTRICT")
        random.seed(2024)
        added = 0

        for district in districts:
            c_lat = district.centroid_lat or 10.0
            c_lon = district.centroid_lon or 76.5

            # --- Earthquake fault lineaments ---
            eq_name = f"{district.name} Fault Lineaments [DEMO]"
            if not HazardLayer.objects.filter(name=eq_name).exists():
                features = []
                for i in range(3):
                    _linestring(
                        features, c_lat, c_lon,
                        [(-0.25, -0.15 - i * 0.05), (-0.05, -0.04 - i * 0.05),
                         (0.12, 0.02 - i * 0.05), (0.30, 0.10 - i * 0.05)],
                        {"name": f"Lineament L{i + 1}", "hazard": "EARTHQUAKE",
                         "confidence": "moderate", "buffer_km": 15},
                    )
                HazardLayer.objects.create(
                    name=eq_name,
                    hazard_type="EARTHQUAKE",
                    geometry_type="LINE",
                    source="GSI Seismotectonic Atlas [DEMO]",
                    organization="Geological Survey of India (prototype)",
                    vintage="2023",
                    is_demo=True,
                    metadata={"buffer_km": 15.0, "features": "fault_lineaments"},
                    geometry_geojson=json.dumps({"type": "FeatureCollection", "features": features}),
                )
                added += 1

            # --- Cyclone storm tracks ---
            cy_name = f"{district.name} Cyclone Historical Tracks [DEMO]"
            if not HazardLayer.objects.filter(name=cy_name).exists():
                features = []
                for i in range(2):
                    _linestring(
                        features, c_lat, c_lon,
                        [(-0.30, 0.25), (-0.10, 0.10), (0.05, 0.02), (0.22, -0.12)],
                        {"name": f"Track {i + 1}", "hazard": "CYCLONE",
                         "category": "CS/ESCS", "buffer_km": 30},
                    )
                HazardLayer.objects.create(
                    name=cy_name,
                    hazard_type="CYCLONE",
                    geometry_type="LINE",
                    source="IMD Cyclone e-Atlas [DEMO]",
                    organization="India Meteorological Department (prototype)",
                    vintage="2023",
                    is_demo=True,
                    metadata={"buffer_km": 30.0, "features": "storm_tracks"},
                    geometry_geojson=json.dumps({"type": "FeatureCollection", "features": features}),
                )
                added += 1

        self.stdout.write(self.style.SUCCESS(
            f"Linear hazard layers seeded: {added} new LINE layer(s) across "
            f"{districts.count()} districts (EARTHQUAKE faults + CYCLONE tracks)."
        ))