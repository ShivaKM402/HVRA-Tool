"""
apps.issues.services — Workflow engine and business logic for 3-tier issue-to-HVRA pipeline.
"""
from django.utils import timezone
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User

from apps.accounts.models import UserProfile, UserRole
from apps.assessments.models import Assessment, AssessmentStatus, ModuleTypeChoices
from .models import (
    IssueReport,
    IssueStatus,
    IssueWorkflowLog,
    WorkflowAssignmentRule,
)


class WorkflowPermissionService:
    """Evaluates role-based and territorial permissions for issue lifecycle transitions."""

    @staticmethod
    def can_submit_issue(user: User, issue: IssueReport) -> bool:
        """Any authenticated user (or reporting officer) can submit their own draft."""
        if user.is_superuser or user.profile.is_admin():
            return True
        return issue.reported_by_id == user.id

    @staticmethod
    def can_senior_review(user: User, issue: IssueReport) -> bool:
        """
        Senior officers review incidents within their authorized department and territory.
        DDMA officers or Admins can also review.
        """
        if user.is_superuser or user.profile.is_admin():
            return True

        profile = getattr(user, "profile", None)
        if not profile:
            return False

        # Explicit rule match takes precedence
        rule = WorkflowAssignmentRule.objects.filter(
            is_active=True,
            senior_reviewer=user,
        ).filter(
            models.Q(district=issue.district) | models.Q(district__isnull=True),
            models.Q(department=issue.department) | models.Q(department=""),
        ).first()
        if rule:
            return True

        # Role-based review
        if profile.is_senior_officer or profile.can_review_issues:
            # Check department match
            if profile.department and profile.department.lower().strip() != issue.department.lower().strip():
                # Allow if cross-department coordinator
                if not profile.can_approve_cross_department and not profile.is_ddma_coordinator:
                    return False

            # Check territorial jurisdiction
            if profile.district_id and profile.district_id != issue.district_id:
                return False

            return True

        # District disaster coordinator can review
        if profile.is_ddma_coordinator:
            if profile.district_id and profile.district_id != issue.district_id:
                return False
            return True

        return False

    @staticmethod
    def can_manager_review(user: User, issue: IssueReport) -> bool:
        """
        Managers have explicit approval permissions.
        Can be configured via WorkflowAssignmentRule or via UserProfile.is_manager.
        """
        if user.is_superuser or user.profile.is_admin():
            return True

        profile = getattr(user, "profile", None)
        if not profile:
            return False

        # Explicit rule match
        rule = WorkflowAssignmentRule.objects.filter(
            is_active=True,
            manager_approver=user,
        ).filter(
            models.Q(district=issue.district) | models.Q(district__isnull=True),
        ).first()
        if rule:
            return True

        # Role-based manager authorization
        if profile.is_manager or profile.can_approve_hvra:
            if profile.district_id and profile.district_id != issue.district_id:
                return False
            return True

        return False


class IssueWorkflowEngine:
    """Executes state machine transitions with mandatory audit logging and validation."""

    @staticmethod
    @transaction.atomic
    def submit_issue(issue: IssueReport, actor: User, comments: str = "Initial submission from field."):
        """Employee submits a draft or resubmits after addressing revision comments."""
        if not WorkflowPermissionService.can_submit_issue(actor, issue):
            raise ValidationError("You do not have permission to submit this incident report.")

        from_status = issue.status
        if from_status not in (
            IssueStatus.DRAFT,
            IssueStatus.REVISION_REQUESTED_BY_SENIOR,
            IssueStatus.REVISION_REQUESTED_BY_MANAGER,
        ):
            raise ValidationError(f"Cannot submit an incident in state '{issue.get_status_display()}'.")

        issue.status = IssueStatus.SUBMITTED
        issue.submitted_at = timezone.now()
        issue.latest_feedback = ""  # Reset active revision request
        issue.save()

        # Find assigned senior reviewer if available
        rule = WorkflowAssignmentRule.objects.filter(
            is_active=True,
            district=issue.district,
            department=issue.department,
        ).first()
        if rule and rule.senior_reviewer:
            issue.current_assignee = rule.senior_reviewer
            issue.save(update_fields=["current_assignee"])

        IssueWorkflowLog.objects.create(
            issue=issue,
            action="SUBMITTED" if from_status == IssueStatus.DRAFT else "RESUBMITTED",
            from_status=from_status,
            to_status=issue.status,
            actor=actor,
            actor_role=getattr(getattr(actor, "profile", None), "role", "EMPLOYEE"),
            comments=comments,
        )
        return issue

    @staticmethod
    @transaction.atomic
    def senior_review(
        issue: IssueReport,
        actor: User,
        action: str,  # "APPROVE" | "REQUEST_REVISION"
        remarks: str,
    ):
        """
        Senior Officer verifies field report or returns it to employee with mandatory reasons.
        """
        if not WorkflowPermissionService.can_senior_review(actor, issue):
            raise ValidationError("You do not have permission to review this department/district incident.")

        if issue.status != IssueStatus.SUBMITTED:
            raise ValidationError("Only incidents in SUBMITTED state can be reviewed by Senior Officers.")

        if not remarks or len(remarks.strip()) < 5:
            raise ValidationError("Detailed remarks or revision instructions (minimum 5 characters) are required.")

        from_status = issue.status
        action = action.upper().strip()

        if action == "REQUEST_REVISION":
            issue.status = IssueStatus.REVISION_REQUESTED_BY_SENIOR
            issue.latest_feedback = remarks
            issue.current_assignee = issue.reported_by
            log_action = "REVISION_REQUESTED_BY_SENIOR"
        elif action == "APPROVE":
            issue.status = IssueStatus.SENIOR_APPROVED
            issue.senior_reviewer = actor
            issue.senior_reviewed_at = timezone.now()
            issue.senior_remarks = remarks
            log_action = "SENIOR_APPROVED"

            # Assign to manager if configured
            rule = WorkflowAssignmentRule.objects.filter(
                is_active=True,
                district=issue.district,
            ).first()
            if rule and rule.manager_approver:
                issue.current_assignee = rule.manager_approver
        else:
            raise ValidationError(f"Unsupported senior review action '{action}'. Choose APPROVE or REQUEST_REVISION.")

        issue.save()

        IssueWorkflowLog.objects.create(
            issue=issue,
            action=log_action,
            from_status=from_status,
            to_status=issue.status,
            actor=actor,
            actor_role="SENIOR_OFFICER",
            comments=remarks,
        )
        return issue

    @staticmethod
    @transaction.atomic
    def manager_review(
        issue: IssueReport,
        actor: User,
        action: str,  # "APPROVE" | "REQUEST_REVISION"
        remarks: str,
    ):
        """
        Manager reviews the senior-approved incident.
        Can request revision (sent back to employee or senior) or approve for HVRA generation.
        """
        if not WorkflowPermissionService.can_manager_review(actor, issue):
            raise ValidationError("You do not have Manager-level approval permissions for this jurisdiction.")

        if issue.status != IssueStatus.SENIOR_APPROVED:
            raise ValidationError("Only incidents with Senior Officer approval can be evaluated by Managers.")

        if not remarks or len(remarks.strip()) < 5:
            raise ValidationError("Detailed remarks (minimum 5 characters) are required for Manager decisions.")

        from_status = issue.status
        action = action.upper().strip()

        if action == "REQUEST_REVISION":
            issue.status = IssueStatus.REVISION_REQUESTED_BY_MANAGER
            issue.latest_feedback = remarks
            issue.current_assignee = issue.reported_by
            log_action = "REVISION_REQUESTED_BY_MANAGER"
        elif action == "APPROVE":
            issue.status = IssueStatus.MANAGER_APPROVED
            issue.manager_approver = actor
            issue.manager_reviewed_at = timezone.now()
            issue.manager_remarks = remarks
            log_action = "MANAGER_APPROVED"
        else:
            raise ValidationError(f"Unsupported manager action '{action}'. Choose APPROVE or REQUEST_REVISION.")

        issue.save()

        IssueWorkflowLog.objects.create(
            issue=issue,
            action=log_action,
            from_status=from_status,
            to_status=issue.status,
            actor=actor,
            actor_role="MANAGER",
            comments=remarks,
        )
        return issue

    @staticmethod
    @transaction.atomic
    def generate_draft_assessment(issue: IssueReport, actor: User, assessment_name: str = "") -> Assessment:
        """
        Creates a Module 1 (Single-Module Hazard Assessment) in DRAFT state linked to the incident.
        DOES NOT directly publish a statutory report.
        Statutory publication requires subsequent GIS indicator calculation and official sign-off.
        """
        if not WorkflowPermissionService.can_manager_review(actor, issue):
            raise ValidationError("Only authorized managers can generate a draft HVRA assessment from this incident.")

        if issue.status not in (IssueStatus.MANAGER_APPROVED, IssueStatus.DRAFT_ASSESSMENT_GENERATED):
            raise ValidationError("Incident must be approved by the Manager before generating a draft assessment.")

        name = assessment_name or f"Assessment derived from {issue.incident_number}: {issue.title[:60]}"
        
        # Check if already generated
        existing = issue.derived_assessments.first()
        if existing:
            return existing

        assessment = Assessment.objects.create(
            name=name,
            description=(
                f"Generated from verified field incident {issue.incident_number} "
                f"reported by {issue.reported_by.username} ({issue.department}) on {issue.incident_datetime.strftime('%Y-%m-%d %H:%M')}.\n\n"
                f"Ground observations: {issue.description}\n"
                f"Location: {issue.location_name} (Lat: {issue.latitude:.4f}, Lon: {issue.longitude:.4f})"
            ),
            module_type=ModuleTypeChoices.HAZARD,
            hazard_type=issue.hazard_type,
            state=issue.state,
            district=issue.district,
            administrative_level="BLOCK",
            status=AssessmentStatus.DRAFT,
            approval_status="PENDING",
            originating_issue=issue,
            created_by=actor,
            configuration_snapshot={
                "originating_incident_number": issue.incident_number,
                "incident_severity": issue.severity,
                "incident_coordinates": [issue.longitude, issue.latitude],
                "hazard_telemetry": issue.hazard_data,
                "workflow_provenance": {
                    "reported_by": issue.reported_by.username,
                    "senior_reviewer": issue.senior_reviewer.username if issue.senior_reviewer else None,
                    "manager_approver": issue.manager_approver.username if issue.manager_approver else actor.username,
                },
            },
        )

        from_status = issue.status
        issue.status = IssueStatus.DRAFT_ASSESSMENT_GENERATED
        issue.save(update_fields=["status"])

        IssueWorkflowLog.objects.create(
            issue=issue,
            action="DRAFT_ASSESSMENT_GENERATED",
            from_status=from_status,
            to_status=issue.status,
            actor=actor,
            actor_role="MANAGER",
            comments=f"Generated draft Module 1 Hazard Assessment #{assessment.id}: '{assessment.name}'.",
            metadata={"assessment_id": assessment.id},
        )
        return assessment

    @staticmethod
    @transaction.atomic
    def publish_hvra_report(issue: IssueReport, assessment: Assessment, actor: User, remarks: str = ""):
        """
        Formally publishes the statutory HVRA assessment report after validation.
        Maintains versioning and updates issue status to HVRA_PUBLISHED.
        """
        if not WorkflowPermissionService.can_manager_review(actor, issue):
            raise ValidationError("You do not have publication authority.")

        assessment.is_published = True
        assessment.published_at = timezone.now()
        assessment.published_by = actor
        assessment.approval_status = "APPROVED"
        assessment.reviewer_name = actor.get_full_name() or actor.username
        assessment.reviewer_org = getattr(getattr(actor, "profile", None), "organization", "DDMA")
        assessment.review_comment = remarks or "Statutory report validated and published by authorized manager."
        assessment.reviewed_at = timezone.now()
        assessment.save()

        from_status = issue.status
        issue.status = IssueStatus.HVRA_PUBLISHED
        issue.save(update_fields=["status"])

        IssueWorkflowLog.objects.create(
            issue=issue,
            action="HVRA_PUBLISHED",
            from_status=from_status,
            to_status=issue.status,
            actor=actor,
            actor_role="MANAGER",
            comments=remarks or "Official statutory HVRA report published.",
            metadata={"assessment_id": assessment.id, "version": assessment.version},
        )
        return assessment
