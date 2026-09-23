"""Administration URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AdministrativeUnitViewSet

router = DefaultRouter()
router.register(r"admin-units", AdministrativeUnitViewSet, basename="admin-unit")

# Convenience top-level paths
urlpatterns = [
    path("", include(router.urls)),
    path("states/", AdministrativeUnitViewSet.as_view({"get": "states"}), name="states"),
    path("districts/", AdministrativeUnitViewSet.as_view({"get": "districts"}), name="districts"),
    path("blocks/", AdministrativeUnitViewSet.as_view({"get": "blocks"}), name="blocks"),
]
