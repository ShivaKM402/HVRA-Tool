"""
apps.issues.serializers — Serializers for 3-tier issue-to-HVRA workflow.
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from apps.administration.models import AdministrativeUnit
from .models import (
    IssueTemplate,
    IssueReport,
    IssueAttachment,
    IssueWorkflowLog,
    WorkflowAssignmentRule,
)
from .services import WorkflowPermissionService


class IssueTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueTemplate
        fields = [
            "id",
            "hazard_type",
            "name",
            "version",
            "description",
            "is_active",
            "fields_schema",
            "updated_at",
        ]


class IssueAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.username", read_only=True
    )

    class Meta:
        model = IssueAttachment
        fields = [
            "id",
            "issue",
            "file",
            "caption",
            "file_type",
            "uploaded_by",
            "uploaded_by_name",
            "created_at",
        ]
        read_only_fields = ["uploaded_by", "created_at"]


class IssueWorkflowLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = IssueWorkflowLog
        fields = [
            "id",
            "action",
            "from_status",
            "to_status",
            "actor",
            "actor_name",
            "actor_role",
            "comments",
            "metadata",
            "created_at",
        ]

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.username
        return "System"


class IssueReportListSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(
        source="reported_by.username", read_only=True
    )
    district_name = serializers.CharField(
        source="district.name", read_only=True
    )
    status_label = serializers.CharField(
        source="get_status_display", read_only=True
    )
    severity_label = serializers.CharField(
        source="get_severity_display", read_only=True
    )
    has_derived_assessment = serializers.SerializerMethodField()

    class Meta:
        model = IssueReport
        fields = [
            "id",
            "incident_number",
            "title",
            "hazard_type",
            "severity",
            "severity_label",
            "department",
            "district",
            "district_name",
            "location_name",
            "status",
            "status_label",
            "reported_by",
            "reported_by_name",
            "incident_datetime",
            "created_at",
            "updated_at",
            "has_derived_assessment",
        ]

    def get_has_derived_assessment(self, obj):
        return obj.derived_assessments.exists()


class IssueReportDetailSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.CharField(
        source="reported_by.username", read_only=True
    )
    reported_by_dept = serializers.CharField(
        source="reported_by.profile.department", read_only=True, default=""
    )
    district_name = serializers.CharField(
        source="district.name", read_only=True
    )
    state_name = serializers.CharField(
        source="state.name", read_only=True
    )
    block_name = serializers.CharField(
        source="block.name", read_only=True, default=None
    )
    village_name = serializers.CharField(
        source="village.name", read_only=True, default=None
    )
    status_label = serializers.CharField(
        source="get_status_display", read_only=True
    )
    severity_label = serializers.CharField(
        source="get_severity_display", read_only=True
    )

    template_detail = IssueTemplateSerializer(source="template", read_only=True)
    attachments = IssueAttachmentSerializer(many=True, read_only=True)
    workflow_logs = IssueWorkflowLogSerializer(many=True, read_only=True)

    # Linked assessment summary
    derived_assessment_info = serializers.SerializerMethodField()

    # User permissions on this specific issue
    user_permissions = serializers.SerializerMethodField()

    class Meta:
        model = IssueReport
        fields = [
            "id",
            "incident_number",
            "hazard_type",
            "template",
            "template_detail",
            "title",
            "description",
            "incident_datetime",
            "severity",
            "severity_label",
            "reported_by",
            "reported_by_name",
            "reported_by_dept",
            "department",
            "latitude",
            "longitude",
            "gps_accuracy_meters",
            "location_name",
            "state",
            "state_name",
            "district",
            "district_name",
            "block",
            "block_name",
            "village",
            "village_name",
            "hazard_data",
            "status",
            "status_label",
            "latest_feedback",
            "rejection_reason",
            "current_assignee",
            "is_cross_departmental",
            "coordinated_by",
            "submitted_at",
            "senior_reviewer",
            "senior_reviewed_at",
            "senior_remarks",
            "manager_approver",
            "manager_reviewed_at",
            "manager_remarks",
            "is_demo",
            "attachments",
            "workflow_logs",
            "derived_assessment_info",
            "user_permissions",
            "created_at",
            "updated_at",
        ]

    def get_derived_assessment_info(self, obj):
        assessment = obj.latest_assessment
        if not assessment:
            return None
        return {
            "id": assessment.id,
            "name": assessment.name,
            "module_type": assessment.module_type,
            "status": assessment.status,
            "approval_status": assessment.approval_status,
            "is_published": assessment.is_published,
            "published_at": assessment.published_at,
            "version": assessment.version,
        }

    def get_user_permissions(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return {
                "can_submit": False,
                "can_senior_review": False,
                "can_manager_review": False,
                "can_generate_assessment": False,
            }

        u = request.user
        can_submit = WorkflowPermissionService.can_submit_issue(u, obj)
        can_senior = WorkflowPermissionService.can_senior_review(u, obj)
        can_manager = WorkflowPermissionService.can_manager_review(u, obj)

        return {
            "can_submit": can_submit,
            "can_senior_review": can_senior,
            "can_manager_review": can_manager,
            "can_generate_assessment": can_manager and obj.status in [
                "MANAGER_APPROVED",
                "DRAFT_ASSESSMENT_GENERATED",
            ],
        }


class IssueCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IssueReport
        fields = [
            "id",
            "hazard_type",
            "template",
            "title",
            "description",
            "incident_datetime",
            "severity",
            "department",
            "latitude",
            "longitude",
            "gps_accuracy_meters",
            "location_name",
            "state",
            "district",
            "block",
            "village",
            "hazard_data",
            "is_cross_departmental",
        ]

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data["reported_by"] = user
        # Auto-match department if not provided
        if not validated_data.get("department") and hasattr(user, "profile"):
            validated_data["department"] = user.profile.department or "Disaster Management"
        return super().create(validated_data)


class ReviewActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REQUEST_REVISION"])
    remarks = serializers.CharField(
        min_length=5,
        help_text="Detailed feedback or justification for the decision.",
    )


class GenerateAssessmentSerializer(serializers.Serializer):
    assessment_name = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Custom name for the draft assessment.",
    )


class PublishHVRASerializer(serializers.Serializer):
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Statutory publication remarks.",
    )


class WorkflowAssignmentRuleSerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source="district.name", read_only=True)
    senior_reviewer_name = serializers.CharField(source="senior_reviewer.username", read_only=True)
    manager_approver_name = serializers.CharField(source="manager_approver.username", read_only=True)
    coordinator_name = serializers.CharField(source="cross_dept_coordinator.username", read_only=True)

    class Meta:
        model = WorkflowAssignmentRule
        fields = [
            "id",
            "name",
            "department",
            "hazard_type",
            "state",
            "district",
            "district_name",
            "senior_reviewer",
            "senior_reviewer_name",
            "manager_approver",
            "manager_approver_name",
            "cross_dept_coordinator",
            "coordinator_name",
            "is_active",
            "created_at",
            "updated_at",
        ]
