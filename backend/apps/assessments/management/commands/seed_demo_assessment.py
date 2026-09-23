"""
Management command: seed_demo_assessment

Creates a fully processed DEMO flood hazard assessment for
Kerala → Kottayam → Block using all existing data.

Usage:
    python manage.py seed_demo_assessment

Safe to run multiple times — skips if a demo assessment already exists.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.administration.models import AdministrativeUnit
from apps.hazards.models import HazardIndicator, HazardLayer, HazardEvent
from apps.assessments.models import Assessment, AssessmentIndicator, AssessmentResult
from gis.spatial import process_flood_assessment
from scoring.scoring import compute_assessment_scores
from scoring.classification import classify_batch


class Command(BaseCommand):
    help = "Seed a fully processed DEMO flood hazard assessment for Kottayam"

    def handle(self, *args, **kwargs):
        # ── 1. Check if demo assessment already exists ──────────────────────
        if Assessment.objects.filter(name__icontains="Kottayam Flood Demo").exists():
            self.stdout.write(self.style.WARNING(
                "Demo assessment already exists. Skipping.\n"
                "To recreate, delete existing assessments first."
            ))
            return

        # ── 2. Load administrative units ─────────────────────────────────────
        try:
            state = AdministrativeUnit.objects.get(level="STATE")
            district = AdministrativeUnit.objects.get(level="DISTRICT", name__icontains="Kottayam")
        except AdministrativeUnit.DoesNotExist:
            self.stderr.write(self.style.ERROR(
                "State or District not found. Run migrations and data seeders first."
            ))
            return

        blocks_qs = AdministrativeUnit.objects.filter(level="BLOCK", parent=district)
        if not blocks_qs.exists():
            self.stderr.write(self.style.ERROR("No blocks found for Kottayam."))
            return
        self.stdout.write(f"Found {blocks_qs.count()} blocks for {district.name}.")

        # ── 3. Load indicators ───────────────────────────────────────────────
        indicators = list(HazardIndicator.objects.filter(is_active=True, hazard_type="FLOOD"))
        if not indicators:
            self.stderr.write(self.style.ERROR("No active FLOOD indicators found."))
            return

        # ── 4. Load flood layers and events ──────────────────────────────────
        flood_layers = [
            {"geometry": fl.geometry}
            for fl in HazardLayer.objects.filter(hazard_type="FLOOD")
            if fl.geometry
        ]
        events = [
            {
                "id": ev.id,
                "latitude": ev.latitude,
                "longitude": ev.longitude,
                "event_date": ev.event_date,
            }
            for ev in HazardEvent.objects.filter(
                hazard_type="FLOOD",
                latitude__isnull=False,
                longitude__isnull=False,
            )
        ]
        blocks_data = [
            {
                "id": b.id,
                "name": b.name,
                "area_sqkm": b.area_sqkm,
                "geometry": b.geometry,
            }
            for b in blocks_qs
        ]

        self.stdout.write(f"Flood layers: {len(flood_layers)}, Events: {len(events)}")

        # ── 5. Run GIS + scoring pipeline ────────────────────────────────────
        self.stdout.write("Running GIS processing…")
        gis_results = process_flood_assessment(blocks_data, flood_layers, events)

        # Equal weights across active indicators (must sum to 1.0)
        n = len(indicators)
        ind_weight = round(1.0 / n, 4)
        indicator_configs = [
            {"code": ind.code, "weight": ind_weight, "id": ind.id}
            for ind in indicators
        ]
        # Adjust last weight to ensure sum == 1.0
        total = round(ind_weight * n, 4)
        if total != 1.0:
            indicator_configs[-1]["weight"] = round(indicator_configs[-1]["weight"] + (1.0 - total), 4)

        self.stdout.write("Running scoring…")
        scoring_results = compute_assessment_scores(
            gis_results=gis_results,
            indicator_configs=indicator_configs,
            normalization_method="MINMAX",
        )
        scores_map = {bid: res["composite_score"] for bid, res in scoring_results.items()}
        classifications = classify_batch(scores_map, method="QUANTILE")

        # ── 6. Create assessment record ──────────────────────────────────────
        with transaction.atomic():
            assessment = Assessment.objects.create(
                name="Kottayam Flood Hazard Demo Assessment",
                description=(
                    "Automated demo assessment for Kerala → Kottayam → Block level. "
                    "DEMO DATA — for prototype demonstration only."
                ),
                hazard_type="FLOOD",
                state=state,
                district=district,
                administrative_level="BLOCK",
                normalization_method="MINMAX",
                classification_method="QUANTILE",
                status="COMPLETED",
            )

            # Indicator config records
            for cfg in indicator_configs:
                AssessmentIndicator.objects.create(
                    assessment=assessment,
                    indicator_id=cfg["id"],
                    weight=cfg["weight"],
                )

            # Per-block result rows
            for block_id, result in scoring_results.items():
                block_unit = blocks_qs.get(id=block_id)
                gis_meta = gis_results.get(block_id, {})

                # Granular indicator rows
                for cfg in indicator_configs:
                    code = cfg["code"]
                    ind_data = result["indicator_scores"].get(code)
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

                # Composite summary row
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

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Demo assessment created! ID = {assessment.id}\n"
            f"   Name  : {assessment.name}\n"
            f"   Blocks: {blocks_qs.count()}\n"
            f"   Status: {assessment.status}\n"
            f"\nOpen http://localhost:5173/assessments/{assessment.id}/results to view."
        ))
