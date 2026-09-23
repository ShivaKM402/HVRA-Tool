"""Reports admin"""
from django.contrib import admin
from .models import GeneratedReport


@admin.register(GeneratedReport)
class GeneratedReportAdmin(admin.ModelAdmin):
    list_display = ["assessment", "format", "status", "generated_at"]
    list_filter = ["format", "status"]
