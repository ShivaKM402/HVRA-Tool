"""Assessments serializers"""
from rest_framework import serializers
from .models import Assessment, AssessmentIndicator, AssessmentResult


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

    class Meta:
        model = Assessment
        fields = [
            "id", "name", "description", "hazard_type",
            "state", "state_name", "district", "district_name",
            "administrative_level",
            "start_date", "end_date",
            "data_source", "normalization_method", "classification_method",
            "status", "error_message",
            "indicators", "result_count",
            "created_at", "updated_at", "completed_at",
        ]
        read_only_fields = ["status", "error_message", "created_at", "updated_at", "completed_at"]

    def get_result_count(self, obj):
        return obj.results.filter(indicator__isnull=True).count()


class AssessmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new assessment with indicators."""
    indicators = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        help_text="List of {indicator_id, weight} dicts.",
    )

    class Meta:
        model = Assessment
        fields = [
            "name", "description", "hazard_type",
            "state", "district", "administrative_level",
            "start_date", "end_date",
            "data_source", "normalization_method", "classification_method",
            "indicators",
        ]

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
            "indicators": indicators_data,
            "normalization_method": assessment.normalization_method,
            "classification_method": assessment.classification_method,
        }
        assessment.save(update_fields=["configuration_snapshot"])

        return assessment
