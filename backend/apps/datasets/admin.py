"""Datasets admin"""
from django.contrib import admin
from .models import DataSource, UploadedDataset


@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ["name", "organization", "vintage", "is_builtin", "is_demo"]
    list_filter = ["is_builtin", "is_demo"]


@admin.register(UploadedDataset)
class UploadedDatasetAdmin(admin.ModelAdmin):
    list_display = ["name", "file_format", "status", "record_count", "upload_date"]
    list_filter = ["file_format", "status"]
    readonly_fields = ["upload_date", "validation_errors", "validation_warnings"]
