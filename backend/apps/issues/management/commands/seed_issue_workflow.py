"""
Management command to seed configurable Issue Templates, 3-tier users,
assignment rules, and realistic sample incidents.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

from apps.accounts.models import UserProfile, UserRole
from apps.administration.models import AdministrativeUnit
from apps.issues.models import (
    IssueTemplate,
    IssueReport,
    IssueStatus,
    IssueSeverity,
    IssueWorkflowLog,
    WorkflowAssignmentRule,
    HazardTypeChoices,
)


class Command(BaseCommand):
    help = "Seed configurable issue templates, 3-tier user hierarchy, assignment rules, and sample incidents."

    def handle(self, *args, **options):
        self.stdout.write("Starting 3-tier issue workflow seeding...")

        # 1. Fetch geographic scope
        state = AdministrativeUnit.objects.filter(level="STATE", name__icontains="Kerala").first()
        if not state:
            state = AdministrativeUnit.objects.filter(level="STATE").first()

        kottayam = AdministrativeUnit.objects.filter(level="DISTRICT", name__icontains="Kottayam").first()
        if not kottayam:
            kottayam = AdministrativeUnit.objects.filter(level="DISTRICT").first()

        if not kottayam or not state:
            self.stderr.write("Missing State or Kottayam District in database.")
            return

        # 2. Seed Configurable Issue Templates
        flood_template, _ = IssueTemplate.objects.update_or_create(
            hazard_type=HazardTypeChoices.FLOOD,
            defaults={
                "name": "Official Flood Incident Telemetry Template",
                "version": "1.0",
                "description": "Configurable field template for ground riverine & urban flood incidents.",
                "is_active": True,
                "fields_schema": [
                    {
                        "id": "water_body_name",
                        "label": "Water Body / River Basin",
                        "type": "text",
                        "placeholder": "e.g. Meenachil River / Kuttanad Canal",
                        "required": True,
                    },
                    {
                        "id": "water_level_above_normal_m",
                        "label": "Water Level Above Normal / Danger Mark (m)",
                        "type": "number",
                        "unit": "meters",
                        "min": 0,
                        "step": 0.1,
                        "required": True,
                    },
                    {
                        "id": "inundation_extent",
                        "label": "Inundation Character",
                        "type": "select",
                        "options": [
                            {"value": "STREET_PUDDLING", "label": "Localized street waterlogging"},
                            {"value": "RESIDENTIAL_MAROONED", "label": "Residential pocket marooned / isolated"},
                            {"value": "AGRICULTURAL_SUBMERGED", "label": "Paddy / Agricultural tracts submerged"},
                            {"value": "RIVER_OVERTOPPING", "label": "Riverbank overtopping into settlement"},
                        ],
                        "required": True,
                    },
                    {
                        "id": "embankment_breached",
                        "label": "Flood Bund / Embankment Breached?",
                        "type": "boolean",
                        "required": False,
                    },
                    {
                        "id": "breach_length_m",
                        "label": "Breach Width (meters)",
                        "type": "number",
                        "unit": "meters",
                        "required": False,
                    },
                    {
                        "id": "water_trend",
                        "label": "Water Trend",
                        "type": "select",
                        "options": [
                            {"value": "RISING", "label": "Rising Steadily"},
                            {"value": "STABLE", "label": "Stationary / Peak Level"},
                            {"value": "RECEDING", "label": "Receding"},
                        ],
                        "required": True,
                    },
                    {
                        "id": "lifelines_threatened",
                        "label": "Critical Lifelines Threatened",
                        "type": "multiselect",
                        "options": [
                            {"value": "HIGHWAY", "label": "State / National Highway"},
                            {"value": "DRINKING_WATER", "label": "Water Treatment / Pumping Station"},
                            {"value": "ELECTRICAL_SUBSTATION", "label": "KSEB Substation / Transformer"},
                            {"value": "HOSPITAL", "label": "Hospital / Primary Health Centre"},
                        ],
                        "required": False,
                    },
                    {
                        "id": "approx_affected_population",
                        "label": "Approximate Population Directly Affected",
                        "type": "number",
                        "min": 0,
                        "required": False,
                    },
                ],
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Template ready: {flood_template.name}"))

        landslide_template, _ = IssueTemplate.objects.update_or_create(
            hazard_type=HazardTypeChoices.LANDSLIDE,
            defaults={
                "name": "Official Landslide & Slope Instability Template",
                "version": "1.0",
                "description": "Configurable field template for slope movements, debris flows, and tension cracks.",
                "is_active": True,
                "fields_schema": [
                    {
                        "id": "slope_failure_type",
                        "label": "Slope Failure Typology",
                        "type": "select",
                        "options": [
                            {"value": "DEBRIS_FLOW", "label": "Debris Flow / Torrent"},
                            {"value": "ROCKFALL", "label": "Rockfall / Detached Boulder"},
                            {"value": "ROTATIONAL_SLIP", "label": "Rotational Soil Slip"},
                            {"value": "TENSION_CRACKS", "label": "Tension Cracks / Ground Subsidence"},
                        ],
                        "required": True,
                    },
                    {
                        "id": "debris_volume_m3",
                        "label": "Estimated Debris Volume (m³)",
                        "type": "number",
                        "unit": "cubic meters",
                        "required": False,
                    },
                    {
                        "id": "road_connectivity_blocked",
                        "label": "Road / Lifeline Connectivity Severed?",
                        "type": "boolean",
                        "required": True,
                    },
                    {
                        "id": "road_chainage",
                        "label": "Road Name / Chainage Location",
                        "type": "text",
                        "placeholder": "e.g. SH-8 Km 38.5 near Teekoy bridge",
                        "required": False,
                    },
                    {
                        "id": "active_movement_observed",
                        "label": "Active Soil / Rock Movement Observed Currently?",
                        "type": "boolean",
                        "required": True,
                    },
                    {
                        "id": "tension_cracks_detected",
                        "label": "Tension Cracks Present in Upper Slope?",
                        "type": "boolean",
                        "required": True,
                    },
                    {
                        "id": "houses_damaged_or_threatened",
                        "label": "Number of Houses Damaged / in High Risk Zone",
                        "type": "number",
                        "min": 0,
                        "required": False,
                    },
                    {
                        "id": "rainfall_duration_hours",
                        "label": "Antecedent Rainfall Duration (hours)",
                        "type": "number",
                        "unit": "hours",
                        "required": False,
                    },
                ],
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Template ready: {landslide_template.name}"))

        # 3. Helper to create or update users with proper profiles
        def get_or_create_user(username, email, role, department, org, district_obj, can_review=False, can_approve=False, can_coord=False):
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "is_active": True},
            )
            user.set_password("password123")
            user.save()

            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = role
            profile.department = department
            profile.organization = org
            profile.district = district_obj
            profile.state = state
            profile.can_review_issues = can_review
            profile.can_approve_hvra = can_approve
            profile.can_approve_cross_department = can_coord
            profile.save()
            return user

        # Tier 1 (Employees / Field Officers)
        u_water = get_or_create_user(
            "water_dept", "water@kottayam.gov.in",
            UserRole.DEPARTMENT_OFFICER, "Water Resources",
            "Water Resources Department (Irrigation)", kottayam
        )
        u_pwd = get_or_create_user(
            "pwd_dept", "pwd@kottayam.gov.in",
            UserRole.DEPARTMENT_OFFICER, "Public Works Department (PWD)",
            "PWD Roads Division", kottayam
        )
        u_soil = get_or_create_user(
            "soil_dept", "soil@kottayam.gov.in",
            UserRole.DEPARTMENT_OFFICER, "Mining & Geology",
            "Department of Mining & Geology / Soil Conservation", kottayam
        )

        # Tier 2 (Senior Officers / Reviewers)
        u_senior_water = get_or_create_user(
            "senior_irrigation", "senior.water@kottayam.gov.in",
            UserRole.SENIOR_OFFICER, "Water Resources",
            "Irrigation Division (Executive Engineer)", kottayam,
            can_review=True
        )
        u_senior_pwd = get_or_create_user(
            "senior_pwd", "senior.pwd@kottayam.gov.in",
            UserRole.SENIOR_OFFICER, "Public Works Department (PWD)",
            "PWD Division (Executive Engineer Roads)", kottayam,
            can_review=True
        )
        u_senior_soil = get_or_create_user(
            "senior_geologist", "senior.geology@kottayam.gov.in",
            UserRole.SENIOR_OFFICER, "Mining & Geology",
            "District Geologist Office", kottayam,
            can_review=True
        )

        # Tier 2.5 (District Disaster Management Officer / Coordinator)
        u_ddma = get_or_create_user(
            "ddma_coordinator", "ddma@kottayam.gov.in",
            UserRole.DISTRICT_OFFICIAL, "Disaster Management",
            "District Disaster Management Authority (DDMA DEOC)", kottayam,
            can_coord=True, can_review=True
        )

        # Tier 3 (Manager / Authorizing Authority)
        u_manager = get_or_create_user(
            "manager_kottayam", "manager.dm@kottayam.gov.in",
            UserRole.MANAGER, "Disaster Management",
            "District Collectorate / DDMA Approvals", kottayam,
            can_approve=True
        )

        self.stdout.write(self.style.SUCCESS("3-Tier user accounts successfully configured."))

        # 4. Seed Configurable Workflow Assignment Rules
        WorkflowAssignmentRule.objects.update_or_create(
            name="Kottayam Water Resources Flood Verification Rule",
            defaults={
                "department": "Water Resources",
                "hazard_type": HazardTypeChoices.FLOOD,
                "state": state,
                "district": kottayam,
                "senior_reviewer": u_senior_water,
                "manager_approver": u_manager,
                "cross_dept_coordinator": u_ddma,
                "is_active": True,
            },
        )
        WorkflowAssignmentRule.objects.update_or_create(
            name="Kottayam PWD Infrastructure & Landslide Rule",
            defaults={
                "department": "Public Works Department (PWD)",
                "hazard_type": HazardTypeChoices.LANDSLIDE,
                "state": state,
                "district": kottayam,
                "senior_reviewer": u_senior_pwd,
                "manager_approver": u_manager,
                "cross_dept_coordinator": u_ddma,
                "is_active": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("Configurable Assignment Rules registered."))

        # 5. Seed Realistic, Clearly Labelled Sample Incidents
        now = timezone.now()

        # Sample 1: Exactly ONE Single Flood Incident - SUBMITTED (Ready for Senior Review)
        inc1, created1 = IssueReport.objects.update_or_create(
            title="Riverbank Overtopping & Bund Weakening - Pazhukkanila / Meenachil River",
            defaults={
                "hazard_type": HazardTypeChoices.FLOOD,
                "template": flood_template,
                "description": (
                    "Meenachil river water level rose 2.2m above danger mark following 48 hours of intense precipitation. "
                    "Seepage and progressive piping detected at Pazhukkanila earthen bund chainage Km 4+200. "
                    "Immediate reinforcement and sandbagging underway by local irrigation field crew."
                ),
                "incident_datetime": now - timedelta(hours=6),
                "severity": IssueSeverity.HIGH,
                "reported_by": User.objects.get(username="analyst"),
                "department": "Water Resources",
                "latitude": 9.5915,
                "longitude": 76.5222,
                "gps_accuracy_meters": 4.5,
                "location_name": "Pazhukkanila Earthen Bund, Meenachil Basin, Kottayam",
                "state": state,
                "district": kottayam,
                "status": IssueStatus.SUBMITTED,
                "submitted_at": now - timedelta(hours=5),
                "current_assignee": u_senior_water,
                "hazard_data": {
                    "water_level_above_danger_m": 2.2,
                    "embankment_breached": False,
                    "water_trend": "RISING",
                    "critical_lifelines_threatened": ["STATE_HIGHWAY", "DRINKING_WATER_INTAKE"],
                    "population_affected_est": 420,
                    "pumps_deployed": 4,
                },
                "is_demo": False,
            },
        )
        if created1 or not inc1.workflow_logs.filter(action="SUBMITTED").exists():
            IssueWorkflowLog.objects.create(
                issue=inc1,
                action="SUBMITTED",
                from_status=IssueStatus.DRAFT,
                to_status=IssueStatus.SUBMITTED,
                actor=User.objects.get(username="analyst"),
                actor_role="ANALYST",
                comments="Initial flood overtopping survey submitted for Senior Officer technical verification.",
                created_at=now - timedelta(hours=5),
            )

        # Sample 2: Landslide - REVISION_REQUESTED_BY_SENIOR (Demonstrating feedback loop back to employee)
        inc2, created = IssueReport.objects.update_or_create(
            title="[SAMPLE] Slope Slip & Road Blockage - Teekoy Ghat Road",
            defaults={
                "hazard_type": HazardTypeChoices.LANDSLIDE,
                "template": landslide_template,
                "description": (
                    "Slope failure and debris slide blocking both lanes on Teekoy-Vagamon ghat corridor. "
                    "Approx 350 m³ of soil and weathered boulders deposited on carriage way. "
                    "Tension crack observed along upper slope edge."
                ),
                "incident_datetime": now - timedelta(hours=18),
                "severity": IssueSeverity.HIGH,
                "reported_by": u_pwd,
                "department": "Public Works Department (PWD)",
                "latitude": 9.7210,
                "longitude": 76.8420,
                "gps_accuracy_meters": 5.0,
                "location_name": "Teekoy-Vagamon Road Km 14.4, Teekoy, Kottayam",
                "state": state,
                "district": kottayam,
                "status": IssueStatus.REVISION_REQUESTED_BY_SENIOR,
                "submitted_at": now - timedelta(hours=16),
                "current_assignee": u_pwd,
                "latest_feedback": (
                    "Please specify chainage accurately between Km 14.2 and 14.8, verify whether heavy "
                    "earthmover clearing is currently safe given active tension crack movement, "
                    "and attach ground photographs of the upper crown."
                ),
                "hazard_data": {
                    "slope_failure_type": "DEBRIS_FLOW",
                    "debris_volume_m3": 350,
                    "road_connectivity_blocked": True,
                    "road_chainage": "Km 14.4 Teekoy Ghat",
                    "active_movement_observed": True,
                    "tension_cracks_detected": True,
                    "houses_damaged_or_threatened": 2,
                    "rainfall_duration_hours": 36,
                },
                "is_demo": False,
            },
        )
        if created or not inc2.workflow_logs.filter(action="REVISION_REQUESTED_BY_SENIOR").exists():
            IssueWorkflowLog.objects.create(
                issue=inc2,
                action="SUBMITTED",
                from_status=IssueStatus.DRAFT,
                to_status=IssueStatus.SUBMITTED,
                actor=u_pwd,
                actor_role="DEPARTMENT_OFFICER",
                comments="Initial road blockage survey submitted.",
                created_at=now - timedelta(hours=16),
            )
            IssueWorkflowLog.objects.create(
                issue=inc2,
                action="REVISION_REQUESTED_BY_SENIOR",
                from_status=IssueStatus.SUBMITTED,
                to_status=IssueStatus.REVISION_REQUESTED_BY_SENIOR,
                actor=u_senior_pwd,
                actor_role="SENIOR_OFFICER",
                comments=(
                    "Please specify chainage accurately between Km 14.2 and 14.8, verify whether heavy "
                    "earthmover clearing is currently safe given active tension crack movement, "
                    "and attach ground photographs of the upper crown."
                ),
                created_at=now - timedelta(hours=10),
            )

        self.stdout.write(self.style.SUCCESS("Sample field incidents successfully seeded!"))
        self.stdout.write(self.style.SUCCESS(f"  Incident: {inc2.incident_number} [{inc2.get_status_display()}]"))
