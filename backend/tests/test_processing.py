import pytest
from rest_framework.test import APIClient
from apps.administration.models import AdministrativeUnit
from apps.hazards.models import HazardType, HazardIndicator, IndicatorWeightageRule, HazardLayer, HazardEvent
from apps.assessments.models import Assessment

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def setup_flood_data(db):
    # Setup Hazard
    ht = HazardType.objects.create(code="FLOOD", name="Flood", is_active=True)
    
    # Setup Admin
    kerala = AdministrativeUnit.objects.create(name="Kerala", code="KL", level="STATE")
    kottayam = AdministrativeUnit.objects.create(name="Kottayam", code="KTM", level="DISTRICT", parent=kerala)
    block1 = AdministrativeUnit.objects.create(name="Block 1", code="B1", level="BLOCK", parent=kottayam, area_sqkm=100.0)
    
    # Setup indicators
    ind_fp = HazardIndicator.objects.create(code="FLOOD_PRONE_AREA", name="Flood Prone Area", hazard_type="FLOOD")
    ind_ev = HazardIndicator.objects.create(code="HISTORICAL_FLOOD_EVENTS", name="Events", hazard_type="FLOOD")
    
    # Setup Rules
    IndicatorWeightageRule.objects.create(indicator=ind_fp, range_min=0, range_max=25, score=4, label="Low")
    IndicatorWeightageRule.objects.create(indicator=ind_fp, range_min=25, range_max=100, score=8, label="High")
    IndicatorWeightageRule.objects.create(indicator=ind_ev, range_min=0, range_max=5, score=6, label="Low")
    
    # Assessment
    assessment = Assessment.objects.create(
        name="Test Assessment",
        hazard_type="FLOOD",
        state=kerala,
        district=kottayam,
        administrative_level="BLOCK",
        status="DRAFT"
    )
    assessment.indicators.create(indicator=ind_fp, weight=8.0)
    assessment.indicators.create(indicator=ind_ev, weight=8.0)
    
    return assessment

@pytest.mark.django_db
def test_assessment_processing_success(api_client, setup_flood_data):
    assessment = setup_flood_data
    
    # Process
    url = f"/api/assessments/{assessment.id}/process/"
    res = api_client.post(url)
    assert res.status_code == 200
    assert res.data["status"] == "COMPLETED"
    
    assessment.refresh_from_db()
    assert assessment.status == "COMPLETED"
    
    # Check results
    results_url = f"/api/assessments/{assessment.id}/results/"
    res_results = api_client.get(results_url)
    assert res_results.status_code == 200
    assert res_results.data["total_units"] == 1
    
    # Check metadata properties are populated
    block_result = res_results.data["results"][0]
    assert "metadata" in block_result
    assert "flood_prone_percentage" in block_result["metadata"]
    
    # Check GeoJSON
    map_url = f"/api/assessments/{assessment.id}/map/"
    res_map = api_client.get(map_url)
    assert res_map.status_code == 200
    assert res_map.data["type"] == "FeatureCollection"
    
    # Check Report
    report_url = f"/api/assessments/{assessment.id}/report/"
    res_report = api_client.get(report_url)
    assert res_report.status_code == 200
    assert "metadata" in res_report.data
    assert "methodology" in res_report.data
    assert "findings" in res_report.data
