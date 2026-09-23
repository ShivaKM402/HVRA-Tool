"""Reports URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GeneratedReportViewSet

router = DefaultRouter()
router.register(r"reports", GeneratedReportViewSet, basename="report")

urlpatterns = [
    path("", include(router.urls)),
]
