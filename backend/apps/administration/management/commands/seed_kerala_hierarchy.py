"""
Management command: seed_kerala_hierarchy

Seeds the COMPLETE Kerala administrative hierarchy with EXACTLY the 78 official taluks:
  - Kerala (State)
  - All 14 Districts
  - All 78 Official Taluks with real geographic coordinates and proportionate polygons

Breakdown of the 78 official taluks by district:
  - Thiruvananthapuram: 6
  - Kollam: 6
  - Pathanamthitta: 6
  - Alappuzha: 6
  - Kottayam: 5
  - Idukki: 5
  - Ernakulam: 7
  - Thrissur: 7
  - Palakkad: 7
  - Malappuram: 7
  - Kozhikode: 4
  - Wayanad: 3
  - Kannur: 5
  - Kasaragod: 4
  Total = 78 Taluks

Run with:
  python manage.py seed_kerala_hierarchy
  python manage.py seed_kerala_hierarchy --force
"""
import json
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.administration.models import AdministrativeUnit
from gis.spatial import update_unit_geometry_metadata


# ============================================================
#  OFFICIAL 78 TALUKS OF KERALA (State → 14 Districts → 78 Taluks)
# ============================================================
KERALA_HIERARCHY = {
    "state": {
        "name": "Kerala",
        "code": "KL",
        "centroid_lat": 10.8505,
        "centroid_lon": 76.2711,
    },
    "districts": [
        {
            "name": "Thiruvananthapuram",
            "code": "KL_TVM",
            "alt_codes": ["KL-TVM"],
            "centroid_lat": 8.5241,
            "centroid_lon": 76.9366,
            "talukas": [
                {"name": "Thiruvananthapuram", "code": "KL_TVM_TVM", "lat": 8.524, "lon": 76.937, "size": 0.14},
                {"name": "Neyyattinkara",       "code": "KL_TVM_NYK", "lat": 8.400, "lon": 77.090, "size": 0.13},
                {"name": "Kattakkada",          "code": "KL_TVM_KTD", "lat": 8.440, "lon": 77.080, "size": 0.13},
                {"name": "Nedumangad",          "code": "KL_TVM_NDM", "lat": 8.600, "lon": 77.000, "size": 0.14},
                {"name": "Chirayinkeezhu",     "code": "KL_TVM_CHK", "lat": 8.700, "lon": 76.850, "size": 0.13},
                {"name": "Varkala",             "code": "KL_TVM_VRK", "lat": 8.730, "lon": 76.720, "size": 0.12},
            ],
        },
        {
            "name": "Kollam",
            "code": "KL_KLM",
            "alt_codes": ["KL-KLM"],
            "centroid_lat": 8.8932,
            "centroid_lon": 76.6141,
            "talukas": [
                {"name": "Kollam",          "code": "KL_KLM_KLM", "lat": 8.893, "lon": 76.614, "size": 0.14},
                {"name": "Kunnathur",       "code": "KL_KLM_KNR", "lat": 9.060, "lon": 76.670, "size": 0.12},
                {"name": "Karunagappally",   "code": "KL_KLM_KGP", "lat": 9.055, "lon": 76.536, "size": 0.13},
                {"name": "Kottarakkara",    "code": "KL_KLM_KTR", "lat": 8.998, "lon": 76.770, "size": 0.14},
                {"name": "Punalur",         "code": "KL_KLM_PNL", "lat": 9.018, "lon": 76.928, "size": 0.14},
                {"name": "Pathanapuram",    "code": "KL_KLM_PTP", "lat": 9.090, "lon": 76.855, "size": 0.13},
            ],
        },
        {
            "name": "Pathanamthitta",
            "code": "KL_PTA",
            "alt_codes": ["KL-PTA"],
            "centroid_lat": 9.2648,
            "centroid_lon": 76.7870,
            "talukas": [
                {"name": "Adoor",           "code": "KL_PTA_ADR", "lat": 9.155, "lon": 76.732, "size": 0.13},
                {"name": "Konni",           "code": "KL_PTA_KNI", "lat": 9.240, "lon": 76.850, "size": 0.14},
                {"name": "Kozhencherry",    "code": "KL_PTA_KZC", "lat": 9.336, "lon": 76.710, "size": 0.13},
                {"name": "Ranni",           "code": "KL_PTA_RNI", "lat": 9.380, "lon": 76.810, "size": 0.14},
                {"name": "Mallappally",     "code": "KL_PTA_MLP", "lat": 9.445, "lon": 76.650, "size": 0.12},
                {"name": "Thiruvalla",      "code": "KL_PTA_TVL", "lat": 9.384, "lon": 76.574, "size": 0.13},
            ],
        },
        {
            "name": "Alappuzha",
            "code": "KL_ALP",
            "alt_codes": ["KL-ALP"],
            "centroid_lat": 9.4981,
            "centroid_lon": 76.3388,
            "talukas": [
                {"name": "Ambalappuzha",    "code": "KL_ALP_ABP", "lat": 9.380, "lon": 76.360, "size": 0.13},
                {"name": "Chengannur",      "code": "KL_ALP_CGR", "lat": 9.317, "lon": 76.617, "size": 0.13},
                {"name": "Cherthala",       "code": "KL_ALP_CTL", "lat": 9.685, "lon": 76.330, "size": 0.13},
                {"name": "Karthikappally",   "code": "KL_ALP_KTP", "lat": 9.250, "lon": 76.480, "size": 0.13},
                {"name": "Kuttanad",        "code": "KL_ALP_KTN", "lat": 9.500, "lon": 76.450, "size": 0.13},
                {"name": "Mavelikkara",      "code": "KL_ALP_MVK", "lat": 9.267, "lon": 76.540, "size": 0.13},
            ],
        },
        {
            "name": "Kottayam",
            "code": "KL_KTM",
            "alt_codes": ["KL-KTM"],
            "centroid_lat": 9.5916,
            "centroid_lon": 76.5222,
            "talukas": [
                {"name": "Changanasserry",  "code": "KL_KTM_CGC", "lat": 9.446, "lon": 76.540, "size": 0.13},
                {"name": "Kottayam",        "code": "KL_KTM_KTM", "lat": 9.592, "lon": 76.522, "size": 0.14},
                {"name": "Vaikom",          "code": "KL_KTM_VKM", "lat": 9.750, "lon": 76.396, "size": 0.13},
                {"name": "Meenachil",       "code": "KL_KTM_MCL", "lat": 9.710, "lon": 76.685, "size": 0.13},
                {"name": "Kanjirappally",   "code": "KL_KTM_KJP", "lat": 9.558, "lon": 76.784, "size": 0.14},
            ],
        },
        {
            "name": "Idukki",
            "code": "KL_IDK",
            "alt_codes": ["KL-IDK"],
            "centroid_lat": 9.9189,
            "centroid_lon": 77.1025,
            "talukas": [
                {"name": "Devikulam",       "code": "KL_IDK_DVK", "lat": 10.060, "lon": 77.110, "size": 0.20},
                {"name": "Idukki",          "code": "KL_IDK_IDK", "lat": 9.850, "lon": 76.970, "size": 0.18},
                {"name": "Peerumade",       "code": "KL_IDK_PRM", "lat": 9.580, "lon": 77.020, "size": 0.18},
                {"name": "Thodupuzha",      "code": "KL_IDK_TDP", "lat": 9.896, "lon": 76.716, "size": 0.16},
                {"name": "Udumbanchola",    "code": "KL_IDK_UDC", "lat": 9.890, "lon": 77.190, "size": 0.18},
            ],
        },
        {
            "name": "Ernakulam",
            "code": "KL_EKM",
            "alt_codes": ["KL-EKM"],
            "centroid_lat": 9.9816,
            "centroid_lon": 76.2999,
            "talukas": [
                {"name": "Aluva",           "code": "KL_EKM_ALV", "lat": 10.108, "lon": 76.357, "size": 0.14},
                {"name": "Kanayannur",      "code": "KL_EKM_KYN", "lat": 9.950, "lon": 76.280, "size": 0.13},
                {"name": "Kochi",           "code": "KL_EKM_KOC", "lat": 9.965, "lon": 76.240, "size": 0.13},
                {"name": "Kothamangalam",   "code": "KL_EKM_KTG", "lat": 10.060, "lon": 76.630, "size": 0.15},
                {"name": "Kunnathunad",     "code": "KL_EKM_KTD", "lat": 10.110, "lon": 76.480, "size": 0.14},
                {"name": "Muvattupuzha",    "code": "KL_EKM_MVP", "lat": 9.987, "lon": 76.580, "size": 0.14},
                {"name": "North Paravur",   "code": "KL_EKM_PRV", "lat": 10.145, "lon": 76.228, "size": 0.13},
            ],
        },
        {
            "name": "Thrissur",
            "code": "KL_TSR",
            "alt_codes": ["KL-TSR"],
            "centroid_lat": 10.5276,
            "centroid_lon": 76.2144,
            "talukas": [
                {"name": "Chalakudy",       "code": "KL_TSR_CLK", "lat": 10.307, "lon": 76.333, "size": 0.14},
                {"name": "Chavakkad",       "code": "KL_TSR_CVK", "lat": 10.580, "lon": 76.025, "size": 0.13},
                {"name": "Kodungallur",     "code": "KL_TSR_KDG", "lat": 10.220, "lon": 76.195, "size": 0.13},
                {"name": "Kunnamkulam",     "code": "KL_TSR_KNM", "lat": 10.650, "lon": 76.070, "size": 0.13},
                {"name": "Mukundapuram",    "code": "KL_TSR_MKP", "lat": 10.350, "lon": 76.210, "size": 0.13},
                {"name": "Thalapilly",      "code": "KL_TSR_TLP", "lat": 10.660, "lon": 76.240, "size": 0.14},
                {"name": "Thrissur",        "code": "KL_TSR_TSR", "lat": 10.528, "lon": 76.214, "size": 0.14},
            ],
        },
        {
            "name": "Palakkad",
            "code": "KL_PKD",
            "alt_codes": ["KL-PKD"],
            "centroid_lat": 10.7867,
            "centroid_lon": 76.6548,
            "talukas": [
                {"name": "Alathur",         "code": "KL_PKD_ALT", "lat": 10.645, "lon": 76.545, "size": 0.14},
                {"name": "Chittur",         "code": "KL_PKD_CTT", "lat": 10.700, "lon": 76.750, "size": 0.15},
                {"name": "Mannarkkad",      "code": "KL_PKD_MNG", "lat": 10.990, "lon": 76.460, "size": 0.16},
                {"name": "Ottappalam",      "code": "KL_PKD_OTP", "lat": 10.770, "lon": 76.380, "size": 0.14},
                {"name": "Palakkad",        "code": "KL_PKD_PKD", "lat": 10.787, "lon": 76.655, "size": 0.15},
                {"name": "Pattambi",        "code": "KL_PKD_PTB", "lat": 10.810, "lon": 76.190, "size": 0.13},
                {"name": "Attappady",       "code": "KL_PKD_ATP", "lat": 11.080, "lon": 76.650, "size": 0.16},
            ],
        },
        {
            "name": "Malappuram",
            "code": "KL_MLP",
            "alt_codes": ["KL-MLP"],
            "centroid_lat": 11.0730,
            "centroid_lon": 76.0740,
            "talukas": [
                {"name": "Eranad",          "code": "KL_MLP_ERD", "lat": 11.120, "lon": 76.120, "size": 0.14},
                {"name": "Kondotty",        "code": "KL_MLP_KDT", "lat": 11.145, "lon": 75.965, "size": 0.13},
                {"name": "Nilambur",        "code": "KL_MLP_NLB", "lat": 11.277, "lon": 76.225, "size": 0.16},
                {"name": "Perinthalmanna",  "code": "KL_MLP_PTM", "lat": 10.975, "lon": 76.225, "size": 0.14},
                {"name": "Ponnani",         "code": "KL_MLP_PNI", "lat": 10.770, "lon": 75.925, "size": 0.13},
                {"name": "Tirur",           "code": "KL_MLP_TRR", "lat": 10.915, "lon": 75.925, "size": 0.14},
                {"name": "Tirurangadi",     "code": "KL_MLP_TRG", "lat": 11.040, "lon": 75.930, "size": 0.13},
            ],
        },
        {
            "name": "Kozhikode",
            "code": "KL_KZD",
            "alt_codes": ["KL-KZD"],
            "centroid_lat": 11.2588,
            "centroid_lon": 75.7804,
            "talukas": [
                {"name": "Kozhikode",       "code": "KL_KZD_KZD", "lat": 11.259, "lon": 75.780, "size": 0.14},
                {"name": "Koyilandy",       "code": "KL_KZD_KYL", "lat": 11.440, "lon": 75.700, "size": 0.14},
                {"name": "Thamarassery",    "code": "KL_KZD_TRS", "lat": 11.420, "lon": 75.935, "size": 0.15},
                {"name": "Vadakara",        "code": "KL_KZD_VDK", "lat": 11.600, "lon": 75.590, "size": 0.14},
            ],
        },
        {
            "name": "Wayanad",
            "code": "KL_WYD",
            "alt_codes": ["KL-WYD"],
            "centroid_lat": 11.6854,
            "centroid_lon": 76.1320,
            "talukas": [
                {"name": "Mananthavady",    "code": "KL_WYD_MND", "lat": 11.805, "lon": 76.005, "size": 0.16},
                {"name": "Sulthan Bathery", "code": "KL_WYD_SBT", "lat": 11.665, "lon": 76.260, "size": 0.15},
                {"name": "Vythiri",         "code": "KL_WYD_VYT", "lat": 11.610, "lon": 76.085, "size": 0.15},
            ],
        },
        {
            "name": "Kannur",
            "code": "KL_KNR",
            "alt_codes": ["KL-KNR"],
            "centroid_lat": 11.8745,
            "centroid_lon": 75.3704,
            "talukas": [
                {"name": "Iritty",          "code": "KL_KNR_IRT", "lat": 11.980, "lon": 75.670, "size": 0.15},
                {"name": "Kannur",          "code": "KL_KNR_KNR", "lat": 11.875, "lon": 75.370, "size": 0.14},
                {"name": "Payyannur",       "code": "KL_KNR_PYR", "lat": 12.100, "lon": 75.200, "size": 0.14},
                {"name": "Taliparamba",     "code": "KL_KNR_TLP", "lat": 12.040, "lon": 75.360, "size": 0.14},
                {"name": "Thalassery",      "code": "KL_KNR_TLS", "lat": 11.750, "lon": 75.490, "size": 0.13},
            ],
        },
        {
            "name": "Kasaragod",
            "code": "KL_KSD",
            "alt_codes": ["KL-KSD"],
            "centroid_lat": 12.4996,
            "centroid_lon": 74.9869,
            "talukas": [
                {"name": "Hosdurg",         "code": "KL_KSD_HSD", "lat": 12.315, "lon": 75.090, "size": 0.14},
                {"name": "Kasaragod",       "code": "KL_KSD_KSD", "lat": 12.500, "lon": 74.987, "size": 0.14},
                {"name": "Manjeshwaram",    "code": "KL_KSD_MJW", "lat": 12.710, "lon": 74.890, "size": 0.14},
                {"name": "Vellarikundu",    "code": "KL_KSD_VLK", "lat": 12.330, "lon": 75.320, "size": 0.15},
            ],
        },
    ],
}


def make_block_polygon(lat: float, lon: float, size: float):
    """Generate a realistic block polygon centred at geographic coordinates."""
    h = size / 2.0
    return {
        "type": "Polygon",
        "coordinates": [[
            [round(lon - h, 5), round(lat - h, 5)],
            [round(lon + h, 5), round(lat - h, 5)],
            [round(lon + h, 5), round(lat + h, 5)],
            [round(lon - h, 5), round(lat + h, 5)],
            [round(lon - h, 5), round(lat - h, 5)],
        ]]
    }


def make_district_polygon(talukas):
    """Generate a bounding envelope covering all talukas of the district."""
    min_lon = min(t["lon"] - t["size"] / 2.0 for t in talukas) - 0.04
    max_lon = max(t["lon"] + t["size"] / 2.0 for t in talukas) + 0.04
    min_lat = min(t["lat"] - t["size"] / 2.0 for t in talukas) - 0.04
    max_lat = max(t["lat"] + t["size"] / 2.0 for t in talukas) + 0.04
    return {
        "type": "Polygon",
        "coordinates": [[
            [round(min_lon, 5), round(min_lat, 5)],
            [round(max_lon, 5), round(min_lat, 5)],
            [round(max_lon, 5), round(max_lat, 5)],
            [round(min_lon, 5), round(max_lat, 5)],
            [round(min_lon, 5), round(min_lat, 5)],
        ]]
    }


class Command(BaseCommand):
    help = "Seed/update complete Kerala hierarchy with the official 78 taluks across all 14 districts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force updating all geometries and names.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("=" * 65))
        self.stdout.write(self.style.WARNING("SEEDING OFFICIAL 78 TALUKS FOR ALL 14 KERALA DISTRICTS"))
        self.stdout.write(self.style.WARNING("=" * 65))

        with transaction.atomic():
            self._seed()

        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(self.style.SUCCESS("Done! All 14 districts and official 78 talukas are now populated."))
        self.stdout.write(self.style.SUCCESS("=" * 65))

    def _seed(self):
        state_data = KERALA_HIERARCHY["state"]
        state = AdministrativeUnit.objects.filter(code="KL", level="STATE").first()
        if not state:
            state = AdministrativeUnit.objects.create(
                code="KL",
                name="Kerala",
                level="STATE",
                parent=None,
                centroid_lat=state_data["centroid_lat"],
                centroid_lon=state_data["centroid_lon"],
                is_demo=False,
            )
        else:
            state.name = "Kerala"
            state.centroid_lat = state_data["centroid_lat"]
            state.centroid_lon = state_data["centroid_lon"]
            state.save()

        total_districts = 0
        total_blocks = 0

        for dist_data in KERALA_HIERARCHY["districts"]:
            dist_name = dist_data["name"]
            codes_to_check = [dist_data["code"]] + dist_data.get("alt_codes", [])

            district = AdministrativeUnit.objects.filter(level="DISTRICT").filter(
                code__in=codes_to_check
            ).first()

            if not district:
                district = AdministrativeUnit.objects.filter(
                    level="DISTRICT",
                    name__icontains=dist_name
                ).first()

            dist_poly = make_district_polygon(dist_data["talukas"])

            if not district:
                district = AdministrativeUnit.objects.create(
                    code=dist_data["code"],
                    name=dist_name,
                    level="DISTRICT",
                    parent=state,
                    centroid_lat=dist_data["centroid_lat"],
                    centroid_lon=dist_data["centroid_lon"],
                    geometry_geojson=json.dumps(dist_poly),
                    is_demo=False,
                )
                total_districts += 1
            else:
                district.name = dist_name
                district.parent = state
                district.centroid_lat = dist_data["centroid_lat"]
                district.centroid_lon = dist_data["centroid_lon"]
                district.geometry_geojson = json.dumps(dist_poly)
                district.save()

            update_unit_geometry_metadata(district)
            self.stdout.write(f"  [DISTRICT] {district.name} ({len(dist_data['talukas'])} official talukas)")

            # Create / update the official talukas
            for t_data in dist_data["talukas"]:
                t_name = t_data["name"]
                t_poly = make_block_polygon(t_data["lat"], t_data["lon"], t_data["size"])

                block = AdministrativeUnit.objects.filter(
                    level="BLOCK",
                    parent=district
                ).filter(
                    name__icontains=t_name
                ).first()

                if not block:
                    block = AdministrativeUnit.objects.filter(
                        level="BLOCK",
                        parent=district,
                        code=t_data["code"]
                    ).first()

                if not block:
                    block = AdministrativeUnit.objects.filter(code=t_data["code"]).first()
                    if block:
                        block.parent = district

                if not block:
                    b_code = t_data["code"]
                    if AdministrativeUnit.objects.filter(code=b_code).exists():
                        b_code = f"{b_code}_{district.id}"
                    block = AdministrativeUnit.objects.create(
                        code=b_code,
                        name=t_name,
                        level="BLOCK",
                        parent=district,
                        centroid_lat=t_data["lat"],
                        centroid_lon=t_data["lon"],
                        geometry_geojson=json.dumps(t_poly),
                        is_demo=False,
                    )
                    total_blocks += 1
                else:
                    block.name = t_name
                    block.parent = district
                    block.centroid_lat = t_data["lat"]
                    block.centroid_lon = t_data["lon"]
                    block.geometry_geojson = json.dumps(t_poly)
                    block.save()

                update_unit_geometry_metadata(block)

        self.stdout.write(self.style.SUCCESS(f"Finished updating all 14 districts and all 78 official talukas."))
