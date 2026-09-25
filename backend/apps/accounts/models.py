"""
accounts models — Role-based access control (HVRA spec Section 2 & 10).

Roles follow the concept note:
  PLATFORM_ADMIN     — State-level administrators; manage users, libraries, approvals.
  STATE_OFFICIAL     — State-level disaster management officers.
  DISTRICT_OFFICIAL  — District-level officers (assess their own districts).
  ANALYST            — Technical / GIS analysts (read + run assessments).
  VIEWER            — Other users; view published maps and reports.
"""
from django.contrib.auth.models import User
from django.db import models


class UserRole(models.TextChoices):
    PLATFORM_ADMIN = "PLATFORM_ADMIN", "Platform Admin"
    STATE_OFFICIAL = "STATE_OFFICIAL", "State Official"
    DISTRICT_OFFICIAL = "DISTRICT_OFFICIAL", "District Official"
    ANALYST = "ANALYST", "Analyst"
    VIEWER = "VIEWER", "Viewer"  # Other users — view published outputs


class UserProfile(models.Model):
    """Extends the Django auth User with an HVRA role + organisation."""
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="profile"
    )
    role = models.CharField(
        max_length=24, choices=UserRole.choices, default=UserRole.VIEWER
    )
    organization = models.CharField(max_length=255, blank=True)
    district = models.ForeignKey(
        "administration.AdministrativeUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="officer_profiles",
        help_text="Default district for DISTRICT_OFFICIAL users.",
    )
    state = models.ForeignKey(
        "administration.AdministrativeUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="state_officer_profiles",
        help_text="Territory state for STATE_OFFICIAL users (blank = all states).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "user_profile"
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def role_label(self):
        return self.get_role_display()

    def is_admin(self):
        return (
            self.role == UserRole.PLATFORM_ADMIN
            or self.user.is_staff
            or self.user.is_superuser
        )

    # ------------------------------------------------------------------
    # Territorial RBAC (HVRA §2) — state / district scoping helpers.
    # STATE_OFFICIAL  → restricted to `state` (or derived from district).
    # DISTRICT_OFFICIAL → restricted to `district` (state derived).
    # ------------------------------------------------------------------
    def is_territory_restricted(self):
        """True when the user's role binds them to a state/district territory."""
        return self.role in (UserRole.STATE_OFFICIAL, UserRole.DISTRICT_OFFICIAL)

    @property
    def territory_state(self):
        """Resolve the state this user's territory belongs to."""
        if self.state_id:
            return self.state
        if self.district_id and self.district.level == "DISTRICT":
            return self.district.parent
        return None

    @property
    def territory_state_id(self):
        st = self.territory_state
        return st.id if st else None

    @property
    def territory_district_id(self):
        return self.district_id if self.district_id else None

    def territory_contains(self, unit):
        """True when `unit` (district/block/village) lies inside this user's territory."""
        if not self.is_territory_restricted():
            return True
        if not unit:
            return True
        if self.role == UserRole.STATE_OFFICIAL:
            s_id = self.territory_state_id
            if not s_id:
                return True  # state official with no territory = unrestricted
            if unit.level == "STATE":
                return unit.id == s_id
            if unit.level == "DISTRICT":
                return unit.parent_id == s_id
            if unit.parent_id is not None and unit.parent.level == "DISTRICT":
                return unit.parent.parent_id == s_id
            return unit.parent.parent_id == s_id
        if self.role == UserRole.DISTRICT_OFFICIAL:
            d_id = self.territory_district_id
            if not d_id:
                return True
            if unit.level == "DISTRICT":
                return unit.id == d_id
            return unit.parent_id == d_id or unit.parent.parent_id == d_id
        return True