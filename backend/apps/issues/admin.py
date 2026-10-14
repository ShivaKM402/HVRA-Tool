from django.contrib import admin
from .models import (
    IssueTemplate,
    IssueReport,
    IssueAttachment,
    IssueWorkflowLog,
    WorkflowAssignmentRule,
)


@admin.register(IssueTemplate)
class IssueTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "hazard_type", "version", "is_active", "updated_at")
    list_filter = ("hazard_type", "is_active")
    search_fields = ("name", "description")


class IssueAttachmentInline(admin.TabularInline):
    model = IssueAttachment
    extra = 0
    readonly_fields = ("created_at",)


class IssueWorkflowLogInline(admin.TabularInline):
    model = IssueWorkflowLog
    extra = 0
    readonly_fields = (
        "action",
        "from_status",
        "to_status",
        "actor",
        "actor_role",
        "comments",
        "created_at",
    )
    can_delete = False


@admin.register(IssueReport)
class IssueReportAdmin(admin.ModelAdmin):
    list_display = (
        "incident_number",
        "title",
        "hazard_type",
        "severity",
        "department",
        "district",
        "status",
        "reported_by",
        "incident_datetime",
    )
    list_filter = (
        "hazard_type",
        "status",
        "severity",
        "department",
        "district",
        "is_cross_departmental",
    )
    search_fields = ("incident_number", "title", "description", "location_name")
    readonly_fields = (
        "incident_number",
        "created_at",
        "updated_at",
        "submitted_at",
        "senior_reviewed_at",
        "manager_reviewed_at",
    )
    inlines = [IssueAttachmentInline, IssueWorkflowLogInline]


@admin.register(IssueWorkflowLog)
class IssueWorkflowLogAdmin(admin.ModelAdmin):
    list_display = (
        "issue",
        "action",
        "from_status",
        "to_status",
        "actor",
        "actor_role",
        "created_at",
    )
    list_filter = ("action", "actor_role")
    search_fields = ("issue__incident_number", "comments")


@admin.register(WorkflowAssignmentRule)
class WorkflowAssignmentRuleAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "department",
        "hazard_type",
        "district",
        "senior_reviewer",
        "manager_approver",
        "is_active",
    )
    list_filter = ("hazard_type", "department", "is_active")
    search_fields = ("name", "department")
