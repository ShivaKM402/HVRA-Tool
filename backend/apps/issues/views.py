"""
apps.issues.views — ViewSets and API handlers for the 3-Tier Issue-to-HVRA Workflow.
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.ai_services.vision import analyze_incident_photo

from .models import (
    IssueTemplate,
    IssueReport,
    IssueAttachment,
    IssueStatus,
    WorkflowAssignmentRule,
)
from .serializers import (
    IssueTemplateSerializer,
    IssueReportListSerializer,
    IssueReportDetailSerializer,
    IssueCreateUpdateSerializer,
    IssueAttachmentSerializer,
    ReviewActionSerializer,
    GenerateAssessmentSerializer,
    PublishHVRASerializer,
    WorkflowAssignmentRuleSerializer,
)
from .services import IssueWorkflowEngine, WorkflowPermissionService


class IssueTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IssueTemplate.objects.filter(is_active=True)
    serializer_class = IssueTemplateSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    @action(detail=False, methods=["get"], url_path="by-hazard")
    def by_hazard(self, request):
        hazard_type = request.query_params.get("hazard_type", "FLOOD").upper()
        template = IssueTemplate.objects.filter(
            hazard_type=hazard_type, is_active=True
        ).first()
        if not template:
            return Response(
                {"detail": f"No active template found for hazard '{hazard_type}'."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = self.get_serializer(template)
        return Response(serializer.data)


class IssueReportViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = IssueReport.objects.select_related(
            "district", "state", "block", "village", "reported_by", "template"
        ).prefetch_related("attachments", "workflow_logs", "derived_assessments")

        # Filters
        hazard_type = self.request.query_params.get("hazard_type")
        if hazard_type:
            qs = qs.filter(hazard_type=hazard_type.upper())

        district_id = self.request.query_params.get("district")
        if district_id:
            qs = qs.filter(district_id=district_id)

        department = self.request.query_params.get("department")
        if department:
            qs = qs.filter(department__iexact=department)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        # Role-based Queues
        queue = self.request.query_params.get("queue")
        if queue == "my_reports":
            # Reports filed by current employee
            qs = qs.filter(reported_by=user)
        elif queue == "senior_review":
            # Issues on senior review desk (pending + approved + revisions so files stay visible)
            if not status_param:
                qs = qs.filter(
                    status__in=[
                        IssueStatus.SUBMITTED,
                        IssueStatus.SENIOR_APPROVED,
                        IssueStatus.REVISION_REQUESTED_BY_SENIOR,
                    ]
                )
            # Filter by territory if user is territory-restricted
            profile = getattr(user, "profile", None)
            if profile and profile.district_id and not user.is_superuser:
                qs = qs.filter(district_id=profile.district_id)
            if profile and profile.department and not profile.can_approve_cross_department and not user.is_superuser:
                qs = qs.filter(department__iexact=profile.department)
        elif queue == "manager_review":
            # Issues pending manager decision or draft generation (approved + revisions remain visible)
            if not status_param:
                qs = qs.filter(
                    status__in=[
                        IssueStatus.SENIOR_APPROVED,
                        IssueStatus.MANAGER_APPROVED,
                        IssueStatus.REVISION_REQUESTED_BY_MANAGER,
                        IssueStatus.DRAFT_ASSESSMENT_GENERATED,
                    ]
                )
            profile = getattr(user, "profile", None)
            if profile and profile.district_id and not user.is_superuser:
                qs = qs.filter(district_id=profile.district_id)
        elif queue == "revisions":
            # Reports that require changes from this employee
            qs = qs.filter(
                reported_by=user,
                status__in=[
                    IssueStatus.REVISION_REQUESTED_BY_SENIOR,
                    IssueStatus.REVISION_REQUESTED_BY_MANAGER,
                ],
            )

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return IssueReportListSerializer
        elif self.action in ["create", "update", "partial_update"]:
            return IssueCreateUpdateSerializer
        return IssueReportDetailSerializer

    def perform_create(self, serializer):
        user = self.request.user
        issue = serializer.save(reported_by=user)
        # Log creation
        IssueWorkflowEngine.submit_issue(
            issue=issue,
            actor=user,
            comments="Field report registered and submitted for review.",
        )

    def perform_update(self, serializer):
        issue = self.get_object()
        # Verify employee is editing allowed states
        if issue.status not in (
            IssueStatus.DRAFT,
            IssueStatus.REVISION_REQUESTED_BY_SENIOR,
            IssueStatus.REVISION_REQUESTED_BY_MANAGER,
        ):
            raise ValidationError(
                f"Incident in state '{issue.get_status_display()}' cannot be modified."
            )
        serializer.save()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Employee submits draft or resubmits revised incident report."""
        issue = self.get_object()
        comments = request.data.get("comments", "Incident submitted for senior review.")
        try:
            IssueWorkflowEngine.submit_issue(issue, request.user, comments)
            return Response(
                IssueReportDetailSerializer(issue, context={"request": request}).data
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="senior-review")
    def senior_review(self, request, pk=None):
        """Senior officer verifies report or requests revision with remarks."""
        issue = self.get_object()
        serializer = ReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_name = serializer.validated_data["action"]
        remarks = serializer.validated_data["remarks"]

        try:
            IssueWorkflowEngine.senior_review(
                issue=issue,
                actor=request.user,
                action=action_name,
                remarks=remarks,
            )
            return Response(
                IssueReportDetailSerializer(issue, context={"request": request}).data
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="manager-review")
    def manager_review(self, request, pk=None):
        """Manager approves incident or returns it for further revision."""
        issue = self.get_object()
        serializer = ReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_name = serializer.validated_data["action"]
        remarks = serializer.validated_data["remarks"]

        try:
            IssueWorkflowEngine.manager_review(
                issue=issue,
                actor=request.user,
                action=action_name,
                remarks=remarks,
            )
            return Response(
                IssueReportDetailSerializer(issue, context={"request": request}).data
            )
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="generate-draft-assessment")
    def generate_draft_assessment(self, request, pk=None):
        """Manager creates a Module 1 Draft Assessment linked to this incident."""
        issue = self.get_object()
        serializer = GenerateAssessmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data.get("assessment_name", "")

        try:
            assessment = IssueWorkflowEngine.generate_draft_assessment(
                issue=issue,
                actor=request.user,
                assessment_name=name,
            )
            return Response({
                "message": "Draft Assessment created successfully.",
                "assessment_id": assessment.id,
                "assessment_name": assessment.name,
                "module_type": assessment.module_type,
                "status": assessment.status,
                "issue": IssueReportDetailSerializer(issue, context={"request": request}).data,
            })
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="publish-hvra")
    def publish_hvra(self, request, pk=None):
        """Authorized manager publishes official statutory report after calculation & review."""
        issue = self.get_object()
        assessment = issue.latest_assessment
        if not assessment:
            return Response(
                {"detail": "No draft assessment exists for this incident."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PublishHVRASerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remarks = serializer.validated_data.get("remarks", "")

        try:
            IssueWorkflowEngine.publish_hvra_report(
                issue=issue,
                assessment=assessment,
                actor=request.user,
                remarks=remarks,
            )
            return Response({
                "message": "Official statutory HVRA report published successfully.",
                "assessment_id": assessment.id,
                "version": assessment.version,
                "is_published": assessment.is_published,
                "issue": IssueReportDetailSerializer(issue, context={"request": request}).data,
            })
        except ValidationError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="upload-attachment")
    def upload_attachment(self, request, pk=None):
        """Uploads photograph or field document for an incident."""
        issue = self.get_object()
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        attachment = IssueAttachment.objects.create(
            issue=issue,
            file=file_obj,
            caption=request.data.get("caption", ""),
            file_type=request.data.get("file_type", "PHOTO"),
            uploaded_by=request.user,
        )
        return Response(
            IssueAttachmentSerializer(attachment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ------------------------------------------------------------------
    # AI Feature 2 — Vision AI Photo Analysis
    # ------------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="analyze-photo")
    def analyze_photo(self, request, pk=None):
        """
        POST /api/issues/{id}/analyze-photo/
        Accepts a field incident photo (multipart/form-data, field: 'image').
        Uses GPT-4o vision to extract severity, water depth, damage type, and description.
        Returns structured JSON for auto-filling the incident report form.
        """
        issue = self.get_object()
        image_file = request.FILES.get("image")
        if not image_file:
            return Response(
                {"error": "No image file provided. Send image as multipart/form-data with field 'image'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate it's an image
        content_type = image_file.content_type or ""
        if not content_type.startswith("image/"):
            return Response(
                {"error": "Uploaded file must be an image (JPEG, PNG, WebP)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Size limit: 10 MB
        if image_file.size > 10 * 1024 * 1024:
            return Response(
                {"error": "Image must be under 10 MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        image_bytes = image_file.read()
        hazard_type = getattr(issue.template, "hazard_type", "FLOOD") if issue.template else "FLOOD"
        result = analyze_incident_photo(image_bytes, hazard_type)

        return Response(result, status=status.HTTP_200_OK)


class WorkflowAssignmentRuleViewSet(viewsets.ModelViewSet):
    queryset = WorkflowAssignmentRule.objects.all()
    serializer_class = WorkflowAssignmentRuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or (hasattr(user, "profile") and user.profile.is_admin()):
            return WorkflowAssignmentRule.objects.all()
        # Non-admins can view active rules
        return WorkflowAssignmentRule.objects.filter(is_active=True)
