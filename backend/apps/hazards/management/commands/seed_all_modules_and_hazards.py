"""
Management command: seed_all_modules_and_hazards

Seeds:
1. All Hazard Types (Flood, Landslide, Cyclone, Drought, Earthquake, Forest Fire) as active with icons/colors.
2. Comprehensive Hazard Indicators and default weightages.
3. Vulnerability and Exposure indicators (Modules 2 & 3) with default weightages.
4. Spatial Hazard Layers (polygons) and historical Hazard Events for all 14 Kerala districts.
"""
import random
import json
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.administration.models import AdministrativeUnit
from apps.hazards.models import (
    HazardType, HazardIndicator, IndicatorWeightageRule,
    HazardLayer, HazardEvent, ModuleTypeChoices,
)
from scoring.demo_data import CODE_RANGES


HAZARDS_CONFIG = [
    {
        "code": "FLOOD",
        "name": "Flood",
        "icon": "🌊",
        "color": "#3B82F6",
        "description": "Riverine, pluvial, and flash flood hazard mapping across catchments.",
        "indicators": [
            ("TOTAL_AREA", "Total Administrative Area", "sq.km", 2.0, "Total geographic area of the block unit."),
            ("FLOOD_PRONE_AREA", "Flood-prone Area (%)", "%", 8.0, "Percentage of block area situated within flood inundation zones."),
            ("HISTORICAL_FLOOD_EVENTS", "Historical Flood Events", "count", 8.0, "Total recorded flood occurrences in the historical disaster catalogue."),
            ("FLOOD_FREQUENCY", "Flood Frequency", "events/yr", 6.0, "Annualized frequency of flood occurrences."),
        ]
    },
    {
        "code": "LANDSLIDE",
        "name": "Landslide",
        "icon": "⛰️",
        "color": "#D97706",
        "description": "Slope stability, debris flow, and rockfall susceptibility in hilly terrains.",
        "indicators": [
            ("LS_TOTAL_AREA", "Total Administrative Area", "sq.km", 2.0, "Total geographic area of the block unit."),
            ("SLOPE_INSTABILITY_AREA", "High Slope Instability Area (%)", "%", 8.5, "Percentage of area with slopes exceeding 25 degrees situated in high-risk zones."),
            ("HISTORICAL_LANDSLIDES", "Historical Landslide Incidents", "count", 7.5, "Recorded slope failure and landslide incidents in the past 15 years."),
            ("RAINFALL_THRESHOLD_SUSCEPTIBILITY", "Monsoon Rainfall Susceptibility", "index (0-10)", 7.0, "Vulnerability index based on 72-hour extreme precipitation thresholds."),
        ]
    },
    {
        "code": "CYCLONE",
        "name": "Cyclone",
        "icon": "🌀",
        "color": "#06B6D4",
        "description": "Cyclonic storm surge, high-velocity winds, and coastal inundation hazards.",
        "indicators": [
            ("CYC_TOTAL_AREA", "Total Administrative Area", "sq.km", 2.0, "Total geographic area of the block unit."),
            ("COASTAL_SURGE_PRONE_AREA", "Storm Surge Inundation Zone (%)", "%", 9.0, "Coastal land area susceptible to astronomical surge and wave run-up."),
            ("WIND_HAZARD_ZONE", "Peak Wind Velocity Exposure", "m/s", 8.0, "NDMA Wind Hazard zoning rating (50 m/s basic wind speed category)."),
            ("HISTORICAL_CYCLONE_TRACKS", "Past Cyclone Impact Tracks", "count", 6.5, "Frequency of cyclonic tracks crossing within 50km of the unit."),
        ]
    },
    {
        "code": "DROUGHT",
        "name": "Drought",
        "icon": "☀️",
        "color": "#EA580C",
        "description": "Meteorological, hydrological, and agricultural drought risk assessment.",
        "indicators": [
            ("DR_TOTAL_AREA", "Total Administrative Area", "sq.km", 2.0, "Total geographic area of the block unit."),
            ("RAINFALL_DEFICIT_INDEX", "Monsoon Rainfall Deficit (%)", "%", 8.5, "Percentage deviation from Long Period Average (LPA) precipitation."),
            ("SOIL_MOISTURE_DEFICIT", "Soil Moisture Stress Index", "index", 7.5, "Root zone soil moisture deficit index over the agricultural growing season."),
            ("GROUNDWATER_DEPLETION", "Groundwater Table Depletion", "m/yr", 7.0, "Rate of pre-monsoon to post-monsoon water table decline."),
        ]
    },
    {
        "code": "EARTHQUAKE",
        "name": "Earthquake",
        "icon": "🌋",
        "color": "#8B5CF6",
        "description": "Seismic hazard assessment based on fault proximity, soil liquefaction, and peak ground acceleration.",
        "indicators": [
            ("EQ_TOTAL_AREA", "Total Administrative Area", "sq.km", 2.0, "Total geographic area of the block unit."),
            ("SEISMIC_ZONE_FACTOR", "Seismic Zone Factor (IS 1893)", "zone", 8.0, "Seismic zone vulnerability rating based on Indian Standard code."),
            ("SOIL_LIQUEFACTION_POTENTIAL", "Soil Liquefaction Susceptibility (%)", "%", 7.5, "Area underlain by saturated loose sands prone to cyclic liquefaction."),
            ("FAULT_PROXIMITY_DENSITY", "Active Geological Fault Proximity", "km", 7.0, "Proximity distance and lineament density of active tectonic faults."),
        ]
    },
    {
        "code": "FOREST_FIRE",
        "name": "Forest Fire",
        "icon": "🔥",
        "color": "#DC2626",
        "description": "Wildfire and forest burn risk mapping based on dry vegetation fuel loads and ignition sources.",
        "indicators": [
            ("FF_TOTAL_AREA", "Total Administrative Area", "sq.km", 2.0, "Total geographic area of the block unit."),
            ("FOREST_COVER_RATIO", "Dense Forest Cover Ratio (%)", "%", 7.5, "Percentage of block covered by flammable dry deciduous and moist forest."),
            ("HISTORICAL_FIRE_POINTS", "MODIS/VIIRS Active Fire Detections", "count", 8.5, "Recorded satellite thermal anomaly detections in dry seasons."),
            ("DRY_SEASON_TEMPERATURE", "Summer Land Surface Temperature", "°C", 6.5, "Mean peak temperature during February-May pre-monsoon dry period."),
        ]
    }
]


# ------------------------------------------------------------------
# Vulnerability (Module 2) and Exposure (Module 3) indicator libraries.
# These mirror the illustrative indicator lists in the HVRA concept note
# (Sections 5.1 and 6.1). All default weights are PROTOTYPE values.
# ------------------------------------------------------------------
VULNERABILITY_INDICATORS = [
    # (code, name, unit, default_weight, description)
    ("POP_DENSITY", "Population Density", "persons/sq.km", 7.0,
     "Resident population per square kilometre."),
    ("DEPENDENT_POPULATION", "Dependent Population (Under 5 / Over 60)", "%", 6.5,
     "Share of population below 5 or above 60 years of age."),
    ("DIFFERENTLY_ABLED", "Differently-abled Population", "%", 5.5,
     "Share of population with reported disability."),
    ("BPL_HOUSEHOLDS", "BPL Households", "%", 8.0,
     "Share of households below the poverty line (SECC)."),
    ("LOW_LITERACY", "Population without Formal Literacy", "%", 6.0,
     "Share of population without formal literacy (inverse of literacy rate)."),
    ("MARGINAL_WORKERS", "Marginal Workers", "%", 5.5,
     "Share of workers with marginal employment status."),
    ("KUTCHA_HOUSING", "Kutcha / Semi-permanent Housing", "%", 7.5,
     "Share of housing stock built with kutcha or semi-permanent materials."),
    ("HEALTH_ACCESS_GAP", "Health Facility Access Gap", "index", 6.5,
     "Composite gap index of road & health-facility accessibility."),
    ("NO_DISASTER_PLAN", "Units without Disaster Management Plan", "%", 6.0,
     "Share of unit area not covered by a documented DM plan."),
    ("NO_EARLY_WARNING", "Households without Early Warning Coverage", "%", 6.5,
     "Share of households without access to an early-warning dissemination system."),
]

EXPOSURE_INDICATORS = [
    # (code, name, unit, default_weight, description)
    ("POP_IN_HAZARD_ZONE", "Population within Hazard-prone Area", "persons", 8.5,
     "Estimated resident population located inside the hazard-prone area."),
    ("CRITICAL_FACILITIES_EXPOSED", "Critical Facilities within Hazard Zone", "count", 7.5,
     "Hospitals, schools, shelters and power/water assets located in the hazard zone."),
    ("AGRI_ASSETS_EXPOSED", "Agricultural Land within Hazard Zone", "%", 7.0,
     "Share of agricultural land lying inside the hazard zone."),
    ("BUILTUP_EXPOSED", "Built-up Area within Hazard Zone", "%", 7.0,
     "Share of built-up / settlement area inside the hazard zone."),
    ("LIFELINE_LENGTH_EXPOSED", "Lifeline Networks within Hazard Zone", "km", 6.5,
     "Length of roads, bridges and utility networks intersecting the hazard zone."),
    ("ECONOMIC_VALUE_EXPOSED", "Economic Asset Value within Hazard Zone", "INR crore", 7.5,
     "Estimated value of assets exposed inside the hazard zone."),
]


def make_hazard_polygon(center_lat, center_lon, width_deg=0.06, height_deg=0.04):
    """Generate irregular polygon representing hazard inundation/hazard zone."""
    w2 = width_deg / 2
    h2 = height_deg / 2
    # 6-point convex-ish polygon
    coords = [
        [center_lon - w2 * 0.9, center_lat - h2 * 0.7],
        [center_lon + w2 * 0.3, center_lat - h2 * 1.1],
        [center_lon + w2 * 1.1, center_lat - h2 * 0.2],
        [center_lon + w2 * 0.8, center_lat + h2 * 0.9],
        [center_lon - w2 * 0.4, center_lat + h2 * 1.0],
        [center_lon - w2 * 1.0, center_lat + h2 * 0.3],
        [center_lon - w2 * 0.9, center_lat - h2 * 0.7]  # close
    ]
    return {
        "type": "Polygon",
        "coordinates": [coords]
    }


class Command(BaseCommand):
    help = "Seed all hazard types, indicators, weightage rules, layers, and events across Kerala."

    def handle(self, *args, **options):
        self.stdout.write("Seeding Hazard Types & Indicators...")

        with transaction.atomic():
            # 1. Update/Create Hazard Types & Indicators
            for hz in HAZARDS_CONFIG:
                hazard_obj, _ = HazardType.objects.update_or_create(
                    code=hz["code"],
                    defaults={
                        "name": hz["name"],
                        "icon": hz["icon"],
                        "color": hz["color"],
                        "description": hz["description"],
                        "is_active": True,
                    }
                )

                order = 1
                for code, name, unit, def_weight, desc in hz["indicators"]:
                    ind_obj, _ = HazardIndicator.objects.update_or_create(
                        code=code,
                        hazard_type=hz["code"],
                        defaults={
                            "name": name,
                            "unit": unit,
                            "default_weight": def_weight,
                            "min_weight": 0.0,
                            "max_weight": 10.0,
                            "is_active": True,
                            "order": order,
                            "description": desc,
                        }
                    )
                    order += 1

                    # Seed sample weightage rules
                    if code.endswith("_AREA") or code == "FLOOD_PRONE_AREA":
                        rules = [
                            ("No Hazard", 0.0, 5.0, 0.0),
                            ("Low Hazard", 5.0, 20.0, 3.5),
                            ("Medium Hazard", 20.0, 45.0, 6.5),
                            ("High Hazard", 45.0, None, 9.5),
                        ]
                    elif "EVENT" in code or "INCIDENT" in code or "LANDSLIDE" in code:
                        rules = [
                            ("No Hazard", 0.0, 1.0, 0.0),
                            ("Low Hazard", 1.0, 4.0, 3.0),
                            ("Medium Hazard", 4.0, 8.0, 6.0),
                            ("High Hazard", 8.0, None, 9.0),
                        ]
                    else:
                        rules = [
                            ("Low", 0.0, 2.5, 2.0),
                            ("Moderate", 2.5, 6.0, 5.5),
                            ("High", 6.0, None, 8.5),
                        ]

                    for label, r_min, r_max, score in rules:
                        IndicatorWeightageRule.objects.get_or_create(
                            indicator=ind_obj,
                            range_min=r_min,
                            range_max=r_max,
                            defaults={"label": label, "score": score, "is_prototype_threshold": True}
                        )

            self.stdout.write(self.style.SUCCESS("All Hazard Types & Indicators seeded."))

            # 1b. Seed Vulnerability & Exposure indicators (Modules 2 & 3)
            module_indicator_specs = [
                (ModuleTypeChoices.VULNERABILITY, VULNERABILITY_INDICATORS),
                (ModuleTypeChoices.EXPOSURE, EXPOSURE_INDICATORS),
            ]
            for module_type, spec_list in module_indicator_specs:
                order = 1
                for code, name, unit, def_weight, desc in spec_list:
                    ind_obj, created = HazardIndicator.objects.update_or_create(
                        code=code,
                        defaults={
                            "name": name,
                            "unit": unit,
                            "default_weight": def_weight,
                            "min_weight": 0.0,
                            "max_weight": 10.0,
                            "is_active": True,
                            "order": order,
                            "description": desc,
                            "module_type": module_type,
                            "hazard_type": "",
                        }
                    )
                    order += 1

                    # Add prototype weightage rules derived from the demo-data
                    # value range so higher raw values map to higher scores.
                    low, high, ndigits = CODE_RANGES.get(module_type, {}).get(code, (0.0, 10.0, 1))
                    span = max(high - low, 1e-9)
                    rule_bands = [
                        ("Low", 0.0, 0.25, 2.0),
                        ("Moderate", 0.25, 0.50, 5.0),
                        ("High", 0.50, 0.75, 8.0),
                        ("Very High", 0.75, None, 10.0),
                    ]
                    for label, f_min, f_max, score in rule_bands:
                        r_min = round(low + span * f_min, ndigits if ndigits else 1)
                        r_max = round(low + span * f_max, ndigits if ndigits else 1) if f_max is not None else None
                        IndicatorWeightageRule.objects.get_or_create(
                            indicator=ind_obj,
                            range_min=r_min,
                            range_max=r_max,
                            defaults={
                                "label": label,
                                "score": score,
                                "is_prototype_threshold": True,
                                "description": f"{module_type} prototype band.",
                            }
                        )
                self.stdout.write(self.style.SUCCESS(
                    f"{module_type} indicators seeded ({len(spec_list)} indicators)."
                ))

            # 2. Seed Hazard Layers & Historical Events for all Kerala Districts
            districts = AdministrativeUnit.objects.filter(level="DISTRICT")
            self.stdout.write(f"Generating thematic layers and historical points for {districts.count()} districts...")

            random.seed(101)
            total_events_added = 0
            total_layers_added = 0

            for district in districts:
                blocks = AdministrativeUnit.objects.filter(parent=district, level="BLOCK")
                c_lat = district.centroid_lat or 10.0
                c_lon = district.centroid_lon or 76.5

                # Create a thematic flood-prone layer for this district if not existing
                layer_name = f"{district.name} Flood Inundation & Hazard Overlay [DEMO]"
                if not HazardLayer.objects.filter(name=layer_name).exists():
                    # Generate a multi-polygon feature collection representing flood plains
                    features = []
                    for b in blocks:
                        b_lat = b.centroid_lat or c_lat
                        b_lon = b.centroid_lon or c_lon
                        poly_geom = make_hazard_polygon(b_lat, b_lon, width_deg=0.07, height_deg=0.05)
                        features.append({
                            "type": "Feature",
                            "properties": {
                                "block_name": b.name,
                                "hazard": "FLOOD",
                                "return_period": "25-year",
                                "inundation_depth_m": round(random.uniform(0.5, 3.2), 2),
                            },
                            "geometry": poly_geom
                        })

                    fc_geojson = {
                        "type": "FeatureCollection",
                        "features": features
                    }

                    HazardLayer.objects.create(
                        name=layer_name,
                        hazard_type="FLOOD",
                        geometry_type="POLYGON",
                        source="KSDMA/CWC Hydraulic Model [DEMO]",
                        organization="Kerala State Disaster Management Authority",
                        vintage="2024",
                        is_demo=True,
                        geometry_geojson=json.dumps(fc_geojson)
                    )
                    total_layers_added += 1

                # Ensure each block has at least 3-8 historical hazard events for mapping
                for b in blocks:
                    existing_count = HazardEvent.objects.filter(administrative_unit=b).count()
                    if existing_count < 3:
                        num_to_add = random.randint(3, 7) - existing_count
                        b_lat = b.centroid_lat or c_lat
                        b_lon = b.centroid_lon or c_lon

                        for _ in range(num_to_add):
                            ev_lat = b_lat + random.uniform(-0.025, 0.025)
                            ev_lon = b_lon + random.uniform(-0.025, 0.025)
                            yr = random.randint(2014, 2024)
                            mo = random.choice([6, 7, 8, 9, 10])
                            dy = random.randint(1, 28)
                            mag = round(random.uniform(1.2, 5.4), 1)

                            HazardEvent.objects.create(
                                hazard_type="FLOOD",
                                event_date=date(yr, mo, dy),
                                latitude=round(ev_lat, 5),
                                longitude=round(ev_lon, 5),
                                administrative_unit=b,
                                magnitude=mag,
                                loss=round(random.uniform(0.2, 12.5), 2),
                                description=f"Monsoon inundation reported in {b.name} ({yr})",
                                source="District Disaster Management Authority (DDMA)",
                                is_demo=True,
                                geometry_geojson=json.dumps({
                                    "type": "Point",
                                    "coordinates": [round(ev_lon, 5), round(ev_lat, 5)]
                                })
                            )
                            total_events_added += 1

            self.stdout.write(self.style.SUCCESS(
                f"Successfully added {total_layers_added} hazard layers and {total_events_added} historical event markers."
            ))
