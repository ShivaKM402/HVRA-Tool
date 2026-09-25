"""
Datasets views — data source catalogue and file upload.
"""
import os
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from apps.accounts.permissions import CanContributeData
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
    # Write-protected: signed-in, non-Viewer roles only (HVRA §2).
    permission_classes = [CanContributeData]

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

        # If valid, automatically create DataSource and HazardLayer for immediate use in assessments
        data_source_id = None
        if dataset.status == "VALID":
            import json
            from .models import DataSource
            from apps.hazards.models import HazardLayer

            ds = DataSource.objects.create(
                name=f"{dataset.name} (Custom Upload)",
                organization=dataset.organization or "User Upload",
                description=dataset.description or f"Custom user-uploaded {dataset.file_format} dataset ({dataset.record_count or 0} records)",
                vintage=dataset.vintage or "2024",
                is_builtin=False,
                is_demo=False,
                metadata={"uploaded_dataset_id": dataset.id, "format": dataset.file_format}
            )
            data_source_id = ds.id

            if dataset.file_format == "GEOJSON":
                try:
                    dataset.file.seek(0)
                    gj_data = json.loads(dataset.file.read().decode("utf-8"))
                    HazardLayer.objects.create(
                        name=f"{dataset.name} [Custom Layer]",
                        hazard_type=dataset.hazard_type or "FLOOD",
                        geometry_type="POLYGON",
                        source="User Upload",
                        organization=dataset.organization or "Uploaded by User",
                        vintage=dataset.vintage or "2024",
                        is_demo=False,
                        geometry_geojson=json.dumps(gj_data)
                    )
                except Exception:
                    pass

        out_serializer = UploadedDatasetSerializer(dataset)
        return Response(
            {
                "success": True,
                "message": "Dataset uploaded and validated.",
                "dataset": out_serializer.data,
                "data_source_id": data_source_id,
            },
            status=status.HTTP_201_CREATED,
        )
