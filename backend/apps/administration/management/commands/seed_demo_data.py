"""
Management command: seed_demo_data

Creates all required demo data for the HVRA prototype:
- Kerala (State)
- Ernakulam District (pilot district)
- 8 Blocks with realistic synthetic geometries
- Demo flood-prone polygon layers
- Demo historical flood events (clearly labelled DEMO DATA)
- Hazard type definitions
- Flood indicators with default weights
- Weightage rules
- Data sources

IMPORTANT:
  All created records have is_demo=True.
  This data is NOT official government data.
  It is DEMO DATA for prototype demonstration only.
  Real official datasets can replace this data after installation.

Run with:
  python manage.py seed_demo_data
  python manage.py seed_demo_data --clear  (removes existing demo data first)
"""
import json
import random
import math
from datetime import date, datetime
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Seed DEMO DATA for the HVRA prototype. NOT official government data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing demo data before seeding.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("=" * 60))
        self.stdout.write(self.style.WARNING("DEMO DATA SEEDING"))
        self.stdout.write(self.style.WARNING("This data is NOT official government data."))
        self.stdout.write(self.style.WARNING("All records are clearly labelled as DEMO DATA."))
        self.stdout.write(self.style.WARNING("=" * 60))

        if options["clear"]:
            self._clear_demo_data()

        with transaction.atomic():
            self._seed_hazard_types()
            self._seed_indicators()
            self._seed_data_sources()
            self._seed_administrative_hierarchy()
            self._seed_flood_layers()
            self._seed_historical_events()

        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("Demo data seeding complete!"))
        self.stdout.write(self.style.SUCCESS("You can now run the development server."))
        self.stdout.write(self.style.SUCCESS("=" * 60))

    def _clear_demo_data(self):
        """Remove all existing demo data."""
        self.stdout.write("Clearing existing demo data...")
        from apps.administration.models import AdministrativeUnit
        from apps.hazards.models import HazardEvent, HazardLayer, HazardIndicator, IndicatorWeightageRule, HazardType
        from apps.datasets.models import DataSource

        AdministrativeUnit.objects.filter(is_demo=True).delete()
        HazardEvent.objects.filter(is_demo=True).delete()
        HazardLayer.objects.filter(is_demo=True).delete()
        IndicatorWeightageRule.objects.all().delete()
        HazardIndicator.objects.all().delete()
        HazardType.objects.all().delete()
        DataSource.objects.filter(is_demo=True).delete()
        self.stdout.write(self.style.WARNING("Demo data cleared."))

    def _seed_hazard_types(self):
        """Seed the hazard type catalogue."""
        from apps.hazards.models import HazardType

        hazards = [
            {
                "code": "FLOOD",
                "name": "Flood",
                "description": (
                    "Flooding occurs when water inundates land that is normally dry. "
                    "Includes riverine floods, flash floods, and coastal floods."
                ),
                "is_active": True,
                "icon": "💧",
                "color": "#3B82F6",
            },
            {
                "code": "EARTHQUAKE",
                "name": "Earthquake",
                "description": "Ground shaking caused by seismic activity.",
                "is_active": False,
                "icon": "🌍",
                "color": "#8B5CF6",
            },
            {
                "code": "CYCLONE",
                "name": "Cyclone",
                "description": "Tropical cyclones with high-speed winds and heavy rainfall.",
                "is_active": False,
                "icon": "🌀",
                "color": "#06B6D4",
            },
            {
                "code": "LANDSLIDE",
                "name": "Landslide",
                "description": "Mass movement of rock, debris, or earth down a slope.",
                "is_active": False,
                "icon": "⛰️",
                "color": "#92400E",
            },
            {
                "code": "DROUGHT",
                "name": "Drought",
                "description": "Prolonged period of abnormally low rainfall.",
                "is_active": False,
                "icon": "☀️",
                "color": "#D97706",
            },
            {
                "code": "FOREST_FIRE",
                "name": "Forest Fire",
                "description": "Uncontrolled fires in forest areas.",
                "is_active": False,
                "icon": "🔥",
                "color": "#DC2626",
            },
        ]

        for h in hazards:
            HazardType.objects.update_or_create(code=h["code"], defaults=h)

        self.stdout.write(f"  [OK] Created {len(hazards)} hazard types")

    def _seed_indicators(self):
        """Seed flood hazard indicators with default weights and weightage rules."""
        from apps.hazards.models import HazardIndicator, IndicatorWeightageRule

        indicators = [
            {
                "hazard_type": "FLOOD",
                "code": "TOTAL_AREA",
                "name": "Total Administrative Area",
                "description": "Total area of the administrative unit in sq. km.",
                "unit": "sq. km",
                "default_weight": 2.0,
                "order": 1,
                "rules": [],  # No scoring rules — used as context
            },
            {
                "hazard_type": "FLOOD",
                "code": "FLOOD_PRONE_AREA",
                "name": "Flood-prone Area",
                "description": (
                    "Area within the administrative unit that is classified as flood-prone "
                    "based on historical data and terrain analysis."
                ),
                "unit": "sq. km",
                "default_weight": 8.0,
                "order": 2,
                "rules": [
                    # Documented rules from specification
                    {
                        "label": "Low",
                        "range_min": 0.0,
                        "range_max": 25.0,
                        "score": 4.0,
                        "description": "≤25% flood-prone area (documented threshold)",
                        "is_prototype_threshold": False,
                    },
                    {
                        "label": "Moderate",
                        "range_min": 25.0,
                        "range_max": 50.0,
                        "score": 6.0,
                        "description": "25–50% flood-prone area (documented threshold)",
                        "is_prototype_threshold": False,
                    },
                    {
                        "label": "High",
                        "range_min": 50.0,
                        "range_max": 75.0,
                        "score": 8.0,
                        "description": "50–75% flood-prone area (documented threshold)",
                        "is_prototype_threshold": False,
                    },
                    {
                        "label": "Very High",
                        "range_min": 75.0,
                        "range_max": None,
                        "score": 9.0,
                        "description": ">75% flood-prone area (documented threshold)",
                        "is_prototype_threshold": False,
                    },
                ],
            },
            {
                "hazard_type": "FLOOD",
                "code": "HISTORICAL_FLOOD_EVENTS",
                "name": "Number of Historical Flood Events",
                "description": "Count of historical flood events recorded within the administrative unit.",
                "unit": "count",
                "default_weight": 8.0,
                "order": 3,
                "rules": [
                    # PROTOTYPE thresholds — NOT official
                    {
                        "label": "No events",
                        "range_min": 0.0,
                        "range_max": 0.0001,
                        "score": 0.0,
                        "description": "No recorded events (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                    {
                        "label": "Low",
                        "range_min": 0.0001,
                        "range_max": 3.0,
                        "score": 6.0,
                        "description": "1–2 events (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                    {
                        "label": "Moderate",
                        "range_min": 3.0,
                        "range_max": 6.0,
                        "score": 8.0,
                        "description": "3–5 events (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                    {
                        "label": "High",
                        "range_min": 6.0,
                        "range_max": None,
                        "score": 10.0,
                        "description": "6+ events (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                ],
            },
            {
                "hazard_type": "FLOOD",
                "code": "FLOOD_FREQUENCY",
                "name": "Flood Frequency",
                "description": "Number of flood events per defined assessment period (per year).",
                "unit": "events/year",
                "default_weight": 6.0,
                "order": 4,
                "rules": [
                    # PROTOTYPE thresholds — NOT official
                    {
                        "label": "No events",
                        "range_min": 0.0,
                        "range_max": 0.0001,
                        "score": 0.0,
                        "description": "Zero frequency (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                    {
                        "label": "Low frequency",
                        "range_min": 0.0001,
                        "range_max": 0.2,
                        "score": 6.0,
                        "description": "Low frequency — <0.2 events/year (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                    {
                        "label": "Moderate frequency",
                        "range_min": 0.2,
                        "range_max": 0.5,
                        "score": 8.0,
                        "description": "Moderate frequency — 0.2–0.5 events/year (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                    {
                        "label": "High frequency",
                        "range_min": 0.5,
                        "range_max": None,
                        "score": 10.0,
                        "description": "High frequency — >0.5 events/year (PROTOTYPE threshold)",
                        "is_prototype_threshold": True,
                    },
                ],
            },
        ]

        for ind_data in indicators:
            rules_data = ind_data.pop("rules")
            indicator, created = HazardIndicator.objects.update_or_create(
                code=ind_data["code"],
                defaults=ind_data,
            )
            # Create rules
            IndicatorWeightageRule.objects.filter(indicator=indicator).delete()
            for rule in rules_data:
                IndicatorWeightageRule.objects.create(indicator=indicator, **rule)

        self.stdout.write(f"  [OK] Created {len(indicators)} indicators with weightage rules")

    def _seed_data_sources(self):
        """Seed demo data sources for Kottayam pilot district."""
        from apps.datasets.models import DataSource

        sources = [
            {
                "name": "Kottayam Administrative Boundaries [DEMO]",
                "organization": "DEMO DATA — Synthetic Boundaries",
                "description": (
                    "Synthetic administrative boundaries for Kottayam pilot district and blocks. "
                    "Created for prototype demonstration. DO NOT use for official government planning."
                ),
                "source_url": "",
                "vintage": "Kottayam District (2026)",
                "last_updated": date(2026, 1, 1),
                "is_builtin": True,
                "is_demo": True,
                "metadata": {
                    "data_type": "Administrative Boundaries",
                    "coverage": "Kottayam District",
                    "status": "DEMO DATA",
                    "crs": "EPSG:4326",
                    "disclaimer": "DEMO DATA — Not official administrative boundaries",
                },
            },
            {
                "name": "Kottayam Flood Data [DEMO]",
                "organization": "DEMO DATA — Synthetic Flood Zones",
                "description": (
                    "Synthetic flood-prone area polygons for Kottayam district. "
                    "Created for prototype demonstration. DO NOT use for official planning."
                ),
                "source_url": "",
                "vintage": "Kottayam District (2026)",
                "last_updated": date(2026, 1, 1),
                "is_builtin": True,
                "is_demo": True,
                "metadata": {
                    "data_type": "Flood Hazard Layer",
                    "coverage": "Kottayam District",
                    "status": "DEMO DATA",
                    "crs": "EPSG:4326",
                    "disclaimer": "DEMO DATA — Not official flood mapping",
                },
            },
            {
                "name": "Kottayam Historical Flood Events [DEMO]",
                "organization": "DEMO DATA — Synthetic Historical Events",
                "description": (
                    "Synthetic historical flood event records for Kottayam district blocks. "
                    "Created for prototype demonstration. DO NOT use for official planning."
                ),
                "source_url": "",
                "vintage": "2000–2026",
                "last_updated": date(2026, 1, 1),
                "is_builtin": True,
                "is_demo": True,
                "metadata": {
                    "data_type": "Historical Flood Events",
                    "coverage": "Kottayam District",
                    "status": "DEMO DATA",
                    "event_count": "45 synthetic events",
                    "disclaimer": "DEMO DATA — Not official historical records",
                },
            },
        ]

        for src in sources:
            DataSource.objects.update_or_create(
                name=src["name"],
                defaults=src,
            )

        self.stdout.write(f"  [OK] Created {len(sources)} data sources")

    def _seed_administrative_hierarchy(self):
        """
        Seed Kerala → Kottayam → 12 Blocks hierarchy.

        Geometries are synthetic approximate polygons.
        They are NOT official Survey of India boundaries.
        """
        from apps.administration.models import AdministrativeUnit
        from gis.spatial import update_unit_geometry_metadata

        self.stdout.write("  Seeding administrative hierarchy (Kerala -> Kottayam)...")

        # -------------------------------------------------------
        # Kerala (State)
        # Bounding box: ~74.85–77.60 E, 8.20–12.80 N
        # -------------------------------------------------------
        kerala_geojson = {
            "type": "Polygon",
            "coordinates": [[
                [74.85, 8.20], [77.60, 8.20], [77.60, 12.80],
                [74.85, 12.80], [74.85, 8.20]
            ]]
        }
        kerala, _ = AdministrativeUnit.objects.update_or_create(
            code="KL",
            defaults={
                "name": "Kerala [DEMO]",
                "level": "STATE",
                "parent": None,
                "geometry_geojson": json.dumps(kerala_geojson),
                "is_demo": True,
            },
        )

        # -------------------------------------------------------
        # Kottayam District (Pilot District)
        # Bounding box: ~76.36–76.84 E, 9.42–9.78 N
        # -------------------------------------------------------
        kottayam_geojson = {
            "type": "Polygon",
            "coordinates": [[
                [76.36, 9.42], [76.84, 9.42], [76.84, 9.78],
                [76.36, 9.78], [76.36, 9.42]
            ]]
        }
        kottayam, _ = AdministrativeUnit.objects.update_or_create(
            code="KL-KTM",
            defaults={
                "name": "Kottayam [DEMO]",
                "level": "DISTRICT",
                "parent": kerala,
                "geometry_geojson": json.dumps(kottayam_geojson),
                "is_demo": True,
            },
        )

        # -------------------------------------------------------
        # 12 Blocks belonging to Kottayam District
        # 4 columns × 3 rows grid spanning Kottayam bounds
        # -------------------------------------------------------
        grid_blocks = [
            # Row 2 (North: 9.66 to 9.78)
            ("Vaikom [DEMO]", "KL-KTM-B01", 76.36, 76.48, 9.66, 9.78),
            ("Kaduthuruthy [DEMO]", "KL-KTM-B02", 76.48, 76.60, 9.66, 9.78),
            ("Uzhavoor [DEMO]", "KL-KTM-B03", 76.60, 76.72, 9.66, 9.78),
            ("Pala [DEMO]", "KL-KTM-B04", 76.72, 76.84, 9.66, 9.78),
            # Row 1 (Central: 9.54 to 9.66)
            ("Ettumanoor [DEMO]", "KL-KTM-B05", 76.36, 76.48, 9.54, 9.66),
            ("Kottayam [DEMO]", "KL-KTM-B06", 76.48, 76.60, 9.54, 9.66),
            ("Lalam [DEMO]", "KL-KTM-B07", 76.60, 76.72, 9.54, 9.66),
            ("Erattupetta [DEMO]", "KL-KTM-B08", 76.72, 76.84, 9.54, 9.66),
            # Row 0 (South: 9.42 to 9.54)
            ("Changanacherry [DEMO]", "KL-KTM-B09", 76.36, 76.48, 9.42, 9.54),
            ("Madappally [DEMO]", "KL-KTM-B10", 76.48, 76.60, 9.42, 9.54),
            ("Meenachil [DEMO]", "KL-KTM-B11", 76.60, 76.72, 9.42, 9.54),
            ("Kanjirappally [DEMO]", "KL-KTM-B12", 76.72, 76.84, 9.42, 9.54),
        ]

        created_count = 0
        for name, code, min_lon, max_lon, min_lat, max_lat in grid_blocks:
            poly_geojson = {
                "type": "Polygon",
                "coordinates": [[
                    [min_lon, min_lat],
                    [max_lon, min_lat],
                    [max_lon, max_lat],
                    [min_lon, max_lat],
                    [min_lon, min_lat],
                ]]
            }
            block, created = AdministrativeUnit.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "level": "BLOCK",
                    "parent": kottayam,
                    "geometry_geojson": json.dumps(poly_geojson),
                    "is_demo": True,
                },
            )
            update_unit_geometry_metadata(block)
            created_count += 1

        update_unit_geometry_metadata(kerala)
        update_unit_geometry_metadata(kottayam)

        self.stdout.write(
            f"  [OK] Created: Kerala → Kottayam → {created_count} blocks"
        )

    def _seed_flood_layers(self):
        """Seed demo flood-prone area polygons for Kottayam."""
        from apps.hazards.models import HazardLayer

        # 6 demo flood polygons inside Kottayam bounds
        flood_features = [
            self._make_flood_polygon(76.42, 9.72, 0.08, 0.07, "Kottayam Demo Flood Zone 1"),
            self._make_flood_polygon(76.54, 9.60, 0.07, 0.06, "Kottayam Demo Flood Zone 2"),
            self._make_flood_polygon(76.66, 9.58, 0.06, 0.06, "Kottayam Demo Flood Zone 3"),
            self._make_flood_polygon(76.76, 9.65, 0.07, 0.06, "Kottayam Demo Flood Zone 4"),
            self._make_flood_polygon(76.42, 9.48, 0.06, 0.05, "Kottayam Demo Flood Zone 5"),
            self._make_flood_polygon(76.76, 9.50, 0.06, 0.05, "Kottayam Demo Flood Zone 6"),
        ]

        geojson_fc = {
            "type": "FeatureCollection",
            "features": flood_features,
        }

        HazardLayer.objects.update_or_create(
            name="DEMO Flood-prone Areas — Kottayam",
            defaults={
                "hazard_type": "FLOOD",
                "geometry_type": "POLYGON",
                "source": "DEMO DATA — Synthetic prototype data",
                "organization": "DEMO DATA — Not an official source",
                "vintage": "2026",
                "crs": "EPSG:4326",
                "metadata": {
                    "disclaimer": "DEMO DATA — Not official flood mapping",
                    "feature_count": len(flood_features),
                },
                "geometry_geojson": json.dumps(geojson_fc),
                "is_demo": True,
            },
        )

        self.stdout.write(f"  [OK] Created Kottayam flood layer with {len(flood_features)} demo polygons")

    def _make_flood_polygon(self, center_lon, center_lat, width, height, name):
        """Create a demo flood-prone polygon feature."""
        half_w = width / 2
        half_h = height / 2
        return {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [center_lon - half_w, center_lat - half_h],
                    [center_lon + half_w, center_lat - half_h],
                    [center_lon + half_w, center_lat + half_h],
                    [center_lon - half_w, center_lat + half_h],
                    [center_lon - half_w, center_lat - half_h],
                ]]
            },
            "properties": {
                "name": name,
                "is_demo": True,
                "disclaimer": "DEMO DATA — Not official flood mapping",
            }
        }

    def _seed_historical_events(self):
        """
        Seed demo historical flood events for Kottayam blocks.
        """
        from apps.hazards.models import HazardEvent
        from apps.administration.models import AdministrativeUnit

        blocks = list(AdministrativeUnit.objects.filter(level="BLOCK", is_demo=True))
        if not blocks:
            self.stdout.write(self.style.WARNING("  [WARN] No demo blocks found — skipping events"))
            return

        event_configs = [
            ("KL-KTM-B01", 7, 9.72, 76.42),   # Vaikom
            ("KL-KTM-B02", 5, 9.72, 76.54),   # Kaduthuruthy
            ("KL-KTM-B03", 1, 9.72, 76.66),   # Uzhavoor
            ("KL-KTM-B04", 4, 9.72, 76.78),   # Pala
            ("KL-KTM-B05", 0, 9.60, 76.42),   # Ettumanoor
            ("KL-KTM-B06", 6, 9.60, 76.54),   # Kottayam
            ("KL-KTM-B07", 3, 9.60, 76.66),   # Lalam
            ("KL-KTM-B08", 2, 9.60, 76.78),   # Erattupetta
            ("KL-KTM-B09", 5, 9.48, 76.42),   # Changanacherry
            ("KL-KTM-B10", 2, 9.48, 76.54),   # Madappally
            ("KL-KTM-B11", 4, 9.48, 76.66),   # Meenachil
            ("KL-KTM-B12", 6, 9.48, 76.78),   # Kanjirappally
        ]

        base_year = 2000
        event_count = 0

        for block_code, n_events, lat_c, lon_c in event_configs:
            try:
                block = AdministrativeUnit.objects.get(code=block_code)
            except AdministrativeUnit.DoesNotExist:
                continue

            for i in range(n_events):
                year = base_year + int(i * (2025 - base_year) / max(n_events, 1))
                month = random.randint(6, 9)
                day = random.randint(1, 28)

                lat = lat_c + random.uniform(-0.03, 0.03)
                lon = lon_c + random.uniform(-0.03, 0.03)

                magnitude = round(random.uniform(0.5, 3.0), 1)
                loss = round(random.uniform(1.0, 50.0), 1)

                event = HazardEvent(
                    hazard_type="FLOOD",
                    event_date=date(year, month, day),
                    latitude=round(lat, 5),
                    longitude=round(lon, 5),
                    administrative_unit=block,
                    magnitude=magnitude,
                    loss=loss,
                    description=(
                        f"DEMO DATA — Synthetic flood event for prototype demonstration. "
                        f"Block: {block.name}. NOT an official historical record."
                    ),
                    source="DEMO DATA",
                    source_url="",
                    geometry_geojson=json.dumps({
                        "type": "Point",
                        "coordinates": [round(lon, 5), round(lat, 5)],
                    }),
                    is_demo=True,
                )
                event.save()
                event_count += 1

        self.stdout.write(f"  [OK] Created {event_count} demo historical flood events")

