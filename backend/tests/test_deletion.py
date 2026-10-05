import pytest
from rest_framework.test import APIClient
from apps.administration.models import AdministrativeUnit
from apps.assessments.models import Assessment, RiskAssessment
from apps.datasets.models import DataSource

@pytest.mark.django_db
def test_delete_assessment():
    client = APIClient()
    state = AdministrativeUnit.objects.create(name="Kerala State", code="KL", level="STATE")
    district = AdministrativeUnit.objects.create(name="Wayanad", code="WYD", level="DISTRICT", parent=state)
    assessment = Assessment.objects.create(
        name="Test Assessment to Delete",
        module_type="HAZARD",
        hazard_type="FLOOD",
        state=state,
        district=district,
        administrative_level="BLOCK",
    )
    
    resp = client.delete(f"/api/assessments/{assessment.id}/")
    assert resp.status_code == 204
    assert not Assessment.objects.filter(id=assessment.id).exists()

@pytest.mark.django_db
def test_delete_risk_assessment():
    client = APIClient()
    state = AdministrativeUnit.objects.create(name="Kerala State", code="KL", level="STATE")
    district = AdministrativeUnit.objects.create(name="Idukki", code="IDK", level="DISTRICT", parent=state)
    risk = RiskAssessment.objects.create(
        name="Test Risk Assessment to Delete",
        state=state,
        district=district,
        administrative_level="BLOCK",
    )
    
    resp = client.delete(f"/api/risk-assessments/{risk.id}/")
    assert resp.status_code == 204
    assert not RiskAssessment.objects.filter(id=risk.id).exists()

@pytest.mark.django_db
def test_delete_data_source():
    client = APIClient()
    ds = DataSource.objects.create(
        name="Custom Test Layer",
        organization="Test Org",
        vintage="2024",
    )
    
    resp = client.delete(f"/api/data-sources/{ds.id}/")
    assert resp.status_code == 204
    assert not DataSource.objects.filter(id=ds.id).exists()
