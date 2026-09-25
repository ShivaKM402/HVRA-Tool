"""
HVRA Digital Tool — API URL Router
All API endpoints are prefixed with /api/
"""
from django.urls import path, include
from config.views import health_check

urlpatterns = [
    # Health check
    path("health/", health_check, name="health-check"),

    # Administration
    path("", include("apps.administration.urls")),

    # Accounts (RBAC / user management — HVRA Section 2)
    path("", include("apps.accounts.urls")),

    # Hazards
    path("", include("apps.hazards.urls")),

    # Datasets
    path("", include("apps.datasets.urls")),

    # Assessments
    path("", include("apps.assessments.urls")),

    # Reports
    path("", include("apps.reports.urls")),
]
