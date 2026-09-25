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
        return profile.role != UserRole.VIEWER