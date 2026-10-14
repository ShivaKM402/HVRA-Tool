"""Custom DRF permissions mirroring the HVRA role model."""
from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """
    Allows access only to Platform Admin users (or staff/superuser).
    Used for: user management, library management, Task Force approvals.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        if profile is None:
            return False
        from .models import UserRole
        return profile.role == UserRole.PLATFORM_ADMIN


class IsTaskForceReviewer(BasePermission):
    """
    Task Force reviewer: platform admins + state officials may submit/approve/reject.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        if profile is None:
            return False
        from .models import UserRole
        return profile.role in (UserRole.PLATFORM_ADMIN, UserRole.STATE_OFFICIAL)


class CanContributeData(BasePermission):
    """
    Data contribution (dataset upload, saved queries, running assessments):
    any signed-in role except the read-only VIEWER (HVRA §2 — "Viewer: other
    users, view published maps and reports").

    In prototype / DEBUG mode, unauthenticated users are permitted so that
    exploratory assessments and demo runs operate without friction.
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            # Allow unauthenticated data contribution for open prototype and test suite
            return True
        if user.is_staff or user.is_superuser:
            return True
        profile = getattr(user, "profile", None)
        if profile is None:
            return False
        from .models import UserRole
        return profile.role != UserRole.VIEWER


def user_can_delete(user):
    """
    Disaster Management Governance Deletion Rule:
    Line-department employees (DEPARTMENT_OFFICER), senior employees (SENIOR_OFFICER),
    managers (MANAGER), and viewers (VIEWER) are STRICTLY FORBIDDEN from deleting
    assessments, reports, datasets, and queries.

    Only District Administrators (DISTRICT_OFFICIAL), State Administrators (PLATFORM_ADMIN,
    STATE_OFFICIAL), or superusers/staff have deletion authorization.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    profile = getattr(user, "profile", None)
    if not profile:
        return False
    from .models import UserRole
    # Employees and senior employees can NEVER delete records
    if profile.role in (
        UserRole.DEPARTMENT_OFFICER,
        UserRole.SENIOR_OFFICER,
        UserRole.MANAGER,
        UserRole.VIEWER,
    ):
        return False
    return profile.role in (
        UserRole.PLATFORM_ADMIN,
        UserRole.STATE_OFFICIAL,
        UserRole.DISTRICT_OFFICIAL,
    )


class CanDeleteRecord(BasePermission):
    """
    DRF permission class denying delete privileges to employees and non-admin users.
    """

    def has_permission(self, request, view):
        if getattr(view, "action", "") == "destroy" or request.method == "DELETE":
            return user_can_delete(request.user)
        return True