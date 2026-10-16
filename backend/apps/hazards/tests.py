"""
Tests for Kerala HVRA Disaster News & Official Alerts Feed
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.hazards.alerts_service import (
    detect_kerala_districts,
    detect_hazard_type,
    map_severity,
    deduplicate_alerts,
    get_live_disaster_dashboard_feed,
)


class DisasterAlertsServiceTests(TestCase):
    def test_detect_kerala_districts_english(self):
        text = "Severe rain warning for Wayanad and Idukki districts"
        districts = detect_kerala_districts(text)
        names = [d["name"] for d in districts]
        self.assertIn("Wayanad", names)
        self.assertIn("Idukki", names)
        self.assertNotIn("Kasaragod", names)

    def test_detect_kerala_districts_malayalam(self):
        text = "തിരുവനന്തപുരം ജില്ലയിൽ ഇടിമിന്നലോട് കൂടിയ മഴ"
        districts = detect_kerala_districts(text)
        names = [d["name"] for d in districts]
        self.assertIn("Thiruvananthapuram", names)

    def test_detect_hazard_type_flood(self):
        code, label, icon = detect_hazard_type("Heavy flood warning and dam shutter opening")
        self.assertEqual(code, "FLOOD")
        self.assertEqual(icon, "🌊")

    def test_detect_hazard_type_landslide(self):
        code, label, icon = detect_hazard_type("Massive landslide reported in hilly terrain")
        self.assertEqual(code, "LANDSLIDE")
        self.assertEqual(icon, "⛰️")

    def test_detect_hazard_type_earthquake(self):
        code, label, icon = detect_hazard_type("Magnitude 4.2 earthquake tremor detected")
        self.assertEqual(code, "EARTHQUAKE")
        self.assertEqual(icon, "🌋")

    def test_map_severity_red(self):
        code, label, color = map_severity(text="IMD issues red alert in four districts")
        self.assertEqual(code, "RED")
        self.assertEqual(color, "#dc2626")

    def test_map_severity_orange(self):
        code, label, color = map_severity(cap_severity="Severe")
        self.assertEqual(code, "ORANGE")
        self.assertEqual(color, "#ea580c")

    def test_map_severity_yellow(self):
        code, label, color = map_severity(cap_severity="Moderate")
        self.assertEqual(code, "YELLOW")

    def test_deduplicate_alerts(self):
        sample_items = [
            {
                "id": "1",
                "headline": "Very heavy rain in Wayanad district today",
                "hazard_type": "HEAVY_RAIN",
                "affected_district": "Wayanad",
                "is_official": False,
                "severity": "YELLOW",
            },
            {
                "id": "2",
                "headline": "Very heavy rain in Wayanad district today",
                "hazard_type": "HEAVY_RAIN",
                "affected_district": "Wayanad",
                "is_official": True,
                "severity": "ORANGE",
            },
        ]
        deduped = deduplicate_alerts(sample_items)
        self.assertEqual(len(deduped), 1)
        # Official alert should take precedence
        self.assertTrue(deduped[0]["is_official"])


class DisasterAlertsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_disaster_alerts_endpoint_get(self):
        response = self.client.get("/api/disaster-alerts/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data["status"], "success")
        self.assertIn("alerts", data)
        self.assertIn("sources_status", data)
        self.assertIn("official_directory", data)
        self.assertIn("kerala_districts", data)

    def test_disaster_alerts_filtering_by_hazard(self):
        response = self.client.get("/api/disaster-alerts/?hazard_type=FLOOD")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for alert in response.data.get("alerts", []):
            self.assertEqual(alert["hazard_type"], "FLOOD")

    def test_disaster_alerts_filtering_by_source(self):
        response = self.client.get("/api/disaster-alerts/?source_type=OFFICIAL")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for alert in response.data.get("alerts", []):
            self.assertTrue(alert["is_official"])
