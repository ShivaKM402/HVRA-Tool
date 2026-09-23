"""
HVRA Digital Tool — Core views
"""
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import django
import sys


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint.
    Returns system status, version, and database connectivity.
    """
    db_status = "connected"
    try:
        connection.ensure_connection()
    except Exception as e:
        db_status = f"error: {str(e)}"

    return Response(
        {
            "status": "ok",
            "service": "HVRA Digital Tool API",
            "version": "1.0.0-prototype",
            "prototype": True,
            "database": db_status,
            "database_engine": "SQLite",
            "python_version": sys.version,
            "django_version": django.get_version(),
            "note": (
                "This is a prototype system. "
                "All demo data is clearly labelled as DEMO DATA."
            ),
        }
    )
