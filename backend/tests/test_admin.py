"""
Tests for administrative foundation (Phase 2):
- Kerala state exists
- Kottayam pilot district exists
- Blocks belong to Kottayam
- GeoJSON endpoint returns only Kottayam blocks
- Other districts are not returned by the demo endpoint
- Geometry is valid
- Area/centroid/bounding box metadata available
"""
import pytest
from rest_framework.test import APIClient
from django.core.management import call_command
from apps.administration.models import AdministrativeUnit


@pytest.mark.django_db
class TestAdministrativeFoundation:

    def setup_method(self):
        call_command("seed_demo_data")
        self.client = APIClient()

    def test_kerala_state_exists(self):
        kerala = AdministrativeUnit.objects.filter(level="STATE", code="KL").first()
        assert kerala is not None
        assert "Kerala" in kerala.name

    def test_kottayam_district_exists(self):
        kottayam = AdministrativeUnit.objects.filter(level="DISTRICT", code="KL-KTM").first()
        assert kottayam is not None
        assert "Kottayam" in kottayam.name
        assert kottayam.parent is not None
        assert kottayam.parent.code == "KL"

    def test_blocks_belong_to_kottayam(self):
        blocks = AdministrativeUnit.objects.filter(level="BLOCK")
        assert blocks.count() > 0
        for block in blocks:
            assert block.parent is not None
            assert block.parent.code == "KL-KTM"
            assert "Kottayam" in block.parent.name

    def test_geojson_endpoint_returns_kottayam_blocks(self):
        response = self.client.get("/api/admin-units/geojson/?district=Kottayam&level=block")
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "FeatureCollection"
        features = data["features"]
        assert len(features) == 12
        for feature in features:
            props = feature["properties"]
            assert props["level"] == "BLOCK"
            assert "Kottayam" in props["district"]

    def test_other_districts_not_returned(self):
        response = self.client.get("/api/districts/")
        assert response.status_code == 200
        districts = response.json()
        district_names = [d["name"] for d in districts]
        assert len(districts) == 1
        assert any("Kottayam" in d for d in district_names)
        assert not any("Ernakulam" in d for d in district_names)

    def test_block_geometry_is_valid(self):
        blocks = AdministrativeUnit.objects.filter(level="BLOCK")
        for block in blocks:
            geo = block.geometry
            assert geo is not None
            assert geo["type"] in ["Polygon", "MultiPolygon"]
            assert len(geo["coordinates"]) > 0

    def test_area_centroid_bbox_available(self):
        blocks = AdministrativeUnit.objects.filter(level="BLOCK")
        assert blocks.count() == 12
        for block in blocks:
            assert block.area_sqkm is not None and block.area_sqkm > 0
            assert block.centroid_lat is not None and 9.0 <= block.centroid_lat <= 10.0
            assert block.centroid_lon is not None and 76.0 <= block.centroid_lon <= 77.5
            assert block.bbox_minx is not None
            assert block.bbox_miny is not None
            assert block.bbox_maxx is not None
            assert block.bbox_maxy is not None
