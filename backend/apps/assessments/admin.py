"""Assessments admin"""
from django.contrib import admin
from .models import (
    Assessment, AssessmentIndicator, AssessmentResult,
    RiskAssessment, RiskResult, SavedQuery,
)


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ["name", "module_type", "hazard_type", "district", "administrative_level", "status", "created_at"]
    list_filter = ["module_type", "hazard_type", "status", "administrative_level"]
    readonly_fields = ["created_at", "updated_at", "completed_at", "configuration_snapshot"]


@admin.register(AssessmentIndicator)
class AssessmentIndicatorAdmin(admin.ModelAdmin):
    list_display = ["assessment", "indicator", "weight"]


@admin.register(AssessmentResult)
class AssessmentResultAdmin(admin.ModelAdmin):
    list_display = ["assessment", "administrative_unit", "indicator", "final_score", "classification"]
    list_filter = ["classification"]


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = [
        "name", "district", "status", "hazard_assessment",
        "vulnerability_assessment", "exposure_assessment",
        "formula", "created_at",
    ]
    list_filter = ["status", "formula", "administrative_level"]
    readonly_fields = ["created_at", "updated_at", "completed_at", "configuration_snapshot"]


@admin.register(RiskResult)
class RiskResultAdmin(admin.ModelAdmin):
    list_display = [
        "risk_assessment", "administrative_unit", "hazard_score",
        "vulnerability_score", "exposure_score", "risk_score", "risk_class",
    ]
    list_filter = ["risk_class"]


@admin.register(SavedQuery)
class SavedQueryAdmin(admin.ModelAdmin):
    list_display = ["name", "module_type", "district", "administrative_level", "is_shared", "created_by", "created_at"]
    list_filter = ["module_type", "administrative_level", "is_shared"]
    readonly_fields = ["share_token", "created_at", "updated_at"]