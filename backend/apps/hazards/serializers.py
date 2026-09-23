"""Hazards serializers"""
from rest_framework import serializers
from .models import HazardType, HazardEvent, HazardLayer, HazardIndicator, IndicatorWeightageRule


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

    class Meta:
        model = HazardIndicator
        fields = [
            "id", "hazard_type", "code", "name", "description", "unit",
            "default_weight", "min_weight", "max_weight",
            "is_active", "order", "weightage_rules",
        ]
