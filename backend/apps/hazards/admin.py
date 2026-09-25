"""Hazards admin"""
from django.contrib import admin
from .models import (
    HazardType, HazardEvent, HazardLayer, HazardIndicator,
    IndicatorWeightageRule, ClimateContext, Recommendation,
)


@admin.register(HazardType)
class HazardTypeAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "is_active"]


@admin.register(HazardEvent)
class HazardEventAdmin(admin.ModelAdmin):
    list_display = ["hazard_type", "event_date", "latitude", "longitude", "source", "is_demo"]
    list_filter = ["hazard_type", "is_demo"]
    ordering = ["-event_date"]


@admin.register(HazardLayer)
class HazardLayerAdmin(admin.ModelAdmin):
    list_display = ["name", "hazard_type", "geometry_type", "vintage", "is_demo"]
    list_filter = ["hazard_type", "is_demo"]


@admin.register(HazardIndicator)
class HazardIndicatorAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "hazard_type", "default_weight", "is_active"]
    list_filter = ["hazard_type", "is_active"]


@admin.register(IndicatorWeightageRule)
class IndicatorWeightageRuleAdmin(admin.ModelAdmin):
    list_display = ["indicator", "label", "range_min", "range_max", "score", "is_prototype_threshold"]


@admin.register(ClimateContext)
class ClimateContextAdmin(admin.ModelAdmin):
    list_display = ["title", "hazard_type", "region", "vintage", "is_active", "is_demo"]
    list_filter = ["hazard_type", "is_active", "is_demo"]


@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    list_display = ["module_type", "hazard_type", "classification", "priority", "is_active", "is_demo"]
    list_filter = ["module_type", "hazard_type", "classification", "priority", "is_demo"]
