"""
Datasets views — data source catalogue and file upload.
"""
import os
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from .models import DataSource, UploadedDataset
from .serializers import DataSourceSerializer, UploadedDatasetSerializer, DatasetUploadSerializer
from .validators import DatasetValidator


ALLOWED_EXTENSIONS = {".csv", ".geojson", ".json", ".zip"}
MAX_UPLOAD_BYTES = getattr(settings, "MAX_UPLOAD_SIZE_MB", 50) * 1024 * 1024


class DataSourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer


class UploadedDatasetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UploadedDataset.objects.all()
    serializer_class = UploadedDatasetSerializer


class DatasetUploadView(APIView):
    """
    Upload a dataset file (CSV, GeoJSON, or Shapefile ZIP).
    Validates:
    - File extension
    - File size
    - File content (format-specific)
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = DatasetUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": True, "message": "Invalid request.", "detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": True, "message": "No file provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate extension
        ext = os.path.splitext(uploaded_file.name)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {
                    "error": True,
                    "message": f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate size
        if uploaded_file.size > MAX_UPLOAD_BYTES:
            return Response(
                {
                    "error": True,
                    "message": f"File exceeds maximum size of {settings.MAX_UPLOAD_SIZE_MB} MB.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine format
        format_map = {
            ".csv": "CSV",
            ".geojson": "GEOJSON",
            ".json": "GEOJSON",
            ".zip": "SHAPEFILE",
        }
        file_format = format_map[ext]

        # Create record
        dataset = UploadedDataset.objects.create(
            name=serializer.validated_data["name"],
            file=uploaded_file,
            file_format=file_format,
            file_size_bytes=uploaded_file.size,
            hazard_type=serializer.validated_data.get("hazard_type", ""),
            data_type=serializer.validated_data.get("data_type", ""),
            description=serializer.validated_data.get("description", ""),
            source=serializer.validated_data.get("source", ""),
            organization=serializer.validated_data.get("organization", ""),
            vintage=serializer.validated_data.get("vintage", ""),
            uploaded_by=request.user if request.user.is_authenticated else None,
            status="PENDING",
        )

        # Run validation
        validator = DatasetValidator(dataset)
        validator.validate()

        out_serializer = UploadedDatasetSerializer(dataset)
        return Response(
            {
                "success": True,
                "message": "Dataset uploaded and validated.",
                "dataset": out_serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )
