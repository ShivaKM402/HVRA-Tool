"""
tests/test_reports.py — Verification of publication-grade PDF, DOCX, and CSV generation
including spatial thematic map rendering and diagnostic reasoning.
"""
import pytest
from unittest.mock import MagicMock
from apps.administration.models import AdministrativeUnit
from apps.assessments.models import Assessment
from apps.reports.services import (
    generate_assessment_docx,
    generate_assessment_pdf,
    generate_assessment_csv,
    generate_risk_report_docx,
    generate_risk_report_pdf,
    get_block_diagnostic_reason,
)


@pytest.mark.django_db
def test_assessment_reports_with_map_and_diagnostics():
    state = AdministrativeUnit.objects.create(name="Kerala", code="KL", level="STATE")
    district = AdministrativeUnit.objects.create(name="Kottayam", code="KTM", level="DISTRICT", parent=state)
    block1 = AdministrativeUnit.objects.create(
        name="Kottayam Central", code="KTM_CEN", level="BLOCK", parent=district,
        centroid_lat=9.59, centroid_lon=76.52,
        geometry_geojson='{"type":"Polygon","coordinates":[[[76.50,9.55],[76.55,9.55],[76.55,9.62],[76.50,9.62],[76.50,9.55]]]}'
    )
    block2 = AdministrativeUnit.objects.create(
        name="Changanacherry", code="CHG", level="BLOCK", parent=district,
        centroid_lat=9.44, centroid_lon=76.54,
        geometry_geojson='{"type":"Polygon","coordinates":[[[76.51,9.40],[76.57,9.40],[76.57,9.48],[76.51,9.48],[76.51,9.40]]]}'
    )

    assessment = Assessment.objects.create(
        name="Kottayam Flood Hazard Assessment",
        module_type="HAZARD",
        hazard_type="FLOOD",
        state=state,
        district=district,
        administrative_level="BLOCK",
        status="COMPLETED"
    )

    mock_report_data = {
        "metadata": {
            "name": assessment.name,
            "district": district.name,
            "state": state.name,
            "module_type": "HAZARD",
            "module_label": "Hazard Assessment",
            "hazard_type": "FLOOD",
            "status": "COMPLETED",
        },
        "classification_summary": {"HH": 1, "MH": 1, "LH": 0, "NH": 0},
        "class_labels": {"HH": "High Hazard", "MH": "Medium Hazard", "LH": "Low Hazard", "NH": "No Hazard"},
        "methodology": [
            {"indicator": "Flood Inundation Depth", "weight": 8.0, "unit": "meters"},
            {"indicator": "Monsoon Peak Runoff", "weight": 7.0, "unit": "mm/day"},
        ],
        "block_results": [
            {
                "unit_name": "Kottayam Central",
                "composite_score": 8.5,
                "classification": "HH",
                "metadata": {"flood_prone_percentage": 52.4, "event_count": 8},
            },
            {
                "unit_name": "Changanacherry",
                "composite_score": 5.8,
                "classification": "MH",
                "metadata": {"flood_prone_percentage": 28.1, "event_count": 3},
            },
        ],
        "findings": {"hh_blocks": ["Kottayam Central"], "max_score": 8.5, "max_score_block": "Kottayam Central"},
        "climate_context": [
            {
                "title": "Monsoon Rainfall Anomaly",
                "statement": "72-hour precipitation intensity exceeds historical 100-year baseline by 18%.",
                "source": "IMD Climate Bulletin",
                "vintage": "2024",
            }
        ],
        "recommendations": [
            "Deploy mobile pumping units to Kottayam Central.",
            "Desilt secondary canal arteries ahead of monsoon onset.",
        ],
    }

    # Test PDF generation
    pdf_buf = generate_assessment_pdf(assessment, mock_report_data)
    pdf_bytes = pdf_buf.getvalue()
    assert len(pdf_bytes) > 50000, f"PDF should be substantial with embedded map (got {len(pdf_bytes)} bytes)"
    assert pdf_bytes.startswith(b"%PDF"), "Must be a valid PDF document"

    # Test DOCX generation
    docx_buf = generate_assessment_docx(assessment, mock_report_data)
    docx_bytes = docx_buf.getvalue()
    assert len(docx_bytes) > 50000, f"DOCX should be substantial with embedded map (got {len(docx_bytes)} bytes)"
    assert docx_bytes.startswith(b"PK"), "Must be a valid zipped OpenXML DOCX document"

    # Test CSV generation
    csv_str = generate_assessment_csv(assessment, mock_report_data)
    assert "Diagnostic Reasoning & Primary Drivers" in csv_str
    assert "ACUTE HAZARD SUSCEPTIBILITY" in csv_str
    assert len(csv_str) > 200

    # Test Diagnostic reasoning function
    mock_block = {"unit_name": "Test Block", "composite_score": 8.5, "classification": "HH", "metadata": {"flood_prone_percentage": 45.0, "event_count": 5}}
    reason = get_block_diagnostic_reason("HAZARD", "Flood", mock_block)
    assert "ACUTE HAZARD SUSCEPTIBILITY" in reason
    assert "45.0%" in reason


@pytest.mark.django_db
def test_risk_reports_with_map_and_diagnostics():
    state = AdministrativeUnit.objects.create(name="Kerala", code="KL2", level="STATE")
    district = AdministrativeUnit.objects.create(name="Kottayam", code="KTM2", level="DISTRICT", parent=state)
    block1 = AdministrativeUnit.objects.create(
        name="Kottayam Central", code="KTM_CEN2", level="BLOCK", parent=district,
        centroid_lat=9.59, centroid_lon=76.52,
        geometry_geojson='{"type":"Polygon","coordinates":[[[76.50,9.55],[76.55,9.55],[76.55,9.62],[76.50,9.62],[76.50,9.55]]]}'
    )

    mock_risk = MagicMock()
    mock_risk.district = district

    mock_report_data = {
        "metadata": {
            "name": "Kottayam Composite Risk Assessment",
            "district": "Kottayam",
            "state": "Kerala",
            "formula": "MULTIPLICATIVE",
            "weights": {"hazard": 1.0, "vulnerability": 1.0, "exposure": 1.0},
            "status": "COMPLETED",
            "inputs": {
                "hazard_assessment": "Flood Hazard Module",
                "vulnerability_assessment": "Socio-Economic Vulnerability",
                "exposure_assessment": "Asset & Lifeline Exposure",
            },
        },
        "classification_summary": {"VERY_HIGH": 1, "HIGH": 0, "MODERATE": 0, "LOW": 0},
        "risk_class_labels": {
            "VERY_HIGH": "Very High Risk",
            "HIGH": "High Risk",
            "MODERATE": "Moderate Risk",
            "LOW": "Low Risk",
        },
        "block_results": [
            {
                "unit_name": "Kottayam Central",
                "hazard_score": 8.5,
                "vulnerability_score": 7.2,
                "exposure_score": 7.8,
                "risk_score": 7.85,
                "risk_class": "VERY_HIGH",
            }
        ],
        "recommendations": ["Execute priority structural embankment fortification."],
        "findings": {"very_high_units": ["Kottayam Central"]},
    }

    # Test Risk PDF
    pdf_buf = generate_risk_report_pdf(mock_risk, mock_report_data)
    pdf_bytes = pdf_buf.getvalue()
    assert len(pdf_bytes) > 50000
    assert pdf_bytes.startswith(b"%PDF")

    # Test Risk DOCX
    docx_buf = generate_risk_report_docx(mock_risk, mock_report_data)
    docx_bytes = docx_buf.getvalue()
    assert len(docx_bytes) > 50000
    assert docx_bytes.startswith(b"PK")
