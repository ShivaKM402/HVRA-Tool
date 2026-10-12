"""
Management command: seed_all_modules_and_hazards

Seeds:
1. Dedicated Flood Hazard Type as active with icons/colors.
2. Comprehensive Flood Hazard Indicators and default weightages.
3. Flood Vulnerability and Exposure indicators (Modules 2 & 3) with default weightages.
4. Spatial Hazard Layers (polygons) and historical Hazard Events for Kerala districts.
"""
import random
import json
from datetime import date
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.administration.models import AdministrativeUnit
from apps.hazards.models import (
    HazardType, HazardIndicator, IndicatorWeightageRule,
    HazardLayer, HazardEvent, ModuleTypeChoices, IndicatorCategoryChoices,
)
from scoring.demo_data import CODE_RANGES


# Dedicated Flood Hazard Configuration (Flood only per HVRA requirement)
HAZARDS_CONFIG = [
    {
        "code": "FLOOD",
        "name": "Flood",
        "icon": "🌊",
        "color": "#3B82F6",
        "is_active": True,
        "description": "Riverine, pluvial, and flash flood hazard mapping across Kerala catchments.",
        "indicators": [
            ("TOTAL_AREA", "Total Administrative Area", "sq.km", 2.0, "Total geographic area of the block unit.", IndicatorCategoryChoices.HAZARD_PRIMARY, "Revenue & Disaster Management (KSDMA)"),
            ("FLOOD_PRONE_AREA", "Flood-prone Area (%)", "%", 8.5, "Percentage of block area situated within flood inundation zones.", IndicatorCategoryChoices.HAZARD_PRIMARY, "Water Resources Department (Irrigation)"),
            ("HISTORICAL_FLOOD_EVENTS", "Historical Flood Events", "count", 8.0, "Total recorded flood occurrences in the historical disaster catalogue.", IndicatorCategoryChoices.HAZARD_PRIMARY, "Revenue & Disaster Management (KSDMA)"),
            ("FLOOD_FREQUENCY", "Flood Frequency", "events/yr", 7.0, "Annualized frequency of flood occurrences.", IndicatorCategoryChoices.HAZARD_PRIMARY, "Water Resources Department (Irrigation)"),
        ]
    },
]


# ------------------------------------------------------------------
# Flood-Specific Vulnerability Indicators (Module 2, §6.1)
# Organized strictly under 4 mandatory categories:
# 1. Socio-Economic Vulnerability
# 2. Physical Vulnerability
# 3. Environmental Vulnerability
# 4. Other / Coping Capacity Vulnerability
# ------------------------------------------------------------------
FLOOD_VULNERABILITY_INDICATORS = [
    # 1. Socio-Economic Vulnerability
    ("FLD_BPL_HOUSEHOLDS", "BPL Households in Floodplains", "%", 8.0,
     "Share of households living below poverty line in vulnerable river basins and lowlands.",
     IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
    ("FLD_DEPENDENT_POP", "Dependent Population (Under 5 / Over 60)", "%", 7.0,
     "Share of elderly and infants requiring emergency evacuation assistance during floods.",
     IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
    ("FLD_MARGINAL_WORKERS", "Marginal Daily-Wage Workers", "%", 6.0,
     "Workforce proportion dependent on daily agricultural/informal labor vulnerable to income disruption.",
     IndicatorCategoryChoices.SOCIO_ECONOMIC, "Labour & Skills Department"),

    # 2. Physical Vulnerability
    ("FLD_KUTCHA_HOUSING", "Kutcha & Semi-permanent Housing Stock", "%", 8.5,
     "Percentage of residential structures built with non-flood-resilient building materials.",
     IndicatorCategoryChoices.PHYSICAL, "Local Self Government (LSGD / Panchayats)"),
    ("FLD_DRAINAGE_DEFICIT", "Stormwater Drainage Inadequacy Ratio", "%", 8.0,
     "Proportion of urban/semi-urban drainage channels experiencing silting or insufficient cross-section.",
     IndicatorCategoryChoices.PHYSICAL, "Public Works Department (PWD)"),
    ("FLD_ROAD_SUBMERGENCE", "Low-lying Submersible Road Length", "km", 7.0,
     "Length of road access links at risk of waterlogging and cut-off during monsoon inundation.",
     IndicatorCategoryChoices.PHYSICAL, "Public Works Department (PWD)"),

    # 3. Environmental Vulnerability
    ("FLD_WETLAND_LOSS", "Wetland & Flood Basin Reclamation", "%", 7.5,
     "Reduction of natural wetlands and paddy polders acting as flood buffering sinks.",
     IndicatorCategoryChoices.ENVIRONMENTAL, "Environment & Climate Change Department"),
    ("FLD_IMPERVIOUS_SURFACE", "Impervious Surface Runoff Factor", "%", 6.5,
     "High runoff generation fraction resulting from paved settlements.",
     IndicatorCategoryChoices.ENVIRONMENTAL, "Town & Country Planning / LSGD"),

    # 4. Other / Coping Capacity Vulnerability
    ("FLD_HEALTH_ACCESS_GAP", "Emergency Health Center Access Gap", "index", 6.5,
     "Accessibility deficit to nearest tertiary healthcare and primary health centers during high water.",
     IndicatorCategoryChoices.OTHER, "Health & Family Welfare Department"),
    ("FLD_NO_EARLY_WARNING", "Households without Flood EWS Alert Coverage", "%", 7.0,
     "Share of population outside direct SMS/siren community early warning networks.",
     IndicatorCategoryChoices.OTHER, "Revenue & Disaster Management (KSDMA)"),
    ("FLD_NO_DM_SHELTER", "Flood Relief Shelter Capacity Shortfall", "persons", 6.0,
     "Capacity deficit of designated multipurpose cyclone/flood relief shelters.",
     IndicatorCategoryChoices.OTHER, "Revenue & Disaster Management (KSDMA)"),
]

# ------------------------------------------------------------------
# Flood-Specific Exposure Indicators (Module 3, §6.2)
# ------------------------------------------------------------------
FLOOD_EXPOSURE_INDICATORS = [
    ("FLD_POP_EXPOSED", "Resident Population within Inundation Zone", "persons", 9.0,
     "Estimated resident population living inside the modelled flood inundation envelope.",
     IndicatorCategoryChoices.OTHER, "Department of Economics & Statistics"),
    ("FLD_RESIDENTIAL_EXPOSED", "Residential Buildings in Floodplain", "count", 8.5,
     "Count of residential structures situated below high flood level contour.",
     IndicatorCategoryChoices.PHYSICAL, "Local Self Government (LSGD / Panchayats)"),
    ("FLD_CRITICAL_FACILITIES", "Critical Facilities Exposed (Hospitals/Schools/Substations)", "count", 8.5,
     "Hospitals, emergency relief camps, water intake wells, and electric substations inside flood zone.",
     IndicatorCategoryChoices.PHYSICAL, "Health / PWD / KSEB"),
    ("FLD_AGRI_CROP_EXPOSED", "Agricultural Land & Paddy Crops in Floodplain", "hectares", 7.5,
     "Productive agricultural land and seasonal crops inundated during high water.",
     IndicatorCategoryChoices.ENVIRONMENTAL, "Agriculture Development & Farmers Welfare"),
    ("FLD_PWD_ROADS_EXPOSED", "PWD Highways & Major Roads in Hazard Zone", "km", 7.5,
     "Kilometres of state highways, major district roads, and rail lines intersecting flood zone.",
     IndicatorCategoryChoices.PHYSICAL, "Public Works Department (PWD)"),
    ("FLD_ECONOMIC_ASSETS", "Commercial & Industrial Assets Exposed", "INR crore", 7.0,
     "Market valuation of commercial inventory and infrastructure in flood-prone blocks.",
     IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
]

# ------------------------------------------------------------------
# Baseline indicator library preserved for backward compatibility
# ------------------------------------------------------------------
BASELINE_VULNERABILITY_INDICATORS = [
    ("POP_DENSITY", "Population Density", "persons/sq.km", 7.0,
     "Resident population per square kilometre.", IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
    ("DEPENDENT_POPULATION", "Dependent Population (Under 5 / Over 60)", "%", 6.5,
     "Share of population below 5 or above 60 years of age.", IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
    ("DIFFERENTLY_ABLED", "Differently-abled Population", "%", 5.5,
     "Share of population with reported disability.", IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
    ("BPL_HOUSEHOLDS", "BPL Households", "%", 8.0,
     "Share of households below the poverty line (SECC).", IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
    ("LOW_LITERACY", "Population without Formal Literacy", "%", 6.0,
     "Share of population without formal literacy (inverse of literacy rate).", IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
    ("MARGINAL_WORKERS", "Marginal Workers", "%", 5.5,
     "Share of workers with marginal employment status.", IndicatorCategoryChoices.SOCIO_ECONOMIC, "Labour & Skills Department"),
    ("KUTCHA_HOUSING", "Kutcha / Semi-permanent Housing", "%", 7.5,
     "Share of housing stock built with kutcha or semi-permanent materials.", IndicatorCategoryChoices.PHYSICAL, "Local Self Government (LSGD / Panchayats)"),
    ("HEALTH_ACCESS_GAP", "Health Facility Access Gap", "index", 6.5,
     "Composite gap index of road & health-facility accessibility.", IndicatorCategoryChoices.OTHER, "Health & Family Welfare Department"),
    ("NO_DISASTER_PLAN", "Units without Disaster Management Plan", "%", 6.0,
     "Share of unit area not covered by a documented DM plan.", IndicatorCategoryChoices.OTHER, "Revenue & Disaster Management (KSDMA)"),
    ("NO_EARLY_WARNING", "Households without Early Warning Coverage", "%", 6.5,
     "Share of households without access to an early-warning dissemination system.", IndicatorCategoryChoices.OTHER, "Revenue & Disaster Management (KSDMA)"),
]

BASELINE_EXPOSURE_INDICATORS = [
    ("POP_IN_HAZARD_ZONE", "Population within Hazard-prone Area", "persons", 8.5,
     "Estimated resident population located inside the hazard-prone area.", IndicatorCategoryChoices.OTHER, "Department of Economics & Statistics"),
    ("CRITICAL_FACILITIES_EXPOSED", "Critical Facilities within Hazard Zone", "count", 7.5,
     "Hospitals, schools, shelters and power/water assets located in the hazard zone.", IndicatorCategoryChoices.PHYSICAL, "Health / PWD / KSEB"),
    ("AGRI_ASSETS_EXPOSED", "Agricultural Land within Hazard Zone", "%", 7.0,
     "Share of agricultural land lying inside the hazard zone.", IndicatorCategoryChoices.ENVIRONMENTAL, "Agriculture Development & Farmers Welfare"),
    ("BUILTUP_EXPOSED", "Built-up Area within Hazard Zone", "%", 7.0,
     "Share of built-up / settlement area inside the hazard zone.", IndicatorCategoryChoices.PHYSICAL, "Local Self Government (LSGD / Panchayats)"),
    ("LIFELINE_LENGTH_EXPOSED", "Lifeline Networks within Hazard Zone", "km", 6.5,
     "Length of roads, bridges and utility networks intersecting the hazard zone.", IndicatorCategoryChoices.PHYSICAL, "Public Works Department (PWD)"),
    ("ECONOMIC_VALUE_EXPOSED", "Economic Asset Value within Hazard Zone", "INR crore", 7.5,
     "Estimated value of assets exposed inside the hazard zone.", IndicatorCategoryChoices.SOCIO_ECONOMIC, "Department of Economics & Statistics"),
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
            # Purge non-flood hazards, indicators, layers, and events
            HazardType.objects.exclude(code="FLOOD").delete()
            HazardIndicator.objects.filter(hazard_type__isnull=False).exclude(hazard_type="FLOOD").delete()
            HazardLayer.objects.exclude(hazard_type="FLOOD").delete()
            HazardEvent.objects.exclude(hazard_type="FLOOD").delete()

            # 1. Update/Create Hazard Types & Indicators
            for hz in HAZARDS_CONFIG:
                hazard_obj, _ = HazardType.objects.update_or_create(
                    code=hz["code"],
                    defaults={
                        "name": hz["name"],
                        "icon": hz["icon"],
                        "color": hz["color"],
                        "description": hz["description"],
                        "is_active": hz.get("is_active", False),
                    }
                )

                order = 1
                for ind_spec in hz["indicators"]:
                    if len(ind_spec) == 7:
                        code, name, unit, def_weight, desc, cat, dept = ind_spec
                    else:
                        code, name, unit, def_weight, desc = ind_spec
                        cat = IndicatorCategoryChoices.HAZARD_PRIMARY
                        dept = "Revenue & Disaster Management (KSDMA)"

                    ind_obj, _ = HazardIndicator.objects.update_or_create(
                        code=code,
                        hazard_type=hz["code"],
                        defaults={
                            "name": name,
                            "unit": unit,
                            "category": cat,
                            "department": dept,
                            "default_weight": def_weight,
                            "min_weight": 0.0,
                            "max_weight": 10.0,
                            "is_active": True,
                            "order": order,
                            "description": desc,
                            "module_type": ModuleTypeChoices.HAZARD,
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
                    elif "EVENT" in code or "INCIDENT" in code:
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

            self.stdout.write(self.style.SUCCESS("Hazard Types & Hazard Indicators seeded (Flood active)."))

            # 1b. Seed Flood Vulnerability, Flood Exposure & Baseline indicators (Modules 2 & 3)
            module_indicator_specs = [
                # Flood-specific indicators (§6.1 and §6.2)
                (ModuleTypeChoices.VULNERABILITY, "FLOOD", FLOOD_VULNERABILITY_INDICATORS),
                (ModuleTypeChoices.EXPOSURE, "FLOOD", FLOOD_EXPOSURE_INDICATORS),
                # Baseline indicators for backward compatibility
                (ModuleTypeChoices.VULNERABILITY, "", BASELINE_VULNERABILITY_INDICATORS),
                (ModuleTypeChoices.EXPOSURE, "", BASELINE_EXPOSURE_INDICATORS),
            ]
            for module_type, h_code, spec_list in module_indicator_specs:
                order = 1
                for code, name, unit, def_weight, desc, cat, dept in spec_list:
                    ind_obj, created = HazardIndicator.objects.update_or_create(
                        code=code,
                        defaults={
                            "name": name,
                            "unit": unit,
                            "category": cat,
                            "department": dept,
                            "default_weight": def_weight,
                            "min_weight": 0.0,
                            "max_weight": 10.0,
                            "is_active": True,
                            "order": order,
                            "description": desc,
                            "module_type": module_type,
                            "hazard_type": h_code,
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
                    f"{module_type} ({h_code or 'Baseline'}) indicators seeded ({len(spec_list)} indicators)."
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
