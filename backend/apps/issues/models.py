"""
apps.issues.models — 3-Tier Field Incident Reporting & Workflow Engine.

Tiers:
  Tier 1 (Employee / Field Officer):
    - Reports ground incidents (Flood breach, Landslide debris, etc.)
    - Records GPS coordinates, timestamp, description, severity, photos,
      and hazard-specific template telemetry.
    - Edits and resubmits if revision is requested.

  Tier 2 (Senior Officer / Reviewer):
    - Reviews incidents within authorized department and geographic jurisdiction.
    - Requests revision with mandatory explanatory remarks, OR
    - Verifies, endorses, and escalates to Manager.
    - District-level disaster officers (DDMA) coordinate cross-department incidents.

  Tier 3 (Manager / Authorizing Authority):
    - Evaluates escalated incident.
    - Requests revision if needed, OR
    - Approves incident and triggers generation of a Module 1 Draft Assessment.
    - Statutory published HVRA reports require subsequent data validation and authorized sign-off.
"""
from django.db import models
from django.contrib.auth.models import User
import uuid


class HazardTypeChoices(models.TextChoices):
    FLOOD = "FLOOD", "Flood Hazard"
    LANDSLIDE = "LANDSLIDE", "Landslide Hazard"
    COASTAL = "COASTAL", "Coastal Erosion"
    EXTREME_WEATHER = "EXTREME_WEATHER", "Extreme Weather / Lightning"


class IssueSeverity(models.TextChoices):
    LOW = "LOW", "Low (Localized minor event / monitoring alert)"
    MEDIUM = "MEDIUM", "Medium (Moderate inundation / localized damage)"
    HIGH = "HIGH", "High (Major breach / critical lifeline severed)"
    CRITICAL = "CRITICAL", "Critical (Catastrophic threat / evacuation active)"


class IssueStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft (Employee editing)"
    SUBMITTED = "SUBMITTED", "Submitted (Pending Senior Review)"
    REVISION_REQUESTED_BY_SENIOR = (
        "REVISION_REQUESTED_BY_SENIOR",
        "Revision Requested by Senior Officer",
    )
    SENIOR_APPROVED = (
        "SENIOR_APPROVED",
        "Senior Officer Verified (Pending Manager Approval)",
    )
    REVISION_REQUESTED_BY_MANAGER = (
        "REVISION_REQUESTED_BY_MANAGER",
        "Revision Requested by Manager",
    )
    MANAGER_APPROVED = "MANAGER_APPROVED", "Manager Approved"
    DRAFT_ASSESSMENT_GENERATED = (
        "DRAFT_ASSESSMENT_GENERATED",
        "Draft Assessment Generated (Module 1)",
    )
    HVRA_PUBLISHED = "HVRA_PUBLISHED", "HVRA Report Published"
    REJECTED = "REJECTED", "Rejected / Closed"


class IssueTemplate(models.Model):
    """
    Configurable schema template for hazard-specific incident telemetry.
    Allows flood and landslide to define structured fields without
    altering core schema or replacing approved HVRA indicators.
    """
    hazard_type = models.CharField(
        max_length=32, choices=HazardTypeChoices.choices, unique=True
    )
    name = models.CharField(max_length=128)
    version = models.CharField(max_length=16, default="1.0")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    # JSON Schema definition for frontend form rendering & validation:
    # [
    #   {"id": "water_level_m", "label": "Water Level Above Normal", "type": "number", "unit": "meters", "required": True},
    #   {"id": "breach_status", "label": "Embankment Breached?", "type": "boolean", "required": False},
    #   ...
    # ]
    fields_schema = models.JSONField(
        default=list,
        help_text="List of field definitions with labels, input types, units, and validation rules.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "issue_template"
        verbose_name = "Issue Template"
        verbose_name_plural = "Issue Templates"
        ordering = ["hazard_type"]

    def __str__(self):
        return f"{self.name} (v{self.version}) [{self.hazard_type}]"


class IssueReport(models.Model):
    """
    Field incident report created by an employee.
    Progresses through the 3-tier review and approval lifecycle.
    """
    incident_number = models.CharField(
        max_length=40, unique=True, db_index=True, editable=False
    )
    hazard_type = models.CharField(
        max_length=32, choices=HazardTypeChoices.choices, db_index=True
    )
    template = models.ForeignKey(
        IssueTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="issues",
    )

    title = models.CharField(max_length=255)
    description = models.TextField(help_text="Factual field narrative of the occurrence.")
    incident_datetime = models.DateTimeField(help_text="Date and time when incident was observed.")
    severity = models.CharField(
        max_length=16, choices=IssueSeverity.choices, default=IssueSeverity.MEDIUM
    )

    # Submitter & Department
    reported_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="reported_issues",
        help_text="Employee / field officer who logged this report.",
    )
    department = models.CharField(
        max_length=128,
        db_index=True,
        help_text="Originating department (e.g. Water Resources, PWD, Revenue, LSGD).",
    )

    # Geographic Jurisdiction
    latitude = models.FloatField()
    longitude = models.FloatField()
    gps_accuracy_meters = models.FloatField(null=True, blank=True)
    location_name = models.CharField(
        max_length=255,
        help_text="Local landmark, bridge, or riverbank name.",
    )
    state = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="state_issues",
        limit_choices_to={"level": "STATE"},
    )
    district = models.ForeignKey(
        "administration.AdministrativeUnit",
        on_delete=models.PROTECT,
        related_name="district_issues",
        limit_choices_to={"level": "DISTRICT"},
    )
    block = models.ForeignKey(
        "administration.AdministrativeUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="block_issues",
    )
    village = models.ForeignKey(
        "administration.AdministrativeUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="village_issues",
    )

    # Hazard-specific telemetry payload (validated against IssueTemplate)
    hazard_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Key-value pairs corresponding to IssueTemplate schema.",
    )

    # Workflow Status & Stage
    status = models.CharField(
        max_length=32,
        choices=IssueStatus.choices,
        default=IssueStatus.SUBMITTED,
        db_index=True,
    )

    # Feedback / Revision details (Visible to Employee upon return)
    latest_feedback = models.TextField(
        blank=True,
        default="",
        help_text="Specific reasons / corrections required from employee.",
    )
    rejection_reason = models.TextField(blank=True, default="")

    # Assignment & Coordination
    current_assignee = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_issues",
        help_text="Current officer responsible for review or revision.",
    )
    is_cross_departmental = models.BooleanField(
        default=False,
        help_text="True if event spans multiple departments and requires DDMA coordination.",
    )
    coordinated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="coordinated_issues",
        help_text="District Disaster Management Officer coordinating cross-dept actions.",
    )

    # Audit Trail Sign-offs
    submitted_at = models.DateTimeField(null=True, blank=True)
    senior_reviewer = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="senior_reviewed_issues",
    )
    senior_reviewed_at = models.DateTimeField(null=True, blank=True)
    senior_remarks = models.TextField(blank=True, default="")

    manager_approver = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="manager_approved_issues",
    )
    manager_reviewed_at = models.DateTimeField(null=True, blank=True)
    manager_remarks = models.TextField(blank=True, default="")

    # Sample indicator for realistic test suites
    is_demo = models.BooleanField(
        default=False,
        help_text="Labelled sample verification data.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "issue_report"
        verbose_name = "Incident Report"
        verbose_name_plural = "Incident Reports"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.incident_number}] {self.title} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if not self.incident_number:
            prefix = "FLD" if self.hazard_type == HazardTypeChoices.FLOOD else "LND"
            token = uuid.uuid4().hex[:6].upper()
            year = self.incident_datetime.year if self.incident_datetime else 2026
            self.incident_number = f"INC-{year}-{prefix}-{token}"
        super().save(*args, **kwargs)

    @property
    def latest_assessment(self):
        """Returns the linked draft or completed assessment if generated."""
        return self.derived_assessments.first()


class IssueAttachment(models.Model):
    """Photographs, damage surveys, or field sensor captures for an incident."""
    issue = models.ForeignKey(
        IssueReport, on_delete=models.CASCADE, related_name="attachments"
    )
    file = models.FileField(upload_to="issues/attachments/%Y/%m/")
    caption = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(
        max_length=32,
        choices=[
            ("PHOTO", "Site Photograph"),
            ("DOCUMENT", "Official Memo / Survey Sheet"),
            ("SENSOR_LOG", "Telemetry / Gauge Reading"),
        ],
        default="PHOTO",
    )
    uploaded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "issue_attachment"
        verbose_name = "Incident Attachment"
        verbose_name_plural = "Incident Attachments"


class IssueWorkflowLog(models.Model):
    """
    Immutable audit ledger recording every state change, actor, remarks, and timestamp.
    Maintains strict provenance from initial employee report to HVRA publication.
    """
    issue = models.ForeignKey(
        IssueReport, on_delete=models.CASCADE, related_name="workflow_logs"
    )
    action = models.CharField(max_length=48)
    from_status = models.CharField(max_length=32)
    to_status = models.CharField(max_length=32)
    actor = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL
    )
    actor_role = models.CharField(max_length=32, blank=True)
    comments = models.TextField(
        blank=True,
        help_text="Detailed feedback, revision instructions, or endorsement reasons.",
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "issue_workflow_log"
        verbose_name = "Workflow Audit Log"
        verbose_name_plural = "Workflow Audit Logs"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.issue.incident_number} — {self.action} by {self.actor} at {self.created_at}"


class WorkflowAssignmentRule(models.Model):
    """
    Configurable hierarchy & jurisdictional assignment rules.
    Decides who reviews and approves an incident based on department, district, and hazard.
    Falls back cleanly to role-based discovery if no explicit user override is configured.
    """
    name = models.CharField(max_length=128)
    department = models.CharField(
        max_length=128,
        blank=True,
        help_text="Department name. Blank matches all departments in the jurisdiction.",
    )
    hazard_type = models.CharField(
        max_length=32,
        default="ALL",
        help_text="Hazard type or 'ALL' for universal applicability.",
    )
    state = models.ForeignKey(
        "administration.AdministrativeUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="state_workflow_rules",
        limit_choices_to={"level": "STATE"},
    )
    district = models.ForeignKey(
        "administration.AdministrativeUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="district_workflow_rules",
        limit_choices_to={"level": "DISTRICT"},
        help_text="District boundary. Null applies statewide.",
    )

    # Configurable explicit officer overrides (optional)
    senior_reviewer = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_as_senior_reviewer",
        help_text="Explicit senior officer assigned to review this department/district queue.",
    )
    manager_approver = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_as_manager_approver",
        help_text="Explicit manager authorized for final sign-off & draft HVRA generation.",
    )
    cross_dept_coordinator = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_as_coordinator",
        help_text="DDMA coordinator for cross-departmental escalations.",
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workflow_assignment_rule"
        verbose_name = "Workflow Assignment Rule"
        verbose_name_plural = "Workflow Assignment Rules"

    def __str__(self):
        dept = self.department or "All Depts"
        dist = self.district.name if self.district else "Statewide"
        return f"{self.name} ({dist} | {dept})"
