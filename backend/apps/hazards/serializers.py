"""Hazards serializers"""
from rest_framework import serializers
from .models import (
    HazardType, HazardEvent, HazardLayer, HazardIndicator,
    IndicatorWeightageRule, ClimateContext, Recommendation,
)


class HazardTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HazardType
        fields = ["code", "name", "description", "is_active", "icon", "color"]


class HazardEventSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()
    admin_unit_name = serializers.SerializerMethodField()

    class Meta:
        model = HazardEvent
        fields = [
            "id", "hazard_type", "event_date", "latitude", "longitude",
            "administrative_unit", "admin_unit_name",
            "magnitude", "loss", "description", "source", "source_url",
            "geometry", "is_demo", "created_at",
        ]

    def get_geometry(self, obj):
        return obj.geometry

    def get_admin_unit_name(self, obj):
        return obj.administrative_unit.name if obj.administrative_unit else None


class HazardLayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = HazardLayer
        fields = [
            "id", "name", "hazard_type", "geometry_type",
            "source", "source_url", "organization", "vintage", "crs",
            "metadata", "is_demo", "created_at",
        ]


class IndicatorWeightageRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndicatorWeightageRule
        fields = [
            "id", "label", "range_min", "range_max", "score",
            "description", "is_prototype_threshold",
        ]


class HazardIndicatorSerializer(serializers.ModelSerializer):
    weightage_rules = IndicatorWeightageRuleSerializer(many=True, read_only=True)
    module_type = serializers.CharField(source="get_module_type_display", read_only=True)

    class Meta:
        model = HazardIndicator
        fields = [
            "id", "module_type", "hazard_type", "code", "name", "description", "unit",
            "default_weight", "min_weight", "max_weight",
            "is_active", "order", "weightage_rules",
        ]


class ClimateContextSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True)

    class Meta:
        model = ClimateContext
        fields = [
            "id", "hazard_type", "region", "region_name", "title", "statement",
            "source", "source_url", "vintage", "display_order",
            "is_active", "is_demo",
        ]


class RecommendationSerializer(serializers.ModelSerializer):
    module_type = serializers.CharField(source="get_module_type_display", read_only=True)
    module_code = serializers.CharField(source="module_type", read_only=True)

    class Meta:
        model = Recommendation
        fields = [
            "id", "module_type", "module_code", "hazard_type", "classification",
            "text", "priority", "display_order", "is_active", "is_demo",
        ]
