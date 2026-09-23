"""
Management command: seed_all_districts

Seeds DEMO administrative units (blocks) and flood events for:
  - Thiruvananthapuram (Trivandrum)
  - Ernakulam (Kochi)

Then creates a fully processed demo assessment for each.

Usage:
    python manage.py seed_all_districts
"""
import random
import math
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.administration.models import AdministrativeUnit
from apps.hazards.models import HazardIndicator, HazardLayer, HazardEvent
from apps.assessments.models import Assessment, AssessmentIndicator, AssessmentResult
from scoring.scoring import compute_assessment_scores
from scoring.classification import classify_batch


# ── District seed data ────────────────────────────────────────────────────────
DISTRICT_DATA = {
    "Thiruvananthapuram": {
        "code": "KL-TVM",
        "centroid": (8.5241, 76.9366),
        "blocks": [
            ("Nedumangad", "KL-TVM-B01", 8.600, 77.000, 135.0),
            ("Chirayinkeezhu", "KL-TVM-B02", 8.700, 76.850, 128.5),
            ("Kattakada", "KL-TVM-B03", 8.440, 77.080, 142.2),
            ("Varkala", "KL-TVM-B04", 8.730, 76.720, 110.8),
            ("Thiruvananthapuram", "KL-TVM-B05", 8.524, 76.937, 155.4),
            ("Neyyattinkara", "KL-TVM-B06", 8.400, 77.090, 130.0),
            ("Parassala", "KL-TVM-B07", 8.320, 77.040, 118.7),
            ("Vellanad", "KL-TVM-B08", 8.590, 77.030, 124.3),
            ("Aruvikkara", "KL-TVM-B09", 8.480, 76.990, 112.5),
            ("Anchuthengu", "KL-TVM-B10", 8.670, 76.780, 108.9),
        ],
    },
    "Ernakulam": {
        "code": "KL-EKM",
        "centroid": (9.9312, 76.2673),
        "blocks": [
            ("Aluva", "KL-EKM-B01", 10.100, 76.350, 162.3),
            ("Angamaly", "KL-EKM-B02", 10.195, 76.380, 145.8),
            ("Ernakulam", "KL-EKM-B03", 9.981, 76.299, 170.1),
            ("Kanayannur", "KL-EKM-B04", 9.950, 76.280, 138.6),
            ("Kothamangalam", "KL-EKM-B05", 10.057, 76.627, 195.2),
            ("Kunnathunadu", "KL-EKM-B06", 10.010, 76.500, 180.5),
            ("Muvattupuzha", "KL-EKM-B07", 9.987, 76.578, 178.3),
            ("North Paravur", "KL-EKM-B08", 10.150, 76.213, 142.7),
            ("Paravur", "KL-EKM-B09", 10.012, 76.208, 133.4),
            ("Thrikkakara", "KL-EKM-B10", 10.030, 76.340, 152.9),
        ],
    },
}

# Per-block DEMO event counts (realistic variability for demo)
BLOCK_EVENTS = {
    # Trivandrum blocks
    "KL-TVM-B01": 8, "KL-TVM-B02": 3, "KL-TVM-B03": 5,
    "KL-TVM-B04": 11, "KL-TVM-B05": 14, "KL-TVM-B06": 6,
    "KL-TVM-B07": 2, "KL-TVM-B08": 4, "KL-TVM-B09": 7, "KL-TVM-B10": 9,
    # Kochi blocks
    "KL-EKM-B01": 12, "KL-EKM-B02": 6, "KL-EKM-B03": 18,
    "KL-EKM-B04": 9, "KL-EKM-B05": 4, "KL-EKM-B06": 7,
    "KL-EKM-B07": 10, "KL-EKM-B08": 13, "KL-EKM-B09": 5, "KL-EKM-B10": 8,
}


def make_square_geojson(lat, lon, size_deg=0.08):
    """Generate a simple rectangular polygon centred on lat/lon."""
    half = size_deg / 2
    coords = [
        [lon - half, lat - half],
        [lon + half, lat - half],
        [lon + half, lat + half],
        [lon - half, lat + half],
        [lon - half, lat - half],
    ]
    return {"type": "Polygon", "coordinates": [coords]}


class Command(BaseCommand):
    help = "Seed Thiruvananthapuram and Ernakulam demo data and assessments"

    def handle(self, *args, **kwargs):
        state = AdministrativeUnit.objects.filter(level="STATE").first()
        if not state:
            self.stderr.write("State not found. Run existing seeders first.")
            return

        indicators = list(HazardIndicator.objects.filter(is_active=True, hazard_type="FLOOD"))
        if not indicators:
            self.stderr.write("No active FLOOD indicators found.")
            return

        n_ind = len(indicators)
        ind_weight = round(1.0 / n_ind, 4)
        indicator_configs = [{"code": i.code, "weight": ind_weight, "id": i.id} for i in indicators]
        # Fix rounding so weights sum exactly to 1.0
        diff = round(1.0 - sum(c["weight"] for c in indicator_configs), 4)
        indicator_configs[-1]["weight"] = round(indicator_configs[-1]["weight"] + diff, 4)

        for district_name, ddata in DISTRICT_DATA.items():
            self.stdout.write(f"\n--- Processing {district_name} ---")

            # Skip if assessment already seeded
            if Assessment.objects.filter(name__icontains=district_name).filter(name__icontains="Demo").exists():
                self.stdout.write(f"  Demo assessment for {district_name} already exists. Skipping.")
                continue

            with transaction.atomic():
                # ── District unit ──────────────────────────────────────────
                district, _ = AdministrativeUnit.objects.get_or_create(
                    code=ddata["code"],
                    defaults={
                        "name": f"{district_name} [DEMO]",
                        "level": "DISTRICT",
                        "parent": state,
                        "centroid_lat": ddata["centroid"][0],
                        "centroid_lon": ddata["centroid"][1],
                        "is_demo": True,
                    },
                )

                # ── Block units ────────────────────────────────────────────
                block_units = []
                for bname, bcode, blat, blon, barea in ddata["blocks"]:
                    geom = make_square_geojson(blat, blon, size_deg=0.10)
                    block, _ = AdministrativeUnit.objects.get_or_create(
                        code=bcode,
                        defaults={
                            "name": f"{bname} [DEMO]",
                            "level": "BLOCK",
                            "parent": district,
                            "area_sqkm": barea,
                            "centroid_lat": blat,
                            "centroid_lon": blon,
                            "geometry_geojson": __import__("json").dumps(geom),
                            "is_demo": True,
                        },
                    )
                    block_units.append((block, bcode, blat, blon))

                self.stdout.write(f"  {len(block_units)} blocks created/found.")

                # ── Historical flood events ────────────────────────────────
                random.seed(42)
                events_created = 0
                for block, bcode, blat, blon in block_units:
                    count = BLOCK_EVENTS.get(bcode, 4)
                    for i in range(count):
                        year = random.randint(2013, 2023)
                        month = random.randint(6, 9)   # monsoon season
                        ev_lat = blat + random.uniform(-0.04, 0.04)
                        ev_lon = blon + random.uniform(-0.04, 0.04)
                        HazardEvent.objects.get_or_create(
                            hazard_type="FLOOD",
                            event_date=date(year, month, random.randint(1, 28)),
                            latitude=round(ev_lat, 5),
                            longitude=round(ev_lon, 5),
                            defaults={
                                "magnitude": round(random.uniform(2.5, 8.5), 1),
                                "source": "DEMO",
                                "description": f"Demo flood event in {block.name}",
                                "administrative_unit": block,
                                "is_demo": True,
                            },
                        )
                        events_created += 1

                self.stdout.write(f"  {events_created} flood events seeded.")

                # ── GIS processing ─────────────────────────────────────────
                blocks_data = [
                    {"id": b.id, "name": b.name, "area_sqkm": b.area_sqkm, "geometry": b.geometry}
                    for b, _, _, _ in block_units
                ]

                # Build events scoped to this district's blocks
                block_ids = {b.id for b, _, _, _ in block_units}
                district_events = [
                    {"id": ev.id, "latitude": ev.latitude, "longitude": ev.longitude, "event_date": ev.event_date}
                    for ev in HazardEvent.objects.filter(
                        hazard_type="FLOOD",
                        administrative_unit__in=list(block_ids),
                        latitude__isnull=False,
                        longitude__isnull=False,
                    )
                ]

                # Build a simple flood polygon that covers the whole district
                c_lat, c_lon = ddata["centroid"]
                district_flood_layer = [{"geometry": make_square_geojson(c_lat, c_lon, size_deg=0.5)}]

                from gis.spatial import process_flood_assessment
                gis_results = process_flood_assessment(blocks_data, district_flood_layer, district_events)

                scoring_results = compute_assessment_scores(
                    gis_results=gis_results,
                    indicator_configs=indicator_configs,
                    normalization_method="min_max",
                )
                scores_map = {bid: res["composite_score"] for bid, res in scoring_results.items()}
                classifications = classify_batch(scores_map, method="QUANTILE")

                # ── Create assessment record ───────────────────────────────
                assessment = Assessment.objects.create(
                    name=f"{district_name} Flood Hazard Demo Assessment",
                    description=f"DEMO DATA — {district_name} Flood Hazard Assessment at Block level.",
                    hazard_type="FLOOD",
                    state=state,
                    district=district,
                    administrative_level="BLOCK",
                    normalization_method="MINMAX",
                    classification_method="QUANTILE",
                    status="COMPLETED",
                )
                for cfg in indicator_configs:
                    AssessmentIndicator.objects.create(
                        assessment=assessment,
                        indicator_id=cfg["id"],
                        weight=cfg["weight"],
                    )

                blocks_qs_dict = {b.id: b for b, _, _, _ in block_units}
                for block_id, result in scoring_results.items():
                    block_unit = blocks_qs_dict[block_id]
                    gis_meta = gis_results.get(block_id, {})

                    for cfg in indicator_configs:
                        ind_data = result["indicator_scores"].get(cfg["code"])
                        if ind_data:
                            AssessmentResult.objects.create(
                                assessment=assessment,
                                administrative_unit=block_unit,
                                indicator_id=cfg["id"],
                                raw_value=ind_data["raw_value"],
                                normalized_value=ind_data["normalized_value"],
                                weight=ind_data["weight"],
                                weighted_score=ind_data["weighted_score"],
                            )

                    AssessmentResult.objects.create(
                        assessment=assessment,
                        administrative_unit=block_unit,
                        indicator=None,
                        final_score=result["composite_score"],
                        classification=classifications.get(block_id, "NH"),
                        metadata={
                            "total_area_sqkm": gis_meta.get("total_area_sqkm"),
                            "flood_prone_area_sqkm": gis_meta.get("flood_prone_area_sqkm"),
                            "flood_prone_percentage": gis_meta.get("flood_prone_percentage"),
                            "event_count": gis_meta.get("event_count"),
                            "event_frequency": gis_meta.get("event_frequency"),
                        },
                    )

                self.stdout.write(
                    f"  Assessment ID={assessment.id} created for {district_name} "
                    f"with {len(scoring_results)} blocks."
                )
                self.stdout.write(
                    f"  View at: http://localhost:5173/assessments/{assessment.id}/results"
                )

        self.stdout.write("\nDone! All district demo data seeded.")
