"""Datasets URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DataSourceViewSet, UploadedDatasetViewSet, DatasetUploadView

router = DefaultRouter()
router.register(r"data-sources", DataSourceViewSet, basename="data-source")
router.register(r"datasets", UploadedDatasetViewSet, basename="dataset")

urlpatterns = [
    path("", include(router.urls)),
    path("datasets/upload/", DatasetUploadView.as_view(), name="dataset-upload"),
]
