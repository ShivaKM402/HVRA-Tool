"""
Assessment views.

Module 1–3 (Hazard / Vulnerability / Exposure):
  POST /api/assessments/           → create assessment
  GET  /api/assessments/{id}/      → get assessment detail
  POST /api/assessments/{id}/process/ → trigger GIS processing + scoring
  GET  /api/assessments/{id}/results/ → get results
  GET  /api/assessments/{id}/map/  → get map GeoJSON
  GET  /api/assessments/{id}/report/ → structured report JSON
  GET  /api/assessments/{id}/export/{docx,pdf,csv}/ → file downloads

Module 4 (Composite Risk):
  POST /api/risk-assessments/            → create risk assessment (H × V × E)
  POST /api/risk-assessments/{id}/process/ → run the risk engine
  GET  /api/risk-assessments/{id}/results/
  GET  /api/risk-assessments/{id}/map/
  GET  /api/risk-assessments/{id}/report/
  GET  /api/risk-assessments/{id}/export/{docx,pdf}/

Task Force review (HVRA Section 8):
  POST /api/assessments/{id}/submit-for-review/
  POST /api/assessments/{id}/approve/     POST /api/assessments/{id}/reject/
  (same for risk-assessments)

Saved / shareable queries (HVRA Section 3.3):
  /api/saved-queries/            → CRUD for the current user
  /api/saved-queries/{id}/share/ → generate a public share link
  /api/saved-queries/shared/{token}/ → public read-only view
  /api/saved-queries/{id}/run/   → run the saved query (new assessment)
"""
import copy
import secrets
import uuid

from django.db.models import Q
from django.utils import timezone
from django.db import transaction
from django.http import HttpResponse
from rest_framework import viewsets, status, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import (
    Assessment, AssessmentResult, RiskAssessment, RiskResult,
    SavedQuery, ModuleTypeChoices, QueryModuleChoices,
)
from .serializers import (
    AssessmentSerializer, AssessmentCreateSerializer, AssessmentResultSerializer,
    RiskAssessmentSerializer, RiskAssessmentCreateSerializer, RiskResultSerializer,
    SavedQuerySerializer,
)
from apps.accounts.permissions import IsPlatformAdmin, CanContributeData
from apps.accounts.territory import (
    scope_district_qs,
    district_ids_in_territory,
    territory_profile,
)
from apps.reports.services import (
    generate_assessment_docx, generate_assessment_pdf, generate_assessment_csv,
    generate_risk_report_docx, generate_risk_report_pdf,
)


def _enforce_territory(request, district=None, linked_assessments=()):
    """Raise PermissionDenied when a territorial user creates an assessment
    whose district lies outside their assigned state/district (HVRA §2)."""
    user = getattr(request, "user", None)
    if not (user and user.is_authenticated) or user.is_staff or user.is_superuser:
        return
    profile = getattr(user, "profile", None)
    if not profile or not profile.is_territory_restricted():
        return

    candidates = []
    if district is not None:
        candidates.append(district)
    for a in linked_assessments:
        d = getattr(a, "district", None)
        if d is not None:
            candidates.append(d)
    if not candidates:
        return  # no district bound → nothing to enforce

    if not any(profile.territory_contains(c) for c in candidates):
        from rest_framework.exceptions import PermissionDenied
        scope = "your assigned territory"
        raise PermissionDenied(
            detail=f"Assessments may only be created within {scope} "
                   f"(HVRA role-based access)."
        )


MODULE_LABELS = {
    "HAZARD": "Hazard Assessment",
    "VULNERABILITY": "Vulnerability Assessment",
    "EXPOSURE": "Exposure Assessment",
    "COMPOSITE_RISK": "Composite Risk Assessment",
}

CLASSIFICATION_LABELS = {
    "NH": "No Hazard", "LH": "Low Hazard", "MH": "Medium Hazard", "HH": "High Hazard",
}

RISK_CLASS_LABELS = {
    "VERY_HIGH": "Very High Risk", "HIGH": "High Risk",
    "MODERATE": "Moderate Risk", "LOW": "Low Risk",
}


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------
def _load_blocks(assessment):
    """
    Load (or auto-seed) BLOCK-level units for an assessment's district.

    Returns (blocks_qs, blocks) where blocks is a list of dicts for GIS/scoring.
    """
    from apps.administration.models import AdministrativeUnit

    blocks_qs = AdministrativeUnit.objects.filter(
        parent=assessment.district, level="BLOCK"
    )

    if not blocks_qs.exists():
        d_lat = assessment.district.centroid_lat or 10.5
        d_lon = assessment.district.centroid_lon or 76.2
        block_names = ["North Block", "South Block", "East Block", "West Block", "Central Block"]
        offsets = [(-0.05, -0.05), (0.05, 0.05), (-0.05, 0.05), (0.05, -0.05), (0.0, 0.0)]
        for idx, bname in enumerate(block_names):
            dlat, dlon = offsets[idx]
            blat, blon = d_lat + dlat, d_lon + dlon
            half = 0.035
            coords = [
                [blon - half, blat - half],
                [blon + half, blat - half],
                [blon + half, blat + half],
                [blon - half, blat + half],
                [blon - half, blat - half],
            ]
            geom = {"type": "Polygon", "coordinates": [coords]}
            AdministrativeUnit.objects.create(
                name=f"{assessment.district.name.replace(' [DEMO]', '')} {bname}",
                code=f"{assessment.district.code or 'DST'}-B{idx+1:02d}",
                level="BLOCK",
                parent=assessment.district,
                centroid_lat=blat,
                centroid_lon=blon,
                area_sqkm=120.0 + idx * 15.0,
                geometry_geojson=__import__("json").dumps(geom),
                is_demo=True,
            )
        blocks_qs = AdministrativeUnit.objects.filter(
            parent=assessment.district, level="BLOCK"
        )

    blocks = [
        {"id": b.id, "name": b.name, "area_sqkm": b.area_sqkm, "geometry": b.geometry}
        for b in blocks_qs
    ]
    return blocks_qs, blocks


def _seed_villages(blocks_qs):
    """Auto-seed clearly-labelled DEMO village units under each block.

    Village geometries are synthetic sub-squares of the block footprint so the
    full State → District → Block → Village hierarchy can be exercised.
    """
    import json as _json

    from apps.administration.models import AdministrativeUnit

    village_names = ["North", "Central", "South"]
    offsets = [(-0.012, -0.012), (0.0, 0.0), (0.012, 0.012)]
    count = 0
    for block in blocks_qs:
        b_lat = block.centroid_lat or 10.5
        b_lon = block.centroid_lon or 76.2
        for idx, vname in enumerate(village_names):
            dlat, dlon = offsets[idx]
            vlat, vlon = b_lat + dlat, b_lon + dlon
            half = 0.008
            coords = [
                [vlon - half, vlat - half],
                [vlon + half, vlat - half],
                [vlon + half, vlat + half],
                [vlon - half, vlat + half],
                [vlon - half, vlat - half],
            ]
            geom = {"type": "Polygon", "coordinates": [coords]}
            AdministrativeUnit.objects.create(
                name=f"{block.name.replace(' [DEMO]', '')} — {vname} Village [DEMO]",
                code=f"{block.code}-V{idx + 1:02d}",
                level="VILLAGE",
                parent=block,
                centroid_lat=vlat,
                centroid_lon=vlon,
                area_sqkm=round((block.area_sqkm or 120.0) / 3.0, 2),
                geometry_geojson=_json.dumps(geom),
                is_demo=True,
            )
            count += 1
    return count


def _load_units(assessment):
    """Load (or auto-seed) the administrative units for an assessment.

    Supports BLOCK level (existing behaviour) and VILLAGE level (HVRA §1 —
    State / District / Block / Village admin-level support). VILLAGE units are
    auto-seeded as DEMO villages under each block when they do not exist.

    Returns (units_qs, units) where units is a list of dicts for GIS/scoring.
    """
    from apps.administration.models import AdministrativeUnit

    level = (assessment.administrative_level or "BLOCK").upper()
    if level != "VILLAGE":
        return _load_blocks(assessment)

    blocks_qs = AdministrativeUnit.objects.filter(
        parent=assessment.district, level="BLOCK"
    )
    if not blocks_qs.exists():
        _load_blocks(assessment)
        blocks_qs = AdministrativeUnit.objects.filter(
            parent=assessment.district, level="BLOCK"
        )

    if not AdministrativeUnit.objects.filter(parent__in=blocks_qs, level="VILLAGE").exists():
        _seed_villages(blocks_qs)

    villages_qs = AdministrativeUnit.objects.filter(
        parent__in=blocks_qs, level="VILLAGE"
    )
    units = [
        {"id": v.id, "name": v.name, "area_sqkm": v.area_sqkm, "geometry": v.geometry}
        for v in villages_qs
    ]
    return villages_qs, units


def _indicator_configs(assessment, hazard_type=None):
    """Indicator configurations stored on the assessment, falling back to the
    module's default active indicators.

    Unsaved instances (the query-builder preview stub) have no related rows, so
    they go straight to the module defaults.
    """
    configs = []
    if assessment.pk:
        for ind in assessment.indicators.select_related("indicator").all():
            configs.append({"code": ind.indicator.code, "weight": ind.weight, "id": ind.indicator.id})

    if configs:
        return configs

    return _default_indicator_configs(assessment.module_type, hazard_type)


def _save_results(assessment, blocks_qs, scoring_results, classifications, gis_results, indicator_configs):
    """Persist per-unit indicator rows plus the composite summary row."""
    with transaction.atomic():
        AssessmentResult.objects.filter(assessment=assessment).delete()

        for block_id, result in scoring_results.items():
            block_unit = blocks_qs.get(id=block_id)

            for ind_conf in indicator_configs:
                code = ind_conf["code"]
                ind_data = result["indicator_scores"].get(code)
                if ind_data:
                    AssessmentResult.objects.create(
                        assessment=assessment,
                        administrative_unit=block_unit,
                        indicator_id=ind_conf["id"],
                        raw_value=ind_data["raw_value"],
                        normalized_value=ind_data["normalized_value"],
                        weight=ind_data["weight"],
                        weighted_score=ind_data["weighted_score"],
                    )

            comp_score = result["composite_score"]
            cls = classifications.get(block_id, "NH")
            gis_meta = gis_results.get(block_id, {})

            AssessmentResult.objects.create(
                assessment=assessment,
                administrative_unit=block_unit,
                indicator=None,
                final_score=comp_score,
                classification=cls,
                metadata=gis_meta,
            )


class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.select_related("state", "district").prefetch_related("indicators").all()
    filter_backends = [filters.OrderingFilter]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return AssessmentCreateSerializer
        return AssessmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Territorial RBAC (HVRA §2): officers only see their own territory.
        qs = scope_district_qs(qs, self.request.user)
        hazard_type = self.request.query_params.get("hazard_type")
        module_type = self.request.query_params.get("module_type")
        status_filter = self.request.query_params.get("status")
        if hazard_type:
            qs = qs.filter(hazard_type=hazard_type.upper())
        if module_type:
            qs = qs.filter(module_type=module_type.upper())
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return qs

    # ------------------------------------------------------------------
    # RBAC (HVRA §2 / §10): published maps & reports stay public;
    # writes require login; Task Force approvals are admin-only.
    # ------------------------------------------------------------------
    def get_permissions(self):
        if self.action in ("approve", "reject"):
            return [IsPlatformAdmin()]
        # Viewer is read-only (HVRA §2): anything that writes or runs the
        # scoring engine needs a contributing role.
        if self.action in (
            "create", "update", "partial_update", "destroy",
            "process", "submit_for_review", "preview",
        ):
            return [CanContributeData()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        # Territorial RBAC (HVRA §2): STATE/DISTRICT officials may only create
        # assessments inside their assigned territory.
        district = serializer.validated_data.get("district")
        _enforce_territory(self.request, district=district)
        if self.request.user.is_authenticated:
            serializer.save(created_by=self.request.user)
        else:
            serializer.save()

    def _assert_can_modify(self, assessment):
        """Only the creator or a Platform Admin may edit/delete an assessment."""
        user = self.request.user
        if not (user and user.is_authenticated):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Authentication required.")
        if user.is_staff or user.is_superuser:
            return
        profile = getattr(user, "profile", None)
        if profile and profile.is_admin():
            return
        if assessment.created_by_id == user.id:
            return
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied(
            "You can only modify assessments that you created."
        )

    def perform_update(self, serializer):
        self._assert_can_modify(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._assert_can_modify(instance)
        instance.delete()

    # ------------------------------------------------------------------
    # Task Force review workflow (HVRA §8.2)
    # ------------------------------------------------------------------
    def _approval_payload(self, assessment):
        return {
            "id": assessment.id,
            "name": assessment.name,
            "module_type": assessment.module_type,
            "status": assessment.status,
            "approval_status": assessment.approval_status,
            "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
            "reviewer_name": assessment.reviewer_name,
            "reviewer_org": assessment.reviewer_org,
            "review_comment": assessment.review_comment,
            "reviewed_at": assessment.reviewed_at.isoformat() if assessment.reviewed_at else None,
        }

    @action(detail=True, methods=["post"], url_path="submit-for-review")
    def submit_for_review(self, request, pk=None):
        """Move a completed assessment into the DM Task Force review queue."""
        assessment = self.get_object()
        if assessment.status != "COMPLETED":
            return Response(
                {"message": "Only completed assessments can be submitted for review."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if assessment.approval_status in ("APPROVED", "REJECTED"):
            return Response(
                {"message": f"Assessment has already been {assessment.approval_status.lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assessment.approval_status = "SUBMITTED"
        assessment.submitted_at = timezone.now()
        assessment.save(update_fields=["approval_status", "submitted_at"])
        return Response({"message": "Assessment submitted for Task Force review.", "assessment": self._approval_payload(assessment)})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Endorse the assessment (Task Force / admin only)."""
        assessment = self.get_object()
        if assessment.approval_status != "SUBMITTED":
            return Response(
                {"message": "Assessment must be submitted for review before it can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assessment.approval_status = "APPROVED"
        assessment.reviewer_name = request.data.get("reviewer_name") or getattr(request.user, "username", "Task Force")
        assessment.reviewer_org = request.data.get("reviewer_org", "")
        assessment.review_comment = request.data.get("review_comment", "")
        assessment.reviewed_at = timezone.now()
        assessment.save(update_fields=[
            "approval_status", "reviewer_name", "reviewer_org", "review_comment", "reviewed_at",
        ])
        return Response({"message": "Assessment approved.", "assessment": self._approval_payload(assessment)})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Return the assessment to the submitting officer (admin only)."""
        assessment = self.get_object()
        if assessment.approval_status != "SUBMITTED":
            return Response(
                {"message": "Assessment must be submitted for review before it can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assessment.approval_status = "REJECTED"
        assessment.reviewer_name = request.data.get("reviewer_name") or getattr(request.user, "username", "Task Force")
        assessment.reviewer_org = request.data.get("reviewer_org", "")
        assessment.review_comment = request.data.get("review_comment", "Rejected by Task Force review.")
        assessment.reviewed_at = timezone.now()
        assessment.save(update_fields=[
            "approval_status", "reviewer_name", "reviewer_org", "review_comment", "reviewed_at",
        ])
        return Response({"message": "Assessment rejected.", "assessment": self._approval_payload(assessment)})

    # ------------------------------------------------------------------
    # Cross-district dashboard summary (HVRA §3.4 / Phase 3)
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"], url_path="dashboard-summary")
    def dashboard_summary(self, request):
        """Per-district aggregation of completed module assessments."""
        from apps.administration.models import AdministrativeUnit

        module_type = (request.query_params.get("module_type") or "HAZARD").upper()
        hazard_type = request.query_params.get("hazard_type")

        assessments = Assessment.objects.filter(
            status="COMPLETED", module_type=module_type
        ).select_related("district")
        assessments = scope_district_qs(assessments, request.user)
        if hazard_type:
            assessments = assessments.filter(hazard_type=hazard_type.upper())

        districts = AdministrativeUnit.objects.filter(level="DISTRICT").order_by("name")
        # Territorial RBAC (HVRA §2): district officials only compare their district.
        allowed = district_ids_in_territory(territory_profile(request.user))
        if allowed is not None:
            districts = districts.filter(id__in=allowed)
        rows = []
        class_keys = ["NH", "LH", "MH", "HH"]
        for d in districts:
            dist_assessments = [a for a in assessments if a.district_id == d.id]
            if not dist_assessments:
                continue
            summary = {c: 0 for c in class_keys}
            scores = []
            total_results = 0
            for a in dist_assessments:
                results = list(a.results.filter(indicator__isnull=True))
                total_results += len(results)
                for r in results:
                    summary[r.classification] = summary.get(r.classification, 0) + 1
                    if r.final_score is not None:
                        scores.append(r.final_score)
            rows.append({
                "district_id": d.id,
                "district_name": d.name,
                "assessment_count": len(dist_assessments),
                "unit_results": total_results,
                "classification_summary": summary,
                "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
                "max_score": max(scores) if scores else 0,
            })
        rows.sort(key=lambda x: (x["average_score"]), reverse=True)
        return Response({
            "module_type": module_type,
            "hazard_type": hazard_type or "",
            "districts": rows,
        })

    # ------------------------------------------------------------------
    # Processing (Module 1–3)
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        """
        Trigger GIS processing and scoring for this assessment.
        Dispatches on the assessment's module type.
        """
        assessment = self.get_object()

        if assessment.status in ("PROCESSING", "QUEUED", "COMPLETED"):
            return Response(
                {"message": f"Assessment is already {assessment.status.lower()}."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            assessment.status = "PROCESSING"
            assessment.save(update_fields=["status"])

            if assessment.module_type in (
                ModuleTypeChoices.VULNERABILITY, ModuleTypeChoices.EXPOSURE
            ):
                _process_indicator_module(assessment)
            else:
                _process_hazard_module(assessment)
            return Response(_finish(assessment))
        except Exception as e:
            assessment.status = "FAILED"
            assessment.error_message = str(e)
            assessment.save(update_fields=["status", "error_message"])
            return Response(
                {"message": "Processing failed.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


    # ------------------------------------------------------------------
    # Live query preview (spec Screen 1 — "A live preview of block-level
    # composite scores updates as choices are made"). Runs the real
    # weightage → normalization → composite → classification pipeline in
    # memory; nothing is persisted.
    # ------------------------------------------------------------------
    @action(detail=False, methods=["post"], url_path="preview")
    def preview(self, request):
        from apps.administration.models import AdministrativeUnit

        payload = request.data or {}
        module_type = (payload.get("module_type") or ModuleTypeChoices.HAZARD).upper()
        hazard_type = (payload.get("hazard_type") or "FLOOD").upper()
        level = (payload.get("administrative_level") or "BLOCK").upper()
        district_id = payload.get("district")
        if not district_id:
            return Response(
                {"message": "Select an administrative area to preview scores."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        district = AdministrativeUnit.objects.filter(
            id=district_id, level="DISTRICT"
        ).first()
        if district is None:
            return Response(
                {"message": "Unknown district."}, status=status.HTTP_400_BAD_REQUEST
            )
        _enforce_territory(request, district=district)

        indicator_configs = _preview_indicator_configs(payload)

        stub = Assessment(
            name="[PREVIEW] query builder snapshot",
            module_type=module_type,
            hazard_type=hazard_type,
            state=district.parent,
            district=district,
            administrative_level=level,
            classification_method=payload.get("classification_method") or "threshold",
            normalization_method=payload.get("normalization_method") or "min_max",
        )

        if module_type in (ModuleTypeChoices.VULNERABILITY, ModuleTypeChoices.EXPOSURE):
            data = _compute_indicator_module(stub, indicator_configs=indicator_configs)
        else:
            data = _compute_hazard_module(stub, indicator_configs=indicator_configs)

        response = _preview_payload(stub, data)
        response["district"] = district.name
        response["district_id"] = district.id
        response["hazard_type"] = hazard_type
        response["module_type"] = module_type
        response["administrative_level"] = level
        response["indicators"] = [
            {"code": ic["code"], "weight": ic.get("weight", 5.0)} for ic in data["indicator_configs"]
        ]
        return Response(response)

    # ------------------------------------------------------------------
    # Results / Map / Report / Export
    # ------------------------------------------------------------------
    @action(detail=True, methods=["get"])
    def results(self, request, pk=None):
        """Get assessment results (Hazard / Vulnerability / Exposure)."""
        assessment = self.get_object()

        if assessment.status != "COMPLETED":
            return Response(
                {
                    "message": f"Assessment is not yet completed. Status: {assessment.status}",
                    "status": assessment.status,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        composite_results = assessment.results.filter(indicator__isnull=True)
        serializer = AssessmentResultSerializer(composite_results, many=True)

        by_class = {}
        scores = []
        for r in composite_results:
            cls = r.classification or "UNKNOWN"
            by_class[cls] = by_class.get(cls, 0) + 1
            if r.final_score is not None:
                scores.append(r.final_score)

        return Response(
            {
                "assessment": assessment.id,
                "module_type": assessment.module_type,
                "module_label": MODULE_LABELS.get(assessment.module_type, assessment.module_type),
                "status": assessment.status,
                "total_units": composite_results.count(),
                "classification_summary": by_class,
                "min_score": min(scores) if scores else 0,
                "max_score": max(scores) if scores else 0,
                "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
                "results": serializer.data,
            }
        )

    @action(detail=True, methods=["get"])
    def map(self, request, pk=None):
        """Get assessment results as a GeoJSON FeatureCollection with thematic overlays."""
        from apps.hazards.models import HazardLayer, HazardEvent

        assessment = self.get_object()

        if assessment.status != "COMPLETED":
            return Response(
                {"type": "FeatureCollection", "features": [], "status": assessment.status}
            )

        features = []
        composite_results = assessment.results.filter(
            indicator__isnull=True
        ).select_related("administrative_unit")

        classification_colors = {
            "NH": "#22c55e",   # green
            "LH": "#eab308",   # yellow
            "MH": "#f97316",   # orange
            "HH": "#ef4444",   # red
        }

        block_ids = []
        for result in composite_results:
            unit = result.administrative_unit
            block_ids.append(unit.id)
            if unit.geometry_geojson:
                features.append({
                    "type": "Feature",
                    "geometry": unit.geometry,
                    "properties": {
                        "unit_id": unit.id,
                        "unit_name": unit.name,
                        "unit_code": unit.code,
                        "final_score": result.final_score,
                        "classification": result.classification,
                        "color": classification_colors.get(result.classification, "#94a3b8"),
                    },
                })

        # Thematic overlays (shared context for all modules)
        hazard_type = assessment.hazard_type or "FLOOD"
        dist_name = assessment.district.name.replace(" [DEMO]", "").strip()
        hz_layers = HazardLayer.objects.filter(
            hazard_type=hazard_type
        ).filter(name__icontains=dist_name) | HazardLayer.objects.filter(hazard_type=hazard_type)

        hazard_zones = []
        for hl in hz_layers[:3]:
            if hl.geometry_geojson:
                try:
                    g_data = hl.geometry
                    if g_data and g_data.get("type") == "FeatureCollection":
                        hazard_zones.extend(g_data.get("features", []))
                    elif g_data and g_data.get("type") in ("Polygon", "MultiPolygon"):
                        hazard_zones.append({
                            "type": "Feature",
                            "geometry": g_data,
                            "properties": {"name": hl.name, "hazard_type": hl.hazard_type},
                        })
                except Exception:
                    pass

        ev_qs = HazardEvent.objects.filter(
            administrative_unit_id__in=block_ids,
            latitude__isnull=False,
            longitude__isnull=False,
        )
        if not ev_qs.exists():
            ev_qs = HazardEvent.objects.filter(hazard_type=hazard_type, latitude__isnull=False)[:40]

        historical_events = []
        for ev in ev_qs:
            historical_events.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [ev.longitude, ev.latitude]},
                "properties": {
                    "id": ev.id,
                    "date": str(ev.event_date),
                    "magnitude": ev.magnitude,
                    "loss": ev.loss,
                    "description": ev.description or f"Event in {assessment.district.name}",
                    "source": ev.source or "DDMA",
                },
            })

        return Response(
            {
                "type": "FeatureCollection",
                "features": features,
                "classification_colors": classification_colors,
                "classification_labels": CLASSIFICATION_LABELS,
                "thematic_layers": {
                    "hazard_zones": {"type": "FeatureCollection", "features": hazard_zones},
                    "historical_events": {"type": "FeatureCollection", "features": historical_events},
                    "monitoring_stations": {"type": "FeatureCollection", "features": []},
                },
            }
        )

    def _build_report_data(self, assessment):
        """Build structured report dictionary for reporting and file generation."""
        metadata = {
            "name": assessment.name,
            "status": assessment.status,
            "created_at": assessment.created_at.isoformat(),
            "module_type": assessment.module_type,
            "module_label": MODULE_LABELS.get(assessment.module_type, assessment.module_type),
            "hazard_type": assessment.hazard_type or "",
            "state": assessment.state.name if assessment.state else "Kerala",
            "district": assessment.district.name if assessment.district else "All Districts",
            "level": assessment.administrative_level,
            "is_demo": True,
        }

        methodology = []
        for ind in assessment.indicators.select_related("indicator"):
            methodology.append({
                "indicator": ind.indicator.name,
                "weight": ind.weight,
                "code": ind.indicator.code,
            })

        composite_results = assessment.results.filter(indicator__isnull=True).select_related("administrative_unit")
        classification_summary = {"NH": 0, "LH": 0, "MH": 0, "HH": 0}
        block_results = []
        hh_blocks = []
        max_score = -1.0
        max_score_block = None

        for r in composite_results:
            cls = r.classification or "NH"
            classification_summary[cls] = classification_summary.get(cls, 0) + 1
            meta = r.metadata or {}
            block_data = {
                "unit_name": r.administrative_unit.name,
                "composite_score": r.final_score,
                "classification": cls,
                "metadata": meta,
            }
            block_results.append(block_data)
            if cls == "HH":
                hh_blocks.append(r.administrative_unit.name)
            if r.final_score is not None and r.final_score > max_score:
                max_score = r.final_score
                max_score_block = r.administrative_unit.name

        block_results.sort(key=lambda x: (x["composite_score"] or -1), reverse=True)

        # Module-specific narrative fragments
        is_hazard = assessment.module_type == "HAZARD"
        indicator_noun = "hazard-prone" if is_hazard else "indicator"
        observed_classes = {cls for cls, cnt in classification_summary.items() if cnt and cnt > 0}
        recommendations = self._build_recommendations(
            assessment, hh_blocks, observed_classes=observed_classes
        )

        module = assessment.module_type
        if module == "VULNERABILITY":
            class_labels = {"NH": "No Vulnerability", "LH": "Low Vulnerability", "MH": "Medium Vulnerability", "HH": "High Vulnerability"}
        elif module == "EXPOSURE":
            class_labels = {"NH": "No Exposure", "LH": "Low Exposure", "MH": "Medium Exposure", "HH": "High Exposure"}
        else:
            class_labels = {"NH": "No Hazard", "LH": "Low Hazard", "MH": "Medium Hazard", "HH": "High Hazard"}

        # Climate Context Library (HVRA §4.9) — curated, sourced statements.
        from apps.hazards.models import ClimateContext

        climate_qs = ClimateContext.objects.filter(is_active=True)
        climate_qs = climate_qs.filter(
            Q(hazard_type=assessment.hazard_type or "") | Q(hazard_type="")
        )
        if assessment.district_id:
            climate_qs = climate_qs.filter(
                Q(region_id=assessment.district_id) | Q(region__isnull=True)
            )
        climate_entries = [
            {
                "title": c.title,
                "statement": c.statement,
                "source": c.source,
                "source_url": c.source_url,
                "vintage": c.vintage,
                "is_demo": c.is_demo,
            }
            for c in climate_qs.order_by("display_order")[:3]
        ]
        if not climate_entries:
            climate_entries = [{
                "title": "Climate context (prototype)",
                "statement": (
                    f"Climate context for {metadata['district']} relevant to "
                    f"{assessment.hazard_type or 'the assessed hazard'} is maintained in the "
                    "platform's Climate Context Library. No curated entry is seeded yet — "
                    "this is DEMO DATA and must not be treated as an official assessment."
                ),
                "source": "Climate Context Library",
                "source_url": "",
                "vintage": "",
                "is_demo": True,
            }]

        return {
            "metadata": metadata,
            "methodology": methodology,
            "historical_profile": {
                "narrative": (
                    f"Historical {assessment.hazard_type or 'hazard'} events in the assessment "
                    f"extent are catalogued in the platform's event repository. "
                    "All prototype event data is DEMO DATA."
                )
            },
            "climate_context": climate_entries,
            "classification_summary": classification_summary,
            "class_labels": class_labels,
            "findings": {
                "hh_blocks": hh_blocks,
                "max_score": max_score,
                "max_score_block": max_score_block,
            },
            "recommendations": recommendations,
            "block_results": block_results,
            "indicator_noun": indicator_noun,
        }

    def _build_recommendations(self, assessment, hh_blocks, observed_classes=None):
        """Recommendations Library (HVRA §4.9).

        Curated, prioritised recommendations are pulled from the library and
        filtered by module + hazard + observed severity classes. Class-specific
        entries are only included when that class was actually observed. Falls
        back to the previous typed builder when the library is empty.
        """
        from apps.hazards.models import Recommendation

        module = assessment.module_type
        hazard_type = assessment.hazard_type or ""
        observed = observed_classes or set()

        qs = Recommendation.objects.filter(module_type=module, is_active=True)
        if hazard_type:
            qs = qs.filter(Q(hazard_type=hazard_type) | Q(hazard_type=""))

        class_rank = {"HH": 0, "MH": 1, "LH": 2, "NH": 3,
                      "VERY_HIGH": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        prio_rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}

        candidates = []
        for rec in qs:
            if rec.classification and rec.classification not in observed:
                continue
            candidates.append((
                class_rank.get(rec.classification, -1),
                prio_rank.get(rec.priority, 1),
                rec.display_order,
                rec.text,
            ))
        candidates.sort()

        picks = [text for _, _, _, text in candidates[:6]]
        if picks:
            return picks

        # Fallback: legacy typed builder (library not populated yet)
        if module == "VULNERABILITY":
            return [
                "Target social protection schemes to units with high BPL household and dependent-population shares.",
                "Expand early-warning dissemination and DM plan coverage in the most vulnerable blocks.",
                "Upgrade kutcha/semi-permanent housing stock through resilient-housing assistance programmes.",
            ]
        if module == "EXPOSURE":
            return [
                "Prioritise retrofitting and relocation of critical facilities located inside the hazard zone.",
                "Regulate new settlement and agricultural land use inside high-exposure areas.",
                "Harden lifeline networks (roads, bridges, utilities) intersecting the hazard zone.",
            ]
        return [
            "Implement strict zoning and development regulation in High Hazard (HH) blocks.",
            "Deploy real-time hydrometeorological sensor telemetry in Moderate Hazard (MH) units.",
            "Institutionalize community early warning dissemination frameworks.",
            "Reinforce vulnerable drainage corridors and flood alleviation infrastructure.",
        ]

    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        """Generate and return structured assessment report data as JSON."""
        assessment = self.get_object()
        if assessment.status != "COMPLETED":
            return Response(
                {"message": f"Assessment is not completed. Status: {assessment.status}"},
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(self._build_report_data(assessment))

    @action(detail=True, methods=["get"], url_path="export/docx")
    def export_docx(self, request, pk=None):
        assessment = self.get_object()
        report_data = self._build_report_data(assessment)
        bio = generate_assessment_docx(assessment, report_data)
        safe_name = assessment.name.replace(" ", "_").replace("/", "-")
        response = HttpResponse(
            bio.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        response["Content-Disposition"] = f'attachment; filename="HVRA_{assessment.module_type}_Report_{safe_name}.docx"'
        return response

    @action(detail=True, methods=["get"], url_path="export/pdf")
    def export_pdf(self, request, pk=None):
        assessment = self.get_object()
        report_data = self._build_report_data(assessment)
        bio = generate_assessment_pdf(assessment, report_data)
        safe_name = assessment.name.replace(" ", "_").replace("/", "-")
        response = HttpResponse(bio.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="HVRA_{assessment.module_type}_Report_{safe_name}.pdf"'
        return response

    @action(detail=True, methods=["get"], url_path="export/csv")
    def export_csv(self, request, pk=None):
        assessment = self.get_object()
        report_data = self._build_report_data(assessment)
        csv_content = generate_assessment_csv(assessment, report_data)
        safe_name = assessment.name.replace(" ", "_").replace("/", "-")
        response = HttpResponse(csv_content, content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="HVRA_{assessment.module_type}_Results_{safe_name}.csv"'
        return response

    @action(detail=True, methods=["get"])
    def indicator_results(self, request, pk=None):
        """Get per-indicator results for all units."""
        assessment = self.get_object()
        results = assessment.results.filter(
            indicator__isnull=False
        ).select_related("administrative_unit", "indicator")
        serializer = AssessmentResultSerializer(results, many=True)
        return Response(serializer.data)

def _finish(assessment):
    """Mark the assessment completed and return the success payload."""
    assessment.status = "COMPLETED"
    assessment.completed_at = timezone.now()
    assessment.save(update_fields=["status", "completed_at"])
    return {
        "message": "Assessment processing completed successfully.",
        "assessment_id": assessment.id,
        "status": assessment.status,
    }


def _compute_hazard_module(assessment, indicator_configs=None):
    """Module 1 — Hazard: spatial overlay + weightage + scoring.

    Pure in-memory computation (nothing is written) so the query builder can
    reuse it for the live composite-score snapshot (Screen 1).
    """
    from apps.hazards.models import HazardLayer, HazardEvent
    from gis.spatial import process_flood_assessment
    from scoring.scoring import compute_assessment_scores
    from scoring.classification import classify_batch

    blocks_qs, blocks = _load_units(assessment)

    hazard_type = assessment.hazard_type or "FLOOD"
    flood_layers_qs = HazardLayer.objects.filter(hazard_type=hazard_type, geometry_type="POLYGON")
    flood_layers = [{"geometry": fl.geometry} for fl in flood_layers_qs if fl.geometry]

    events_qs = HazardEvent.objects.filter(
        hazard_type=hazard_type, latitude__isnull=False, longitude__isnull=False
    )
    events = [
        {"id": ev.id, "latitude": ev.latitude, "longitude": ev.longitude,
         "event_date": ev.event_date}
        for ev in events_qs
    ]

    # Linear-feature hazards (fault lines, cyclone tracks — HVRA §4.3) are
    # assessed with a buffered proximity pipeline instead of polygon overlay.
    line_layers_qs = HazardLayer.objects.filter(
        hazard_type=hazard_type, geometry_type="LINE"
    )
    if line_layers_qs.exists():
        from gis.spatial import process_linear_hazard_assessment

        line_layers = [{"geometry": fl.geometry} for fl in line_layers_qs if fl.geometry]
        gis_results = process_linear_hazard_assessment(blocks, line_layers, events)
    else:
        gis_results = process_flood_assessment(blocks, flood_layers, events)

    # Ensure every block has realistic, differentiated demo values
    for b_id, gdata in gis_results.items():
        pct_key = "flood_prone_percentage" if gdata.get("flood_prone_percentage", 0.0) else "hazard_prone_percentage"
        if gdata.get(pct_key, 0.0) == 0.0:
            seed_val = (b_id * 19 + len(hazard_type) * 7) % 85 + 10
            gdata[pct_key] = float(seed_val)
            total_a = float(gdata.get("total_area_sqkm") or 120.0)
            gdata["total_area_sqkm"] = total_a
            gdata["hazard_prone_area_sqkm"] = round(total_a * (seed_val / 100.0), 2)
            gdata["flood_prone_percentage"] = float(seed_val)
            gdata["flood_prone_area_sqkm"] = gdata["hazard_prone_area_sqkm"]
        if gdata.get("event_count", 0) == 0:
            seed_ev = (b_id * 11 + 3) % 11 + 1
            gdata["event_count"] = seed_ev
            gdata["event_frequency"] = round(seed_ev / 10.0, 2)

    configs = indicator_configs or _indicator_configs(assessment, hazard_type=hazard_type)
    scoring_results = compute_assessment_scores(
        gis_results=gis_results,
        indicator_configs=configs,
        normalization_method=assessment.normalization_method,
    )
    classifications = classify_batch(
        {bid: res["composite_score"] for bid, res in scoring_results.items()},
        method=assessment.classification_method,
    )
    return {
        "units_qs": blocks_qs,
        "scoring_results": scoring_results,
        "classifications": classifications,
        "gis_results": gis_results,
        "indicator_configs": configs,
    }


def _process_hazard_module(assessment):
    """Module 1 — persist the computed hazard results."""
    data = _compute_hazard_module(assessment)
    _save_results(
        assessment,
        data["units_qs"],
        data["scoring_results"],
        data["classifications"],
        data["gis_results"],
        data["indicator_configs"],
    )
    return _finish(assessment)


def _preview_payload(assessment, data):
    """Shape a compute result for the query-builder live preview (Screen 1)."""
    from scoring.classification import CLASSIFICATION_LABELS, get_classification_summary

    names = {u.id: u.name for u in data["units_qs"]}
    units = []
    for unit_id, res in data["scoring_results"].items():
        cls = data["classifications"].get(unit_id, "NH")
        units.append({
            "id": unit_id,
            "name": names.get(unit_id, f"Unit {unit_id}"),
            "score": res.get("composite_score", 0.0),
            "classification": cls,
            "classification_label": CLASSIFICATION_LABELS.get(cls, cls),
        })
    units.sort(key=lambda u: (-u["score"], u["name"]))
    return {
        "units": units,
        "unit_count": len(units),
        "classification_summary": get_classification_summary(data["classifications"]),
        "indicator_count": len(data["indicator_configs"]),
    }


def _compute_indicator_module(assessment, indicator_configs=None):
    """
    Modules 2 & 3 — Vulnerability / Exposure, in-memory.

    Runs the same weightage → normalization → composite → classification
    pipeline as Hazard, over demo indicator values (prototype builds use
    seeded demo data — clearly labelled) so the full workflow is usable
    end-to-end without live Census/SECC feeds.
    """
    from scoring.demo_data import generate_demo_gis_result
    from scoring.scoring import compute_assessment_scores
    from scoring.classification import classify_batch

    blocks_qs, blocks = _load_units(assessment)

    configs = indicator_configs or _indicator_configs(assessment)
    codes = [ic["code"] for ic in configs]

    gis_results = generate_demo_gis_result(blocks, codes, assessment.module_type)

    scoring_results = compute_assessment_scores(
        gis_results=gis_results,
        indicator_configs=configs,
        normalization_method=assessment.normalization_method,
    )
    classifications = classify_batch(
        {bid: res["composite_score"] for bid, res in scoring_results.items()},
        method=assessment.classification_method,
    )
    return {
        "units_qs": blocks_qs,
        "scoring_results": scoring_results,
        "classifications": classifications,
        "gis_results": gis_results,
        "indicator_configs": configs,
    }


def _default_indicator_configs(module_type, hazard_type=None):
    """Default active indicator configs for a module (used when a preview
    request sends no indicators, and for unsaved assessment stubs)."""
    from apps.hazards.models import HazardIndicator

    qs = HazardIndicator.objects.filter(module_type=module_type, is_active=True)
    if hazard_type:
        qs = qs.filter(hazard_type=hazard_type)
    return [
        {"code": ind.code, "weight": ind.default_weight or 5.0, "id": ind.id}
        for ind in qs.order_by("module_type", "order", "name")
    ]


def _preview_indicator_configs(payload):
    """Indicator configs from the query builder payload.

    Accepts `indicators: [{code, weight}, ...]`. Unknown codes are ignored so a
    stale browser tab cannot break the snapshot.
    """
    from apps.hazards.models import HazardIndicator

    raw = payload.get("indicators") or []
    if isinstance(raw, dict):
        raw = [{"code": k, "weight": v} for k, v in raw.items()]
    configs = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        code = (item.get("code") or "").strip()
        if not code:
            continue
        try:
            weight = float(item.get("weight", 5.0))
        except (TypeError, ValueError):
            weight = 5.0
        configs.append({"code": code, "weight": max(0.0, min(10.0, weight))})
    if configs:
        known = set(
            HazardIndicator.objects.filter(
                code__in=[c["code"] for c in configs], is_active=True
            ).values_list("code", flat=True)
        )
        configs = [c for c in configs if c["code"] in known]
    return configs


def _process_indicator_module(assessment):
    """Modules 2 & 3 — persist the computed results."""
    data = _compute_indicator_module(assessment)
    _save_results(
        assessment,
        data["units_qs"],
        data["scoring_results"],
        data["classifications"],
        data["gis_results"],
        data["indicator_configs"],
    )
    return _finish(assessment)



# ---------------------------------------------------------------------------
# Module 4 — Composite Risk (Risk = H × V × E)
# ---------------------------------------------------------------------------
class RiskAssessmentViewSet(viewsets.ModelViewSet):
    queryset = RiskAssessment.objects.select_related(
        "state", "district", "hazard_assessment", "vulnerability_assessment", "exposure_assessment"
    ).all()
    filter_backends = [filters.OrderingFilter]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return RiskAssessmentCreateSerializer
        return RiskAssessmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Territorial RBAC (HVRA §2)
        qs = scope_district_qs(qs, self.request.user)
        status_filter = self.request.query_params.get("status")
        district = self.request.query_params.get("district")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        if district:
            qs = qs.filter(district_id=district)
        return qs

    # ------------------------------------------------------------------
    # RBAC: published maps/reports stay public; writes require login;
    # Task Force approvals are admin-only.
    # ------------------------------------------------------------------
    def get_permissions(self):
        if self.action in ("approve", "reject"):
            return [IsPlatformAdmin()]
        if self.action in (
            "create", "update", "partial_update", "destroy",
            "process", "submit_for_review",
        ):
            return [CanContributeData()]
        return [permissions.AllowAny()]

    # Only the creator or a Platform Admin may edit/delete a risk assessment.
    _assert_can_modify = AssessmentViewSet._assert_can_modify
    perform_update = AssessmentViewSet.perform_update
    perform_destroy = AssessmentViewSet.perform_destroy

    # ------------------------------------------------------------------
    # Task Force review workflow (HVRA §8.2)
    # ------------------------------------------------------------------
    def _approval_payload(self, risk):
        return {
            "id": risk.id,
            "name": risk.name,
            "module_type": "COMPOSITE_RISK",
            "status": risk.status,
            "approval_status": risk.approval_status,
            "submitted_at": risk.submitted_at.isoformat() if risk.submitted_at else None,
            "reviewer_name": risk.reviewer_name,
            "reviewer_org": risk.reviewer_org,
            "review_comment": risk.review_comment,
            "reviewed_at": risk.reviewed_at.isoformat() if risk.reviewed_at else None,
        }

    @action(detail=True, methods=["post"], url_path="submit-for-review")
    def submit_for_review(self, request, pk=None):
        risk = self.get_object()
        if risk.status != "COMPLETED":
            return Response(
                {"message": "Only completed risk assessments can be submitted for review."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if risk.approval_status in ("APPROVED", "REJECTED"):
            return Response(
                {"message": f"Risk assessment has already been {risk.approval_status.lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        risk.approval_status = "SUBMITTED"
        risk.submitted_at = timezone.now()
        risk.save(update_fields=["approval_status", "submitted_at"])
        return Response({"message": "Risk assessment submitted for Task Force review.", "risk_assessment": self._approval_payload(risk)})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        risk = self.get_object()
        if risk.approval_status != "SUBMITTED":
            return Response(
                {"message": "Risk assessment must be submitted for review before it can be approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        risk.approval_status = "APPROVED"
        risk.reviewer_name = request.data.get("reviewer_name") or getattr(request.user, "username", "Task Force")
        risk.reviewer_org = request.data.get("reviewer_org", "")
        risk.review_comment = request.data.get("review_comment", "")
        risk.reviewed_at = timezone.now()
        risk.save(update_fields=[
            "approval_status", "reviewer_name", "reviewer_org", "review_comment", "reviewed_at",
        ])
        return Response({"message": "Risk assessment approved.", "risk_assessment": self._approval_payload(risk)})

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        risk = self.get_object()
        if risk.approval_status != "SUBMITTED":
            return Response(
                {"message": "Risk assessment must be submitted for review before it can be rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        risk.approval_status = "REJECTED"
        risk.reviewer_name = request.data.get("reviewer_name") or getattr(request.user, "username", "Task Force")
        risk.reviewer_org = request.data.get("reviewer_org", "")
        risk.review_comment = request.data.get("review_comment", "Rejected by Task Force review.")
        risk.reviewed_at = timezone.now()
        risk.save(update_fields=[
            "approval_status", "reviewer_name", "reviewer_org", "review_comment", "reviewed_at",
        ])
        return Response({"message": "Risk assessment rejected.", "risk_assessment": self._approval_payload(risk)})

    # ------------------------------------------------------------------
    # Cross-district dashboard summary (HVRA §3.4 / Phase 3)
    # ------------------------------------------------------------------
    @action(detail=False, methods=["get"], url_path="dashboard-summary")
    def dashboard_summary(self, request):
        """Per-district aggregation of completed composite risk assessments."""
        from apps.administration.models import AdministrativeUnit

        risks = RiskAssessment.objects.filter(status="COMPLETED").select_related("district")
        districts = AdministrativeUnit.objects.filter(level="DISTRICT").order_by("name")
        class_keys = ["VERY_HIGH", "HIGH", "MODERATE", "LOW"]
        rows = []
        for d in districts:
            dist_risks = [r for r in risks if r.district_id == d.id]
            if not dist_risks:
                continue
            summary = {c: 0 for c in class_keys}
            scores = []
            for r in dist_risks:
                for res in r.results.all():
                    summary[res.risk_class] = summary.get(res.risk_class, 0) + 1
                    if res.risk_score is not None:
                        scores.append(res.risk_score)
            rows.append({
                "district_id": d.id,
                "district_name": d.name,
                "assessment_count": len(dist_risks),
                "classification_summary": summary,
                "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
                "max_score": max(scores) if scores else 0,
            })
        rows.sort(key=lambda x: (x["average_score"]), reverse=True)
        return Response({"module_type": "COMPOSITE_RISK", "districts": rows})

    def create(self, request, *args, **kwargs):
        """Create + immediately process (synchronous prototype flow)."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Territorial RBAC (HVRA §2): the district (or any linked module
        # assessment's district) must lie within the creator's territory.
        _enforce_territory(
            request,
            district=serializer.validated_data.get("district"),
            linked_assessments=[
                serializer.validated_data.get(k) for k in (
                    "hazard_assessment", "vulnerability_assessment", "exposure_assessment"
                ) if serializer.validated_data.get(k)
            ],
        )
        if request.user.is_authenticated:
            risk = serializer.save(created_by=request.user)
        else:
            risk = serializer.save()
        outcome = self._process(risk)
        return Response(
            {
                "risk_assessment": RiskAssessmentSerializer(risk, context=self.get_serializer_context()).data,
                "processing": outcome.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def _process(self, risk):
        """Run the risk engine over the linked module assessments."""
        from scoring.risk import compute_risk_scores

        if risk.status == "COMPLETED":
            return Response(
                {"message": "Risk assessment is already completed."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            # Collect per-unit composite scores from each module assessment.
            unit_scores = {}

            def collect(assessment, component):
                if assessment is None:
                    return
                rows = assessment.results.filter(
                    indicator__isnull=True
                ).select_related("administrative_unit")
                for row in rows:
                    unit_id = row.administrative_unit_id
                    unit_scores.setdefault(unit_id, {})[component] = row.final_score

            collect(risk.hazard_assessment, "hazard")
            collect(risk.vulnerability_assessment, "vulnerability")
            collect(risk.exposure_assessment, "exposure")

            weights = {
                "hazard": risk.hazard_weight,
                "vulnerability": risk.vulnerability_weight,
                "exposure": risk.exposure_weight,
            }

            risk_results = compute_risk_scores(unit_scores, weights, formula=risk.formula)

            with transaction.atomic():
                RiskResult.objects.filter(risk_assessment=risk).delete()
                for unit_id, data in risk_results.items():
                    RiskResult.objects.create(
                        risk_assessment=risk,
                        administrative_unit_id=unit_id,
                        hazard_score=data.get("hazard_score"),
                        vulnerability_score=data.get("vulnerability_score"),
                        exposure_score=data.get("exposure_score"),
                        risk_score=data["risk_score"],
                        risk_class=data["risk_class"],
                        metadata={
                            "components_used": [c for c in ("hazard", "vulnerability", "exposure")
                                                if data.get(f"{c}_score") is not None],
                            "formula": risk.formula,
                            "weights": weights,
                            "demo_data": True,
                        },
                    )

            risk.status = "COMPLETED"
            risk.completed_at = timezone.now()
            risk.save(update_fields=["status", "completed_at"])

            return Response({
                "message": "Risk assessment completed successfully.",
                "risk_assessment_id": risk.id,
                "status": risk.status,
            })
        except Exception as e:
            risk.status = "FAILED"
            risk.error_message = str(e)
            risk.save(update_fields=["status", "error_message"])
            return Response(
                {"message": "Risk processing failed.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        return self._process(self.get_object())

    @action(detail=True, methods=["get"])
    def results(self, request, pk=None):
        """Per-unit risk results + summary statistics."""
        risk = self.get_object()
        if risk.status != "COMPLETED":
            return Response(
                {"message": f"Risk assessment is not completed. Status: {risk.status}"},
                status=status.HTTP_202_ACCEPTED,
            )

        qs = risk.results.select_related("administrative_unit")
        serializer = RiskResultSerializer(qs, many=True)

        by_class = {}
        scores = []
        for r in qs:
            by_class[r.risk_class] = by_class.get(r.risk_class, 0) + 1
            if r.risk_score is not None:
                scores.append(r.risk_score)

        return Response(
            {
                "risk_assessment": risk.id,
                "name": risk.name,
                "module_type": "COMPOSITE_RISK",
                "module_label": MODULE_LABELS["COMPOSITE_RISK"],
                "formula": risk.formula,
                "weights": {
                    "hazard": risk.hazard_weight,
                    "vulnerability": risk.vulnerability_weight,
                    "exposure": risk.exposure_weight,
                },
                "status": risk.status,
                "total_units": qs.count(),
                "classification_summary": by_class,
                "risk_class_colors": {
                    "VERY_HIGH": "#7f1d1d", "HIGH": "#ef4444",
                    "MODERATE": "#f59e0b", "LOW": "#22c55e",
                },
                "risk_class_labels": RISK_CLASS_LABELS,
                "min_score": min(scores) if scores else 0,
                "max_score": max(scores) if scores else 0,
                "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
                "results": serializer.data,
            }
        )

    @action(detail=True, methods=["get"])
    def map(self, request, pk=None):
        """Risk results as a GeoJSON FeatureCollection coloured by risk class."""
        from scoring.risk import RISK_CLASS_COLORS

        risk = self.get_object()
        if risk.status != "COMPLETED":
            return Response({"type": "FeatureCollection", "features": [], "status": risk.status})

        features = []
        rows = risk.results.select_related("administrative_unit")
        for r in rows:
            unit = r.administrative_unit
            if not unit.geometry_geojson:
                continue
            features.append({
                "type": "Feature",
                "geometry": unit.geometry,
                "properties": {
                    "unit_id": unit.id,
                    "unit_name": unit.name,
                    "unit_code": unit.code,
                    "risk_score": r.risk_score,
                    "hazard_score": r.hazard_score,
                    "vulnerability_score": r.vulnerability_score,
                    "exposure_score": r.exposure_score,
                    "classification": r.risk_class,
                    "color": RISK_CLASS_COLORS.get(r.risk_class, "#94a3b8"),
                },
            })

        return Response(
            {
                "type": "FeatureCollection",
                "features": features,
                "classification_colors": RISK_CLASS_COLORS,
                "classification_labels": RISK_CLASS_LABELS,
                "risk_mode": True,
                "thematic_layers": {
                    "hazard_zones": {"type": "FeatureCollection", "features": []},
                    "historical_events": {"type": "FeatureCollection", "features": []},
                    "monitoring_stations": {"type": "FeatureCollection", "features": []},
                },
            }
        )

    def _build_report_data(self, risk):
        """Structured risk report payload."""
        comp_scores = risk.results.select_related("administrative_unit")
        classification_summary = {c: 0 for c in RISK_CLASS_LABELS}
        block_results = []
        very_high = []
        for r in comp_scores:
            classification_summary[r.risk_class] = classification_summary.get(r.risk_class, 0) + 1
            block_results.append({
                "unit_name": r.administrative_unit.name,
                "hazard_score": r.hazard_score,
                "vulnerability_score": r.vulnerability_score,
                "exposure_score": r.exposure_score,
                "risk_score": r.risk_score,
                "risk_class": r.risk_class,
            })
            if r.risk_class == "VERY_HIGH":
                very_high.append(r.administrative_unit.name)
        block_results.sort(key=lambda x: (x["risk_score"] or -1), reverse=True)

        # Recommendations Library (HVRA §4.9) — module 4 entries + generic.
        from apps.hazards.models import Recommendation

        observed = {cls for cls, cnt in classification_summary.items() if cnt and cnt > 0}
        class_rank = {"VERY_HIGH": 0, "HIGH": 1, "MODERATE": 2, "LOW": 3}
        prio_rank = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
        candidates = []
        for rec in Recommendation.objects.filter(
            module_type="COMPOSITE_RISK", is_active=True
        ).order_by("display_order"):
            if rec.classification and rec.classification not in observed:
                continue
            candidates.append((
                class_rank.get(rec.classification, -1),
                prio_rank.get(rec.priority, 1),
                rec.display_order,
                rec.text,
            ))
        candidates.sort()
        recommendations = [text for _, _, _, text in candidates[:6]]
        if not recommendations:
            recommendations = [
                "Prioritise structural and non-structural risk-reduction investment in Very High Risk units.",
                "Include High Risk units in the next District Disaster Management Plan cycle.",
                "Monitor Moderate Risk units and review annually.",
                "Maintain routine monitoring for Low Risk units.",
                "Update inputs as new Hazard, Vulnerability and Exposure assessments are published.",
            ]

        # Climate Context Library (HVRA §4.9).
        from apps.hazards.models import ClimateContext

        hazard_type = (risk.hazard_assessment.hazard_type
                       if risk.hazard_assessment else "")
        climate_qs = ClimateContext.objects.filter(is_active=True).filter(
            Q(hazard_type=hazard_type) | Q(hazard_type="")
        )
        if risk.district_id:
            climate_qs = climate_qs.filter(
                Q(region_id=risk.district_id) | Q(region__isnull=True)
            )
        climate_entries = [
            {
                "title": c.title,
                "statement": c.statement,
                "source": c.source,
                "source_url": c.source_url,
                "vintage": c.vintage,
                "is_demo": c.is_demo,
            }
            for c in climate_qs.order_by("display_order")[:3]
        ]
        if not climate_entries:
            climate_entries = [{
                "title": "Climate context (prototype)",
                "statement": (
                    "Composite risk combines hazard, vulnerability and exposure "
                    "components. Climate context for the contributing hazard "
                    "(e.g. flood, cyclone) is maintained in the platform's Climate "
                    "Context Library — this is DEMO DATA."
                ),
                "source": "Climate Context Library",
                "source_url": "",
                "vintage": "",
                "is_demo": True,
            }]

        return {
            "metadata": {
                "name": risk.name,
                "status": risk.status,
                "created_at": risk.created_at.isoformat(),
                "module_type": "COMPOSITE_RISK",
                "module_label": MODULE_LABELS["COMPOSITE_RISK"],
                "state": risk.state.name if risk.state else "Kerala",
                "district": risk.district.name if risk.district else "District",
                "level": risk.administrative_level,
                "formula": risk.formula,
                "weights": {
                    "hazard": risk.hazard_weight,
                    "vulnerability": risk.vulnerability_weight,
                    "exposure": risk.exposure_weight,
                },
                "inputs": {
                    "hazard_assessment": risk.hazard_assessment.name if risk.hazard_assessment else None,
                    "vulnerability_assessment": risk.vulnerability_assessment.name if risk.vulnerability_assessment else None,
                    "exposure_assessment": risk.exposure_assessment.name if risk.exposure_assessment else None,
                },
                "is_demo": True,
            },
            "classification_summary": classification_summary,
            "risk_class_labels": RISK_CLASS_LABELS,
            "climate_context": climate_entries,
            "findings": {
                "very_high_units": very_high,
                "top_units": block_results[:5],
            },
            "recommendations": recommendations,
            "block_results": block_results,
        }

    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        risk = self.get_object()
        if risk.status != "COMPLETED":
            return Response(
                {"message": f"Risk assessment is not completed. Status: {risk.status}"},
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(self._build_report_data(risk))

    @action(detail=True, methods=["get"], url_path="export/docx")
    def export_docx(self, request, pk=None):
        risk = self.get_object()
        report_data = self._build_report_data(risk)
        bio = generate_risk_report_docx(risk, report_data)
        safe_name = risk.name.replace(" ", "_").replace("/", "-")
        response = HttpResponse(
            bio.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        response["Content-Disposition"] = f'attachment; filename="HVRA_Risk_Report_{safe_name}.docx"'
        return response

    @action(detail=True, methods=["get"], url_path="export/pdf")
    def export_pdf(self, request, pk=None):
        risk = self.get_object()
        report_data = self._build_report_data(risk)
        bio = generate_risk_report_pdf(risk, report_data)
        safe_name = risk.name.replace(" ", "_").replace("/", "-")
        response = HttpResponse(bio.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="HVRA_Risk_Report_{safe_name}.pdf"'
        return response


# ---------------------------------------------------------------------------
# Saved / shareable queries (HVRA §3.3 — query layer)
# ---------------------------------------------------------------------------
class SavedQueryViewSet(viewsets.ModelViewSet):
    """
    CRUD for the current user's saved queries, plus share + re-run actions.

      GET  /api/saved-queries/              → own queries (public ones included)
      POST /api/saved-queries/              → create (auth required)
      GET  /api/saved-queries/{id}/         → own or shared query
      DELETE /api/saved-queries/{id}/       → own query (admins may delete any)
      POST /api/saved-queries/{id}/share/   → generate public share link
      POST /api/saved-queries/{id}/run/     → re-run the query as a new assessment
    """
    queryset = SavedQuery.objects.select_related("state", "district", "created_by").all()
    serializer_class = SavedQuerySerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "share", "run"):
            return [CanContributeData()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated:
            qs = qs.filter(
                Q(created_by=self.request.user) | Q(is_shared=True)
            )
        else:
            qs = qs.filter(is_shared=True)
        # Territorial RBAC (HVRA §2)
        qs = scope_district_qs(qs, self.request.user)
        module_type = self.request.query_params.get("module_type")
        if module_type:
            qs = qs.filter(module_type=module_type.upper())
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def share(self, request, pk=None):
        """Enable the public share link (idempotent share_token)."""
        query = self.get_object()
        if query.created_by_id and query.created_by_id != request.user.id and not request.user.is_staff:
            return Response(
                {"message": "You can only share your own saved queries."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not query.share_token:
            query.share_token = secrets.token_urlsafe(16)
        query.is_shared = True
        query.save(update_fields=["share_token", "is_shared"])
        return Response({
            "message": "Query shared.",
            "saved_query": SavedQuerySerializer(query, context=self.get_serializer_context()).data,
        })

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        """Re-run the saved query — creates a fresh assessment/risk assessment
        from the stored parameters and processes it synchronously."""
        query = self.get_object()
        params = query.parameters or {}
        district_id = query.district_id
        state_id = query.state_id
        level = query.administrative_level or "BLOCK"

        if query.module_type == QueryModuleChoices.COMPOSITE_RISK:
            # A saved query must not become a territory bypass (HVRA §2).
            _enforce_territory(request, district=query.district)
            payload = {
                "name": params.get("name") or f"{query.name} (saved query run)",
                "description": params.get("description") or query.description,
                "state": state_id,
                "district": district_id,
                "administrative_level": level,
                "hazard_assessment": params.get("hazard_assessment"),
                "vulnerability_assessment": params.get("vulnerability_assessment"),
                "exposure_assessment": params.get("exposure_assessment"),
                "formula": params.get("formula", "geometric"),
                "hazard_weight": params.get("hazard_weight", 1.0),
                "vulnerability_weight": params.get("vulnerability_weight", 1.0),
                "exposure_weight": params.get("exposure_weight", 1.0),
            }
            serializer = RiskAssessmentCreateSerializer(data=payload)
            serializer.is_valid(raise_exception=True)
            risk = serializer.save(created_by=request.user)
            outcome = self._run_risk(risk)
            return Response({
                "message": "Saved query re-run completed.",
                "risk_assessment": RiskAssessmentSerializer(risk).data,
                "processing": outcome,
            }, status=status.HTTP_201_CREATED)

        payload = {
            "name": params.get("name") or f"{query.name} (saved query run)",
            "description": params.get("description") or query.description,
            "module_type": query.module_type,
            "hazard_type": query.hazard_type or "",
            "state": state_id,
            "district": district_id,
            "administrative_level": level,
            "start_date": params.get("start_date"),
            "end_date": params.get("end_date"),
            "data_source": params.get("data_source"),
            "normalization_method": params.get("normalization_method", "min_max"),
            "classification_method": params.get("classification_method", "threshold"),
            "indicators": params.get("indicators", []),
        }
        # Same territory guard as a direct create.
        _enforce_territory(request, district=query.district)
        serializer = AssessmentCreateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        assessment = serializer.save(created_by=request.user)
        outcome = self._run_assessment(assessment)
        return Response({
            "message": "Saved query re-run completed.",
            "assessment": AssessmentSerializer(assessment).data,
            "processing": outcome,
        }, status=status.HTTP_201_CREATED)

    def _run_assessment(self, assessment):
        """Replicate AssessmentViewSet.process dispatch for the new assessment."""
        try:
            assessment.status = "PROCESSING"
            assessment.save(update_fields=["status"])
            if assessment.module_type in (
                ModuleTypeChoices.VULNERABILITY, ModuleTypeChoices.EXPOSURE
            ):
                _process_indicator_module(assessment)
            else:
                _process_hazard_module(assessment)
            return _finish(assessment)
        except Exception as e:
            assessment.status = "FAILED"
            assessment.error_message = str(e)
            assessment.save(update_fields=["status", "error_message"])
            return {"message": "Processing failed.", "error": str(e)}

    def _run_risk(self, risk):
        try:
            from scoring.risk import compute_risk_scores

            unit_scores = {}

            def collect(assessment, component):
                if assessment is None:
                    return
                for row in assessment.results.filter(indicator__isnull=True):
                    unit_scores.setdefault(row.administrative_unit_id, {})[component] = row.final_score

            collect(risk.hazard_assessment, "hazard")
            collect(risk.vulnerability_assessment, "vulnerability")
            collect(risk.exposure_assessment, "exposure")
            weights = {
                "hazard": risk.hazard_weight,
                "vulnerability": risk.vulnerability_weight,
                "exposure": risk.exposure_weight,
            }
            risk_results = compute_risk_scores(unit_scores, weights, formula=risk.formula)
            with transaction.atomic():
                RiskResult.objects.filter(risk_assessment=risk).delete()
                for unit_id, data in risk_results.items():
                    RiskResult.objects.create(
                        risk_assessment=risk,
                        administrative_unit_id=unit_id,
                        hazard_score=data.get("hazard_score"),
                        vulnerability_score=data.get("vulnerability_score"),
                        exposure_score=data.get("exposure_score"),
                        risk_score=data["risk_score"],
                        risk_class=data["risk_class"],
                        metadata={"formula": risk.formula, "weights": weights, "demo_data": True},
                    )
            risk.status = "COMPLETED"
            risk.completed_at = timezone.now()
            risk.save(update_fields=["status", "completed_at"])
            return {"message": "Risk assessment completed.", "risk_assessment_id": risk.id, "status": risk.status}
        except Exception as e:
            risk.status = "FAILED"
            risk.error_message = str(e)
            risk.save(update_fields=["status", "error_message"])
            return {"message": "Risk processing failed.", "error": str(e)}


class SharedSavedQueryView(APIView):
    """Public read-only view of a shared saved query — GET /api/saved-queries/shared/{token}/"""

    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            query = SavedQuery.objects.get(share_token=token, is_shared=True)
        except SavedQuery.DoesNotExist:
            return Response(
                {"message": "Shared query not found or no longer shared."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(SavedQuerySerializer(query).data)