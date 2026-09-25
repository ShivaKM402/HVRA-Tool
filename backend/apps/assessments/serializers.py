"""Assessments serializers"""
from rest_framework import serializers
from .models import (
    Assessment, AssessmentIndicator, AssessmentResult,
    RiskAssessment, RiskResult, SavedQuery,
)


class AssessmentIndicatorSerializer(serializers.ModelSerializer):
    indicator_code = serializers.CharField(source="indicator.code", read_only=True)
    indicator_name = serializers.CharField(source="indicator.name", read_only=True)
    indicator_unit = serializers.CharField(source="indicator.unit", read_only=True)

    class Meta:
        model = AssessmentIndicator
        fields = [
            "id", "indicator", "indicator_code", "indicator_name",
            "indicator_unit", "weight", "data_source",
        ]


class AssessmentResultSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source="administrative_unit.name", read_only=True)
    unit_code = serializers.CharField(source="administrative_unit.code", read_only=True)
    indicator_name = serializers.SerializerMethodField()

    class Meta:
        model = AssessmentResult
        fields = [
            "id", "administrative_unit", "unit_name", "unit_code",
            "indicator", "indicator_name",
            "raw_value", "normalized_value", "weight", "weighted_score",
            "final_score", "classification", "metadata", "notes",
        ]

    def get_indicator_name(self, obj):
        return obj.indicator.name if obj.indicator else "COMPOSITE"


class AssessmentSerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.name", read_only=True)
    district_name = serializers.CharField(source="district.name", read_only=True)
    indicators = AssessmentIndicatorSerializer(many=True, read_only=True)
    result_count = serializers.SerializerMethodField()
    module_type = serializers.CharField(source="get_module_type_display", read_only=True)
    module_code = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, default=None)

    class Meta:
        model = Assessment
        fields = [
            "id", "name", "description", "module_type", "module_code",
            "hazard_type",
            "state", "state_name", "district", "district_name",
            "administrative_level",
            "start_date", "end_date",
            "data_source", "normalization_method", "classification_method",
            "status", "error_message",
            "approval_status", "submitted_at", "reviewer_name", "reviewer_org",
            "review_comment", "reviewed_at", "created_by_name",
            "indicators", "result_count",
            "created_at", "updated_at", "completed_at",
        ]
        read_only_fields = ["status", "error_message", "created_at", "updated_at", "completed_at"]

    def get_result_count(self, obj):
        return obj.results.filter(indicator__isnull=True).count()

    def get_module_code(self, obj):
        return obj.module_type


class AssessmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new assessment with indicators."""
    indicators = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        default=list,
        help_text="List of {indicator_id, weight} dicts.",
    )

    class Meta:
        model = Assessment
        fields = [
            "id", "name", "description", "module_type",
            "hazard_type",
            "state", "district", "administrative_level",
            "start_date", "end_date",
            "data_source", "normalization_method", "classification_method",
            "indicators",
        ]
        extra_kwargs = {
            "id": {"read_only": True},
            "module_type": {"required": False},
            "hazard_type": {"required": False, "allow_blank": True},
            "indicators": {"required": False},
        }

    def create(self, validated_data):
        indicators_data = validated_data.pop("indicators", [])
        assessment = Assessment.objects.create(**validated_data)

        for ind_data in indicators_data:
            AssessmentIndicator.objects.create(
                assessment=assessment,
                indicator_id=ind_data["indicator_id"],
                weight=ind_data.get("weight", 5.0),
                data_source_id=ind_data.get("data_source_id"),
            )

        # Store configuration snapshot for auditability
        assessment.configuration_snapshot = {
            "module_type": assessment.module_type,
            "indicators": indicators_data,
            "hazard_type": assessment.hazard_type,
            "normalization_method": assessment.normalization_method,
            "classification_method": assessment.classification_method,
        }
        assessment.save(update_fields=["configuration_snapshot"])

        return assessment


# ------------------------------------------------------------------
# Module 4 — Composite Risk serializers
# ------------------------------------------------------------------
class RiskResultSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source="administrative_unit.name", read_only=True)
    unit_code = serializers.CharField(source="administrative_unit.code", read_only=True)

    class Meta:
        model = RiskResult
        fields = [
            "id", "administrative_unit", "unit_name", "unit_code",
            "hazard_score", "vulnerability_score", "exposure_score",
            "risk_score", "risk_class", "metadata", "notes",
        ]


def _validate_module_assessment(attrs, field, module_code, required):
    """Validate that a referenced module assessment exists, is completed and
    matches the risk assessment's district (unless district not yet set)."""
    assessment = attrs.get(field)
    if assessment is None:
        if required:
            raise serializers.ValidationError({field: "This module assessment is required."})
        return
    if assessment.module_type != module_code:
        raise serializers.ValidationError(
            {field: f"Assessment must be a completed {module_code} module assessment."}
        )
    if assessment.status != "COMPLETED":
        raise serializers.ValidationError(
            {field: "Assessment must be completed before it can be combined into risk."}
        )
    district = attrs.get("district")
    if district is not None and assessment.district_id != district.id:
        raise serializers.ValidationError(
            {field: "Module assessments must belong to the same district."}
        )


class RiskAssessmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskAssessment
        fields = [
            "name", "description",
            "state", "district", "administrative_level",
            "hazard_assessment", "vulnerability_assessment", "exposure_assessment",
            "formula", "hazard_weight", "vulnerability_weight", "exposure_weight",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        _validate_module_assessment(attrs, "hazard_assessment", "HAZARD", required=False)
        _validate_module_assessment(attrs, "vulnerability_assessment", "VULNERABILITY", required=False)
        _validate_module_assessment(attrs, "exposure_assessment", "EXPOSURE", required=False)

        # At least one module assessment must be provided.
        if not any(
            attrs.get(k) for k in (
                "hazard_assessment", "vulnerability_assessment", "exposure_assessment"
            )
        ):
            raise serializers.ValidationError(
                "Provide at least one completed module assessment (H, V or E)."
            )
        return attrs

    def create(self, validated_data):
        risk = RiskAssessment.objects.create(**validated_data)
        risk.configuration_snapshot = {
            "formula": risk.formula,
            "weights": {
                "hazard": risk.hazard_weight,
                "vulnerability": risk.vulnerability_weight,
                "exposure": risk.exposure_weight,
            },
            "inputs": {
                "hazard_assessment": risk.hazard_assessment_id,
                "vulnerability_assessment": risk.vulnerability_assessment_id,
                "exposure_assessment": risk.exposure_assessment_id,
            },
        }
        risk.save(update_fields=["configuration_snapshot"])
        return risk


class RiskAssessmentSerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.name", read_only=True)
    district_name = serializers.CharField(source="district.name", read_only=True)
    hazard_assessment_name = serializers.CharField(
        source="hazard_assessment.name", read_only=True, default=None
    )
    vulnerability_assessment_name = serializers.CharField(
        source="vulnerability_assessment.name", read_only=True, default=None
    )
    exposure_assessment_name = serializers.CharField(
        source="exposure_assessment.name", read_only=True, default=None
    )
    result_count = serializers.SerializerMethodField()
    module_type = serializers.CharField(read_only=True, default="COMPOSITE_RISK")
    module_code = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, default=None)

    class Meta:
        model = RiskAssessment
        fields = [
            "id", "name", "description", "module_type", "module_code",
            "state", "state_name", "district", "district_name",
            "administrative_level",
            "hazard_assessment", "hazard_assessment_name",
            "vulnerability_assessment", "vulnerability_assessment_name",
            "exposure_assessment", "exposure_assessment_name",
            "formula", "hazard_weight", "vulnerability_weight", "exposure_weight",
            "status", "error_message", "result_count",
            "approval_status", "submitted_at", "reviewer_name", "reviewer_org",
            "review_comment", "reviewed_at", "created_by_name",
            "created_at", "updated_at", "completed_at",
        ]
        read_only_fields = ["status", "error_message", "created_at", "updated_at", "completed_at"]

    def get_result_count(self, obj):
        return obj.results.count()

    def get_module_code(self, obj):
        return "COMPOSITE_RISK"


# ------------------------------------------------------------------
# Saved Queries (HVRA Section 3.3 — query layer)
# ------------------------------------------------------------------
class SavedQuerySerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.name", read_only=True)
    district_name = serializers.CharField(source="district.name", read_only=True)
    created_by_name = serializers.CharField(source="created_by.username", read_only=True, default=None)
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = SavedQuery
        fields = [
            "id", "name", "description", "module_type", "hazard_type",
            "state", "state_name", "district", "district_name",
            "administrative_level", "parameters",
            "created_by", "created_by_name",
            "share_token", "is_shared", "share_url",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_by", "share_token", "is_shared", "share_url", "created_at", "updated_at"]

    def get_share_url(self, obj):
        if obj.share_token:
            from django.conf import settings
            base = getattr(settings, "PUBLIC_BASE_URL", "")
            return f"{base}/api/saved-queries/shared/{obj.share_token}/"
        return None
