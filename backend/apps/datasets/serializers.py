"""Datasets serializers"""
from rest_framework import serializers
from .models import DataSource, UploadedDataset


class DataSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSource
        fields = [
            "id", "name", "organization", "description", "source_url",
            "vintage", "last_updated", "metadata", "is_builtin", "is_demo",
            "created_at",
        ]


class UploadedDatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedDataset
        fields = [
            "id", "name", "file_format", "file_size_bytes",
            "hazard_type", "data_type", "status",
            "validation_errors", "validation_warnings",
            "record_count", "crs",
            "upload_date", "description", "source", "organization",
            "vintage", "dataset_version",
        ]
        read_only_fields = [
            "status", "validation_errors", "validation_warnings",
            "record_count", "crs", "upload_date", "file_size_bytes",
        ]


class DatasetUploadSerializer(serializers.Serializer):
    """Serializer for the upload endpoint."""
    file = serializers.FileField()
    name = serializers.CharField(max_length=255)
    hazard_type = serializers.CharField(max_length=32, required=False)
    data_type = serializers.CharField(max_length=32, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    source = serializers.CharField(max_length=255, required=False, allow_blank=True)
    organization = serializers.CharField(max_length=255, required=False, allow_blank=True)
    vintage = serializers.CharField(max_length=32, required=False, allow_blank=True)
