"""Territorial RBAC helpers (HVRA §2).

Shared by every app so list/read endpoints apply the same scope as writes:

  STATE_OFFICIAL    → rows whose district sits inside the assigned state
  DISTRICT_OFFICIAL → rows whose district is the assigned district

Platform admins, staff, analysts, viewers and anonymous callers are
unrestricted. An officer with no territory assigned is unrestricted too (the
Settings page flags them as "unassigned").
"""
from apps.accounts.models import UserRole


def territory_profile(user):
    """Return the caller's UserProfile when they are territory-scoped, else None."""
    if not (user and user.is_authenticated) or user.is_staff or user.is_superuser:
        return None
    profile = getattr(user, "profile", None)
    if not profile or not profile.is_territory_restricted():
        return None
    if profile.role == UserRole.STATE_OFFICIAL and not profile.territory_state_id:
        return None
    if profile.role == UserRole.DISTRICT_OFFICIAL and not profile.territory_district_id:
        return None
    return profile


def district_ids_in_territory(profile):
    """District ids inside the profile's territory (None => unrestricted)."""
    if profile is None:
        return None
    from apps.administration.models import AdministrativeUnit

    if profile.role == UserRole.STATE_OFFICIAL:
        return list(
            AdministrativeUnit.objects
            .filter(level="DISTRICT", parent_id=profile.territory_state_id)
            .values_list("id", flat=True)
        )
    return [profile.territory_district_id]


def unit_ids_in_territory(profile):
    """Administrative-unit ids (district + descendants) inside the territory."""
    if profile is None:
        return None
    from apps.administration.models import AdministrativeUnit

    if profile.role == UserRole.STATE_OFFICIAL:
        s_id = profile.territory_state_id
        return list(
            AdministrativeUnit.objects.filter(
                models_q_state(s_id)
            ).values_list("id", flat=True)
        )
    d_id = profile.territory_district_id
    return list(
        AdministrativeUnit.objects.filter(
            id=d_id
        ).values_list("id", flat=True)
    ) + list(
        AdministrativeUnit.objects.filter(
            parent_id=d_id
        ).values_list("id", flat=True)
    ) + list(
        AdministrativeUnit.objects.filter(
            parent__parent_id=d_id
        ).values_list("id", flat=True)
    )


def models_q_state(state_id):
    """Q covering the state, its districts, blocks and villages."""
    from django.db.models import Q

    return (
        Q(id=state_id)
        | Q(parent_id=state_id)
        | Q(parent__parent_id=state_id)
        | Q(parent__parent__parent_id=state_id)
    )


def scope_district_qs(qs, user, field="district_id"):
    """Restrict a queryset of district-scoped rows to the caller's territory."""
    profile = territory_profile(user)
    if profile is None:
        return qs
    ids = district_ids_in_territory(profile)
    return qs.filter(**{f"{field}__in": ids or []})


def scope_unit_qs(qs, user, field="administrative_unit_id"):
    """Restrict a queryset of unit-scoped rows (events, units…) to the territory."""
    profile = territory_profile(user)
    if profile is None:
        return qs
    ids = unit_ids_in_territory(profile)
    return qs.filter(**{f"{field}__in": ids or []})
