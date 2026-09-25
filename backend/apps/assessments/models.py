"""
Assessments models — core workflow models.

Assessment → AssessmentIndicator → AssessmentResult

Design for future extensibility:
  - Module 1: Hazard (implemented)
  - Module 2: Vulnerability (implemented — indicators, scoring, reports)
  - Module 3: Exposure (implemented — indicators, scoring, reports)
  - Module 4: Composite Risk (implemented — RiskAssessment/RiskResult, R = H × V × E)
"""
from django.db import models


class AssessmentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    QUEUED = "QUEUED", "Queued"
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class ModuleTypeChoices(models.TextChoices):
    HAZARD = "HAZARD", "Hazard"
    VULNERABILITY = "VULNERABILITY", "Vulnerability"
    EXPOSURE = "EXPOSURE", "Exposure"


RISK_CLASS_CHOICES = [
    ("VERY_HIGH", "Very High Risk"),
    ("HIGH", "High Risk"),
    ("MODERATE", "Moderate Risk"),
    ("LOW", "Low Risk"),
]


class Assessment(models.Model):
    """
    A hazard / vulnerability / exposure assessment run.

    Stores full provenance:
    - which user created it
    - which state/district/level was assessed
    - which module (hazard/vulnerability/exposure) and hazard was assessed
    - assessment period
    - data sources used
    - status and audit trail
    """
    # Identity
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # HVRA module
    module_type = models.CharField(
        max_length=16,
        choices=ModuleTypeChoices.choices,
        default=ModuleTypeChoices.HAZARD,
        db_index=True,
    )

    # Hazard (used by Hazard module; optional for V/E)
    hazard_type = models.CharField(
        max_length=32, null=True, blank=True, db_index=True
    )

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

    # Task Force review workflow (HVRA Section 8)
    APPROVAL_CHOICES = [
        ("PENDING", "Pending Review"),
        ("SUBMITTED", "Submitted for Review"),
        ("APPROVED", "Approved / Endorsed"),
        ("REJECTED", "Rejected"),
    ]
    approval_status = models.CharField(
        max_length=16, choices=APPROVAL_CHOICES, default="PENDING",
        help_text="Disaster Management Task Force review status.",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewer_name = models.CharField(max_length=255, blank=True)
    reviewer_org = models.CharField(max_length=255, blank=True)
    review_comment = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

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


class RiskAssessment(models.Model):
    """
    Module 4 — Composite Risk Assessment.

    Combines the unit-level composite scores of a Hazard, a Vulnerability and
    an Exposure assessment using a weighted multiplicative formula:

        Risk = (H^wH × V^wV × E^wE)^(1 / (wH + wV + wE))   [weighted geometric mean]

    with optional user-adjustable module weights for scenario testing.
    Weighted sum (additive) remains available via the ``formula`` field.
    """
    # Identity
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Administrative scope (denormalised from the module assessments)
    state = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="state_risk_assessments",
        limit_choices_to={"level": "STATE"},
    )
    district = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="district_risk_assessments",
        limit_choices_to={"level": "DISTRICT"},
    )
    administrative_level = models.CharField(
        max_length=16,
        default="BLOCK",
        help_text="The level at which the risk assessment is performed.",
    )

    # Module inputs
    hazard_assessment = models.ForeignKey(
        Assessment,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="used_in_hazard_risk",
        help_text="Completed Hazard assessment (Module 1).",
    )
    vulnerability_assessment = models.ForeignKey(
        Assessment,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="used_in_vulnerability_risk",
        help_text="Completed Vulnerability assessment (Module 2).",
    )
    exposure_assessment = models.ForeignKey(
        Assessment,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="used_in_exposure_risk",
        help_text="Completed Exposure assessment (Module 3).",
    )

    # Scenario weights
    FORMULA_CHOICES = [
        ("MULTIPLICATIVE", "Multiplicative (Risk = H × V × E)"),
        ("ADDITIVE", "Weighted Sum (Risk = wH·H + wV·V + wE·E)"),
    ]
    formula = models.CharField(
        max_length=16, choices=FORMULA_CHOICES, default="MULTIPLICATIVE"
    )
    hazard_weight = models.FloatField(default=1.0, help_text="User-adjustable weight for the Hazard component (0–10).")
    vulnerability_weight = models.FloatField(default=1.0, help_text="User-adjustable weight for the Vulnerability component (0–10).")
    exposure_weight = models.FloatField(default=1.0, help_text="User-adjustable weight for the Exposure component (0–10).")

    # Status
    status = models.CharField(
        max_length=16, choices=AssessmentStatus.choices, default=AssessmentStatus.DRAFT
    )
    error_message = models.TextField(blank=True)

    # Task Force review workflow (HVRA Section 8)
    APPROVAL_CHOICES = [
        ("PENDING", "Pending Review"),
        ("SUBMITTED", "Submitted for Review"),
        ("APPROVED", "Approved / Endorsed"),
        ("REJECTED", "Rejected"),
    ]
    approval_status = models.CharField(
        max_length=16, choices=APPROVAL_CHOICES, default="PENDING",
        help_text="Disaster Management Task Force review status.",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewer_name = models.CharField(max_length=255, blank=True)
    reviewer_org = models.CharField(max_length=255, blank=True)
    review_comment = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Audit trail
    created_by = models.ForeignKey(
        "auth.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="risk_assessments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Full configuration snapshot for auditability
    configuration_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "risk_assessment"
        verbose_name = "Risk Assessment"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} — Risk [{self.status}]"

    def effective_weights(self):
        """Return component weights (normalised to sum = 1.0) with signed relevance."""
        weights = {
            "hazard": self.hazard_weight or 0.0,
            "vulnerability": self.vulnerability_weight or 0.0,
            "exposure": self.exposure_weight or 0.0,
        }
        total = sum(max(w, 0.0) for w in weights.values()) or 1.0
        return {k: max(v, 0.0) / total for k, v in weights.items()}


class RiskResult(models.Model):
    """
    Per-unit result for a Composite Risk assessment.

    Stores the component module scores, the combined risk score (0–10) and a
    risk class (VERY_HIGH / HIGH / MODERATE / LOW).
    """
    risk_assessment = models.ForeignKey(
        RiskAssessment,
        on_delete=models.CASCADE,
        related_name="results",
    )
    administrative_unit = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="risk_results",
    )

    # Component scores (0–10, sourced from the module assessments)
    hazard_score = models.FloatField(null=True, blank=True)
    vulnerability_score = models.FloatField(null=True, blank=True)
    exposure_score = models.FloatField(null=True, blank=True)

    # Combined result
    risk_score = models.FloatField(null=True, blank=True)
    risk_class = models.CharField(max_length=16, choices=RISK_CLASS_CHOICES, blank=True)

    metadata = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "risk_result"
        verbose_name = "Risk Result"
        ordering = ["administrative_unit__name"]

    def __str__(self):
        return (
            f"{self.risk_assessment.name} — {self.administrative_unit.name} "
            f"— {self.risk_score} ({self.risk_class})"
        )


class QueryModuleChoices(models.TextChoices):
    """Modules that can be saved as a reusable query (Modules 1–4)."""
    HAZARD = "HAZARD", "Hazard"
    VULNERABILITY = "VULNERABILITY", "Vulnerability"
    EXPOSURE = "EXPOSURE", "Exposure"
    COMPOSITE_RISK = "COMPOSITE_RISK", "Composite Risk"


class SavedQuery(models.Model):
    """
    A saved / shareable assessment query (HVRA Section 3.3 — query layer).

    Stores the full parameterisation of a Query Builder session so an officer
    can re-run it later, or share it with another district/state via a public
    share link.
    """
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    module_type = models.CharField(
        max_length=16, choices=QueryModuleChoices.choices, db_index=True
    )
    hazard_type = models.CharField(max_length=32, blank=True)

    state = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="saved_queries_state",
        limit_choices_to={"level": "STATE"},
    )
    district = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="saved_queries_district",
        limit_choices_to={"level": "DISTRICT"},
    )
    administrative_level = models.CharField(max_length=16, default="BLOCK")

    # Full query parameterisation (indicators/weights or risk component links)
    parameters = models.JSONField(default=dict, blank=True)

    # Ownership + sharing
    created_by = models.ForeignKey(
        "auth.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="saved_queries",
    )
    share_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    is_shared = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "saved_query"
        verbose_name = "Saved Query"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} [{self.module_type}]"
