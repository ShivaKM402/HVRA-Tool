"""
Assessments models — core workflow models.

Assessment → AssessmentIndicator → AssessmentResult

Design for future extensibility:
  - Module 1: Hazard (implemented)
  - Module 2: Vulnerability (future)
  - Module 3: Exposure (future)
  - Module 4: Composite Risk (future)
"""
from django.db import models


class AssessmentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    QUEUED = "QUEUED", "Queued"
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class Assessment(models.Model):
    """
    A hazard assessment run.

    Stores full provenance:
    - which user created it
    - which state/district/level was assessed
    - which hazard was assessed
    - assessment period
    - data sources used
    - status and audit trail
    """
    # Identity
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Hazard
    hazard_type = models.CharField(max_length=32, db_index=True)

    # Administrative scope
    state = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="state_assessments",
        limit_choices_to={"level": "STATE"},
    )
    district = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="district_assessments",
        limit_choices_to={"level": "DISTRICT"},
    )
    administrative_level = models.CharField(
        max_length=16,
        default="BLOCK",
        help_text="The level at which assessment is performed (BLOCK, VILLAGE, etc.).",
    )

    # Assessment period
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    # Data source used
    data_source = models.ForeignKey(
        "datasets.DataSource",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assessments",
    )

    # Normalization and classification settings at time of assessment
    normalization_method = models.CharField(max_length=32, default="min_max")
    classification_method = models.CharField(max_length=32, default="threshold")

    # Status
    status = models.CharField(
        max_length=16, choices=AssessmentStatus.choices, default=AssessmentStatus.DRAFT
    )
    error_message = models.TextField(blank=True)

    # Audit trail
    created_by = models.ForeignKey(
        "auth.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assessments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Full configuration snapshot for auditability
    configuration_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Snapshot of all settings used, stored for auditability.",
    )

    class Meta:
        db_table = "assessment"
        verbose_name = "Assessment"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} — {self.hazard_type} [{self.status}]"


class AssessmentIndicator(models.Model):
    """
    Records which indicator was selected for an assessment and at what weight.
    Weight is stored at assessment time for auditability.
    """
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="indicators",
    )
    indicator = models.ForeignKey(
        "hazards.HazardIndicator",
        on_delete=models.PROTECT,
        related_name="assessment_uses",
    )
    weight = models.FloatField(help_text="User-configured weight for this indicator (0–10).")
    data_source = models.ForeignKey(
        "datasets.DataSource",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assessment_indicator"
        verbose_name = "Assessment Indicator"
        unique_together = [["assessment", "indicator"]]

    def __str__(self):
        return f"{self.assessment.name} — {self.indicator.name} (w={self.weight})"


class AssessmentResult(models.Model):
    """
    Per-unit result for each indicator.

    Stores the full scoring chain:
    raw_value → normalized_value → weighted_score → final_score → classification

    One row per (assessment, administrative_unit, indicator).
    Final classification is on the summary row where indicator is NULL.
    """
    assessment = models.ForeignKey(
        Assessment,
        on_delete=models.CASCADE,
        related_name="results",
    )
    administrative_unit = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="assessment_results",
    )
    indicator = models.ForeignKey(
        "hazards.HazardIndicator",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="results",
        help_text="NULL = composite/summary result row.",
    )

    # Scoring chain
    raw_value = models.FloatField(null=True, blank=True)
    normalized_value = models.FloatField(null=True, blank=True)
    weight = models.FloatField(null=True, blank=True)
    weighted_score = models.FloatField(null=True, blank=True)
    final_score = models.FloatField(null=True, blank=True)

    # Classification
    CLASSIFICATION_CHOICES = [
        ("NH", "No Hazard"),
        ("LH", "Low Hazard"),
        ("MH", "Medium Hazard"),
        ("HH", "High Hazard"),
    ]
    classification = models.CharField(
        max_length=4, choices=CLASSIFICATION_CHOICES, blank=True
    )

    # Metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Stores raw calculation components (total_area, flood_prone_percentage, etc.) on the summary row."
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assessment_result"
        verbose_name = "Assessment Result"
        ordering = ["administrative_unit__name"]

    def __str__(self):
        indicator_name = self.indicator.name if self.indicator else "COMPOSITE"
        return (
            f"{self.assessment.name} — {self.administrative_unit.name} "
            f"— {indicator_name}: {self.final_score} ({self.classification})"
        )
