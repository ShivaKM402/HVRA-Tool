"""Assessments admin"""
from django.contrib import admin
from .models import Assessment, AssessmentIndicator, AssessmentResult


@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ["name", "hazard_type", "district", "administrative_level", "status", "created_at"]
    list_filter = ["hazard_type", "status", "administrative_level"]
    readonly_fields = ["created_at", "updated_at", "completed_at", "configuration_snapshot"]


@admin.register(AssessmentIndicator)
class AssessmentIndicatorAdmin(admin.ModelAdmin):
    list_display = ["assessment", "indicator", "weight"]


@admin.register(AssessmentResult)
class AssessmentResultAdmin(admin.ModelAdmin):
    list_display = ["assessment", "administrative_unit", "indicator", "final_score", "classification"]
    list_filter = ["classification"]
