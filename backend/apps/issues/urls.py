from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IssueTemplateViewSet,
    IssueReportViewSet,
    WorkflowAssignmentRuleViewSet,
)

router = DefaultRouter()
router.register(r"issues/templates", IssueTemplateViewSet, basename="issue-template")
router.register(r"issues/assignment-rules", WorkflowAssignmentRuleViewSet, basename="workflow-assignment-rule")
router.register(r"issues", IssueReportViewSet, basename="issue-report")

urlpatterns = [
    path("", include(router.urls)),
]
