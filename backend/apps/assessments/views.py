"""
Assessment views.

POST /api/assessments/           → create assessment
GET  /api/assessments/{id}/      → get assessment detail
POST /api/assessments/{id}/run/  → trigger GIS processing
GET  /api/assessments/{id}/results/ → get results
GET  /api/assessments/{id}/map/  → get map GeoJSON
GET  /api/assessments/{id}/report/ → download report
"""
from django.utils import timezone
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Assessment, AssessmentResult
from .serializers import (
    AssessmentSerializer, AssessmentCreateSerializer, AssessmentResultSerializer
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
        hazard_type = self.request.query_params.get("hazard_type")
        status_filter = self.request.query_params.get("status")
        if hazard_type:
            qs = qs.filter(hazard_type=hazard_type.upper())
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        return qs

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        """
        Trigger GIS processing and scoring for this assessment.
        """
        from django.db import transaction
        from apps.administration.models import AdministrativeUnit
        from apps.hazards.models import HazardLayer, HazardEvent
        from gis.spatial import process_flood_assessment
        from scoring.scoring import compute_assessment_scores
        from scoring.classification import classify_batch
        
        assessment = self.get_object()

        if assessment.status in ("PROCESSING", "QUEUED", "COMPLETED"):
            return Response(
                {"message": f"Assessment is already {assessment.status.lower()}."},
                status=status.HTTP_409_CONFLICT,
            )

        # Validate constraints — demo supports three Kerala districts
        SUPPORTED_DISTRICTS = {"Kottayam", "Thiruvananthapuram", "Ernakulam"}
        district_name = assessment.district.name.replace(" [DEMO]", "").strip()
        if (
            assessment.hazard_type != "FLOOD"
            or assessment.state.name.replace(" [DEMO]", "").strip() != "Kerala"
            or district_name not in SUPPORTED_DISTRICTS
            or assessment.administrative_level != "BLOCK"
        ):
            return Response(
                {"message": f"Prototype supports Flood/Block for Kerala → {', '.join(SUPPORTED_DISTRICTS)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            assessment.status = "PROCESSING"
            assessment.save(update_fields=["status"])

            # 1. Load Blocks
            blocks_qs = AdministrativeUnit.objects.filter(
                parent=assessment.district, level="BLOCK"
            )
            blocks = []
            for b in blocks_qs:
                blocks.append({
                    "id": b.id,
                    "name": b.name,
                    "area_sqkm": b.area_sqkm,
                    "geometry": b.geometry
                })

            # 2. Load flood layers and events for Kottayam
            flood_layers_qs = HazardLayer.objects.filter(
                hazard_type="FLOOD", geometry_type="POLYGON"
            )
            flood_layers = [{"geometry": fl.geometry} for fl in flood_layers_qs if fl.geometry]

            events_qs = HazardEvent.objects.filter(
                hazard_type="FLOOD",
                latitude__isnull=False,
                longitude__isnull=False
            )
            events = []
            for ev in events_qs:
                events.append({
                    "id": ev.id,
                    "latitude": ev.latitude,
                    "longitude": ev.longitude,
                    "event_date": ev.event_date
                })

            # 3. Calculate GIS values
            gis_results = process_flood_assessment(blocks, flood_layers, events)

            # 4. Map indicator configurations
            indicator_configs = []
            for ind in assessment.indicators.all():
                indicator_configs.append({
                    "code": ind.indicator.code,
                    "weight": ind.weight,
                    "id": ind.indicator.id
                })

            # 5. Calculate normalized and weighted scores
            scoring_results = compute_assessment_scores(
                gis_results=gis_results,
                indicator_configs=indicator_configs,
                normalization_method=assessment.normalization_method
            )

            # 6. Classify
            scores_for_classification = {
                bid: res["composite_score"] for bid, res in scoring_results.items()
            }
            classifications = classify_batch(
                scores_for_classification,
                method=assessment.classification_method
            )

            # 7. Save Results
            with transaction.atomic():
                # Clear existing results if any
                AssessmentResult.objects.filter(assessment=assessment).delete()

                for block_id, result in scoring_results.items():
                    block_unit = blocks_qs.get(id=block_id)
                    
                    # Create granular indicator rows
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
                                weighted_score=ind_data["weighted_score"]
                            )

                    # Create summary row
                    comp_score = result["composite_score"]
                    cls = classifications.get(block_id, "NH")
                    
                    # Store raw GIS metadata directly on the summary row
                    gis_meta = gis_results.get(block_id, {})
                    
                    AssessmentResult.objects.create(
                        assessment=assessment,
                        administrative_unit=block_unit,
                        indicator=None,
                        final_score=comp_score,
                        classification=cls,
                        metadata={
                            "total_area_sqkm": gis_meta.get("total_area_sqkm"),
                            "flood_prone_area_sqkm": gis_meta.get("flood_prone_area_sqkm"),
                            "flood_prone_percentage": gis_meta.get("flood_prone_percentage"),
                            "event_count": gis_meta.get("event_count"),
                            "event_frequency": gis_meta.get("event_frequency")
                        }
                    )

            assessment.status = "COMPLETED"
            assessment.save(update_fields=["status"])

            return Response({
                "message": "Assessment processing completed successfully.",
                "assessment_id": assessment.id,
                "status": assessment.status
            })

        except Exception as e:
            assessment.status = "FAILED"
            assessment.error_message = str(e)
            assessment.save(update_fields=["status", "error_message"])
            return Response(
                {"message": "Processing failed.", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=["get"])
    def results(self, request, pk=None):
        """Get assessment results."""
        assessment = self.get_object()

        if assessment.status != "COMPLETED":
            return Response(
                {
                    "message": f"Assessment is not yet completed. Status: {assessment.status}",
                    "status": assessment.status,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Get composite results (indicator=None rows)
        composite_results = assessment.results.filter(indicator__isnull=True)
        serializer = AssessmentResultSerializer(composite_results, many=True)

        # Summary statistics
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
        """Get assessment results as a GeoJSON FeatureCollection for map rendering."""
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

        for result in composite_results:
            unit = result.administrative_unit
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

        return Response(
            {
                "type": "FeatureCollection",
                "features": features,
                "classification_colors": classification_colors,
            }
        )

    @action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        """
        Generate and return structured assessment report data.
        """
        assessment = self.get_object()

        if assessment.status != "COMPLETED":
            return Response(
                {"message": f"Assessment is not completed. Status: {assessment.status}"},
                status=status.HTTP_202_ACCEPTED,
            )

        # 1. Metadata
        metadata = {
            "name": assessment.name,
            "status": assessment.status,
            "created_at": assessment.created_at.isoformat(),
            "hazard_type": assessment.hazard_type,
            "state": assessment.state.name if assessment.state else "Kerala",
            "district": assessment.district.name if assessment.district else "Kottayam",
            "level": assessment.administrative_level,
            "is_demo": True
        }

        # 2. Methodology
        methodology = []
        for ind in assessment.indicators.select_related("indicator"):
            methodology.append({
                "indicator": ind.indicator.name,
                "weight": ind.weight,
                "code": ind.indicator.code
            })

        # 3. Block Results & Classification Summary
        composite_results = assessment.results.filter(indicator__isnull=True).select_related("administrative_unit")
        
        classification_summary = {"NH": 0, "LH": 0, "MH": 0, "HH": 0}
        total_historical_events = 0
        block_results = []
        
        hh_blocks = []
        max_score = -1.0
        max_score_block = None

        for r in composite_results:
            cls = r.classification or "NH"
            classification_summary[cls] = classification_summary.get(cls, 0) + 1
            
            meta = r.metadata or {}
            events = meta.get("event_count", 0)
            total_historical_events += events
            
            block_data = {
                "unit_name": r.administrative_unit.name,
                "flood_prone_percentage": meta.get("flood_prone_percentage", 0.0),
                "event_count": events,
                "event_frequency": meta.get("event_frequency", 0.0),
                "composite_score": r.final_score,
                "classification": cls
            }
            block_results.append(block_data)
            
            if cls == "HH":
                hh_blocks.append(r.administrative_unit.name)
                
            if r.final_score is not None and r.final_score > max_score:
                max_score = r.final_score
                max_score_block = r.administrative_unit.name

        # Sort block results by score descending
        block_results.sort(key=lambda x: (x["composite_score"] or -1), reverse=True)

        return Response({
            "metadata": metadata,
            "methodology": methodology,
            "historical_profile": {
                "total_events": total_historical_events
            },
            "classification_summary": classification_summary,
            "findings": {
                "hh_blocks": hh_blocks,
                "max_score": max_score,
                "max_score_block": max_score_block
            },
            "recommendations": [
                "Implement strict flood zoning in High Hazard (HH) blocks.",
                "Enhance early warning dissemination systems in Moderate Hazard (MH) areas.",
                "Conduct detailed localized vulnerability assessments for priority areas.",
                "Upgrade drainage infrastructure in historically affected blocks."
            ],
            "block_results": block_results
        })

    @action(detail=True, methods=["get"])
    def indicator_results(self, request, pk=None):
        """Get per-indicator results for all units."""
        assessment = self.get_object()
        results = assessment.results.filter(
            indicator__isnull=False
        ).select_related("administrative_unit", "indicator")
        serializer = AssessmentResultSerializer(results, many=True)
        return Response(serializer.data)
