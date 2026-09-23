"""
Datasets models.

DataSource — catalogue of known data sources with provenance metadata
UploadedDataset — user-uploaded files (CSV, GeoJSON, Shapefile)
"""
from django.db import models


class DataSource(models.Model):
    """
    A known data source with full provenance metadata.
    Required for traceability and auditability.
    """
    name = models.CharField(max_length=255)
    organization = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    source_url = models.URLField(blank=True)
    vintage = models.CharField(max_length=32, blank=True, help_text="Data vintage year or period.")
    last_updated = models.DateField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_builtin = models.BooleanField(
        default=True, help_text="True = built-in/curated dataset; False = user uploaded."
    )
    is_demo = models.BooleanField(
        default=False, help_text="True = DEMO DATA, not official data."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "data_source"
        verbose_name = "Data Source"
        ordering = ["name"]

    def __str__(self):
        demo_tag = " [DEMO]" if self.is_demo else ""
        return f"{self.name} ({self.organization}){demo_tag}"


class UploadedDataset(models.Model):
    """
    A user-uploaded dataset with validation status.
    Supported formats: CSV, GeoJSON, Shapefile (zipped).
    """
    FORMAT_CHOICES = [
        ("CSV", "CSV"),
        ("GEOJSON", "GeoJSON"),
        ("SHAPEFILE", "Shapefile (ZIP)"),
    ]

    STATUS_CHOICES = [
        ("PENDING", "Pending Validation"),
        ("VALID", "Valid"),
        ("INVALID", "Invalid"),
        ("PROCESSING", "Processing"),
    ]

    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="uploads/datasets/")
    file_format = models.CharField(max_length=16, choices=FORMAT_CHOICES)
    file_size_bytes = models.PositiveBigIntegerField(default=0)
    hazard_type = models.CharField(max_length=32, blank=True)
    data_type = models.CharField(
        max_length=32,
        blank=True,
        help_text="e.g. 'FLOOD_PRONE_AREA', 'HAZARD_EVENT'",
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
    validation_errors = models.JSONField(default=list, blank=True)
    validation_warnings = models.JSONField(default=list, blank=True)
    record_count = models.IntegerField(null=True, blank=True)
    crs = models.CharField(max_length=64, blank=True)

    # Provenance
    uploaded_by = models.ForeignKey(
        "auth.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_datasets",
    )
    upload_date = models.DateTimeField(auto_now_add=True)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=255, blank=True)
    organization = models.CharField(max_length=255, blank=True)
    vintage = models.CharField(max_length=32, blank=True)
    dataset_version = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "uploaded_dataset"
        verbose_name = "Uploaded Dataset"
        ordering = ["-upload_date"]

    def __str__(self):
        return f"{self.name} ({self.file_format}) — {self.status}"
