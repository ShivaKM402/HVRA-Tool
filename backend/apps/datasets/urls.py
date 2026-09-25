"""Datasets URLs"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DataSourceViewSet, UploadedDatasetViewSet, DatasetUploadView

router = DefaultRouter()
router.register(r"data-sources", DataSourceViewSet, basename="data-source")
router.register(r"datasets", UploadedDatasetViewSet, basename="dataset")

urlpatterns = [
    # NOTE: must be declared *before* the router include, otherwise the
    # viewset's `datasets/<pk>/` detail route matches pk="upload" and the
    # upload endpoint returns 405 Method Not Allowed.
    path("datasets/upload/", DatasetUploadView.as_view(), name="dataset-upload"),
    path("", include(router.urls)),
]
