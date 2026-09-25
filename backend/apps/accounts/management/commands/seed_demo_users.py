"""
Management command: seed_demo_users

Seeds clearly-labelled DEMO users covering each HVRA role (HVRA §2 / §10):

  admin        / admin123    → PLATFORM_ADMIN  (user management, approvals)
  state        / state123    → STATE_OFFICIAL  (scoped to the seeded state)
  ernakulam    / district123 → DISTRICT_OFFICIAL (scoped to Ernakulam district)
  analyst      / analyst123  → ANALYST
  viewer       / viewer123   → VIEWER

Territory scoping (HVRA §2) is applied to the state/district officials so the
"scoped to your territory" behaviour is visible straight after seeding.

All passwords are prototype credentials for demonstration only.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import UserProfile, UserRole
from apps.administration.models import AdministrativeUnit

User = get_user_model()

# (username, password, first, last, role, organization, territory district name or None)
DEMO_USERS = [
    ("admin", "admin123", "Platform", "Administrator", UserRole.PLATFORM_ADMIN, "KSDMA", None),
    ("state", "state123", "State", "Official", UserRole.STATE_OFFICIAL, "KSDMA", None),
    ("ernakulam", "district123", "Ernakulam", "District", UserRole.DISTRICT_OFFICIAL, "DDMA Ernakulam", "Ernakulam"),
    ("analyst", "analyst123", "GIS", "Analyst", UserRole.ANALYST, "SEOC", None),
    ("viewer", "viewer123", "Public", "Viewer", UserRole.VIEWER, "Citizen", None),
]


class Command(BaseCommand):
    help = "Seed DEMO users for every HVRA role (prototype credentials)."

    def _resolve_territory(self, role, district_name):
        """Return (state, district) for a territory-scoped role (HVRA §2)."""
        district = None
        if role == UserRole.DISTRICT_OFFICIAL:
            if district_name:
                district = AdministrativeUnit.objects.filter(
                    level="DISTRICT", name__icontains=district_name
                ).first()
            if district is None:
                district = AdministrativeUnit.objects.filter(level="DISTRICT").order_by("id").first()
            return (district.parent if district else None), district
        if role == UserRole.STATE_OFFICIAL:
            state = AdministrativeUnit.objects.filter(level="STATE").order_by("id").first()
            return state, None
        return None, None

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for username, password, first, last, role, org, district_name in DEMO_USERS:
            user, was_created = User.objects.get_or_create(
                username=username,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "email": f"{username}@hvra-demo.in",
                    "is_staff": role == UserRole.PLATFORM_ADMIN,
                },
            )
            if was_created:
                user.set_password(password)
                user.save()
                created += 1
            else:
                user.first_name = first
                user.last_name = last
                user.is_staff = role == UserRole.PLATFORM_ADMIN
                user.save()
                updated += 1
            state, district = self._resolve_territory(role, district_name)
            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "role": role,
                    "organization": org,
                    "state": state,
                    "district": district,
                },
            )
        self.stdout.write(self.style.SUCCESS(
            f"Demo users ready: {created} created, {updated} updated. "
            "Credentials: admin/admin123, state/state123, ernakulam/district123, "
            "analyst/analyst123, viewer/viewer123."
        ))
