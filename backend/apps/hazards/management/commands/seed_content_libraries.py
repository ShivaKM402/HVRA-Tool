"""
Management command: seed_content_libraries

Seeds the Climate Context Library (HVRA §4.9) and the Recommendations Library
(HVRA §4.9) with curated DEMO content so reports, DOCX/PDF exports and the
front-end library pages render real entries instead of placeholders.

All seeded content is clearly labelled is_demo=True and must NOT be presented
as official government assessments.
"""
from django.core.management.base import BaseCommand

from apps.hazards.models import (
    ClimateContext, Recommendation, RecommendationModuleChoices,
)

# ------------------------------------------------------------------
# Climate Context Library — sourced statements per hazard.
# (Prototype narrative; real content would be compiled by climate scientists.)
# ------------------------------------------------------------------
CLIMATE_CONTEXTS = [
    {
        "hazard_type": "",
        "title": "State-wide monsoon variability",
        "statement": (
            "Kerala's southwest monsoon (June–September) supplies ~70% of annual "
            "rainfall, and observed trends show increasing extreme rainfall days "
            "(>10 cm in 24h) and longer dry spells within the season."
        ),
        "source": "State Climate Change Action Plan [DEMO]",
        "source_url": "",
        "vintage": "2023",
    },
    {
        "hazard_type": "FLOOD",
        "title": "Riverine and flash-flood drivers",
        "statement": (
            "Rising sea-surface temperatures in the Arabian Sea are associated with "
            "more intense low-pressure systems, driving flash floods in built-up "
            "catchments and inundation along major river basins (Pamba, Periyar, "
            "Bharathapuzha)."
        ),
        "source": "Climate Context Library — prototype entry [DEMO]",
        "source_url": "",
        "vintage": "2023",
    },
]

# ------------------------------------------------------------------
# Recommendations Library — typed, prioritised mitigation actions.
# ------------------------------------------------------------------
RECOMMENDATIONS = [
    # --- Hazard (Module 1) ---
    ("HAZARD", "", "", "HIGH",
     "Enforce hazard-informed land-use zoning and building-permit regulation in high-hazard units."),
    ("HAZARD", "", "HH", "HIGH",
     "Prioritise structural mitigation (embankments, flood dykes, drainage augmentation) in High Hazard (HH) units."),
    ("HAZARD", "", "MH", "MEDIUM",
     "Instrument Moderate Hazard (MH) units with real-time hydrometeorological river sensors feeding the early-warning pipeline."),
    ("HAZARD", "", "LH", "MEDIUM",
     "Update local-level disaster management plans for Low Hazard (LH) units and strengthen community awareness."),
    ("HAZARD", "FLOOD", "", "MEDIUM",
     "Maintain and de-silt critical drainage corridors and rejuvenate natural flood-alleviation wetlands."),

    # --- Vulnerability (Module 2) ---
    ("VULNERABILITY", "", "", "HIGH",
     "Target social-protection and cash-transfer schemes at units with high BPL household and dependent-population shares."),
    ("VULNERABILITY", "", "HH", "HIGH",
     "Expand early-warning dissemination, shelter capacity and DM-plan coverage in the most vulnerable units."),
    ("VULNERABILITY", "", "MH", "MEDIUM",
     "Upgrade kutcha and semi-permanent housing stock through resilient-housing assistance programmes."),
    ("VULNERABILITY", "", "LH", "LOW",
     "Maintain community-level first-response and awareness programmes to retain low vulnerability status."),

    # --- Exposure (Module 3) ---
    ("EXPOSURE", "", "", "HIGH",
     "Prioritise retrofitting and relocation of critical facilities located inside the hazard zone."),
    ("EXPOSURE", "", "HH", "HIGH",
     "Regulate new settlement and agricultural land-use conversion inside high-exposure areas."),
    ("EXPOSURE", "", "MH", "MEDIUM",
     "Harden lifeline networks (roads, bridges, utilities) intersecting the hazard zone."),
    ("EXPOSURE", "", "LH", "LOW",
     "Enforce setback and building-line regulations to prevent exposure creep into the hazard zone."),

    # --- Composite Risk (Module 4) ---
    ("COMPOSITE_RISK", "", "", "HIGH",
     "Prioritise structural and non-structural risk-reduction investment in the highest-risk units first."),
    ("COMPOSITE_RISK", "", "VERY_HIGH", "HIGH",
     "Launch urgent multi-sector retrofit and relocation programmes for Very High Risk units."),
    ("COMPOSITE_RISK", "", "HIGH", "HIGH",
     "Include High Risk units in the next District Disaster Management Plan revision cycle."),
    ("COMPOSITE_RISK", "", "MODERATE", "MEDIUM",
     "Monitor Moderate Risk units annually and refresh inputs as new module assessments are published."),
    ("COMPOSITE_RISK", "", "LOW", "LOW",
     "Maintain routine monitoring and periodic re-assessment for Low Risk units."),
]


class Command(BaseCommand):
    help = "Seed the Climate Context and Recommendations libraries (DEMO content)."

    def handle(self, *args, **options):
        ClimateContext.objects.exclude(hazard_type__in=["", "FLOOD"]).delete()
        Recommendation.objects.exclude(hazard_type__in=["", "FLOOD"]).delete()
        climate_count = 0
        for entry in CLIMATE_CONTEXTS:
            _, created = ClimateContext.objects.update_or_create(
                title=entry["title"],
                hazard_type=entry.get("hazard_type", ""),
                defaults={
                    "statement": entry["statement"],
                    "source": entry.get("source", ""),
                    "source_url": entry.get("source_url", ""),
                    "vintage": entry.get("vintage", ""),
                    "is_active": True,
                    "is_demo": True,
                },
            )
            climate_count += 1 if created else 0

        rec_count = 0
        for module, hazard, cls, priority, text in RECOMMENDATIONS:
            obj, created = Recommendation.objects.get_or_create(
                module_type=module,
                hazard_type=hazard,
                classification=cls,
                text=text,
                defaults={"priority": priority, "is_active": True, "is_demo": True},
            )
            if created:
                rec_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Content libraries seeded: {len(CLIMATE_CONTEXTS)} climate context entries "
            f"({climate_count} created), {len(RECOMMENDATIONS)} recommendations ({rec_count} created)."
        ))