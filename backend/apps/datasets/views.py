"""
Datasets views — data source catalogue and file upload.
"""
import os
import json
import csv
import io
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.utils import timezone
from apps.accounts.permissions import CanContributeData
from .models import DataSource, UploadedDataset
from .serializers import DataSourceSerializer, UploadedDatasetSerializer, DatasetUploadSerializer
from .validators import DatasetValidator


ALLOWED_EXTENSIONS = {".csv", ".geojson", ".json", ".zip"}
MAX_UPLOAD_BYTES = getattr(settings, "MAX_UPLOAD_SIZE_MB", 50) * 1024 * 1024


class DataSourceViewSet(viewsets.ModelViewSet):
    queryset = DataSource.objects.all()
    serializer_class = DataSourceSerializer
    permission_classes = [CanContributeData]

    def perform_destroy(self, instance):
        from apps.accounts.permissions import user_can_delete
        if not user_can_delete(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Employees and non-administrative officers are not authorized to delete data sources."
            )
        # Also clean up any auto-created hazard layers for this data source
        from apps.hazards.models import HazardLayer
        HazardLayer.objects.filter(name__icontains=instance.name).delete()
        instance.delete()

    @action(detail=True, methods=["post"])
    def send_to_reviewer(self, request, pk=None):
        """Dispatch a spatial layer or dataset dossier to a senior officer or manager."""
        ds = self.get_object()
        sent_to = request.data.get("sent_to") or "Senior Department Reviewer (Level 2 Technical Review)"
        note = request.data.get("note", "")
        urgency = request.data.get("urgency", "ROUTINE")
        reviewer_org = request.data.get("reviewer_org") or "Kerala State Disaster Management Authority"
        custom_recipient = request.data.get("custom_recipient")
        attachment_name = request.data.get("attachment_name")

        sender = "GIS Specialist"
        if getattr(request, "user", None) and request.user.is_authenticated:
            sender = request.user.get_full_name() or request.user.username

        meta = ds.metadata if isinstance(ds.metadata, dict) else {}
        dispatches = list(meta.get("dispatches", []))
        dispatch_record = {
            "id": len(dispatches) + 1,
            "dispatched_at": timezone.now().isoformat(),
            "sent_to": sent_to,
            "sender": sender,
            "note": note,
            "urgency": urgency,
            "reviewer_org": reviewer_org,
            "custom_recipient": custom_recipient,
            "attachment_name": attachment_name,
            "status": "DISPATCHED",
        }
        dispatches.append(dispatch_record)
        meta["dispatches"] = dispatches
        meta["last_dispatch"] = dispatch_record
        ds.metadata = meta
        ds.save(update_fields=["metadata", "updated_at"])

        return Response({
            "message": f"Dataset '{ds.name}' successfully dispatched to {sent_to}.",
            "dispatch": dispatch_record,
            "dataset": DataSourceSerializer(ds).data,
        })

    @action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        """Return rich geospatial features and attribute records for this DataSource."""
        ds = self.get_object()
        features = []
        record_count = 0
        geometry_type = "POLYGON"
        properties_keys = []
        raw_geojson = None

        # 1. Check if linked to UploadedDataset
        uploaded_id = ds.metadata.get("uploaded_dataset_id") if isinstance(ds.metadata, dict) else None
        ud = None
        if uploaded_id:
            ud = UploadedDataset.objects.filter(id=uploaded_id).first()
        if not ud and not ds.is_builtin:
            clean = ds.name.replace(" (Custom Upload)", "").replace(" [DEMO]", "").strip()
            ud = UploadedDataset.objects.filter(name__icontains=clean).first() or UploadedDataset.objects.first()

        if ud and ud.file:
            try:
                ud.file.seek(0)
                content = ud.file.read().decode("utf-8", errors="ignore")
                if ud.file_format == "GEOJSON" or ud.file.name.endswith((".geojson", ".json")):
                    data = json.loads(content)
                    raw_geojson = data
                    features = data.get("features", [])
                    record_count = len(features)
                elif ud.file_format == "CSV" or ud.file.name.endswith(".csv"):
                    reader = csv.DictReader(io.StringIO(content))
                    rows = list(reader)
                    record_count = len(rows)
                    features = [
                        {"type": "Feature", "properties": row, "geometry": None}
                        for row in rows[:50]
                    ]
            except Exception:
                pass

        # 2. Check if Historical Events
        if not features and ("historical" in ds.name.lower() or "event" in ds.name.lower()):
            from apps.hazards.models import HazardEvent
            events = HazardEvent.objects.select_related("administrative_unit")[:50]
            record_count = HazardEvent.objects.count()
            geometry_type = "POINT"
            features = [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [float(e.longitude), float(e.latitude)]
                    },
                    "properties": {
                        "id": e.id,
                        "event_date": e.event_date.isoformat() if e.event_date else None,
                        "unit": e.administrative_unit.name.replace(" [DEMO]", "") if e.administrative_unit else "Kottayam",
                        "hazard": e.hazard_type,
                        "magnitude": e.magnitude,
                        "loss_crore": e.loss,
                        "description": e.description[:80] if e.description else "Historical incident record",
                    }
                }
                for e in events
            ]

        # 3. Check if Administrative Boundaries
        if not features and ("administrative" in ds.name.lower() or "boundary" in ds.name.lower()):
            from apps.administration.models import AdministrativeUnit
            units = AdministrativeUnit.objects.filter(level="BLOCK")[:30]
            record_count = AdministrativeUnit.objects.filter(level="BLOCK").count()
            features = []
            for u in units:
                geom = None
                if u.geometry_geojson:
                    try:
                        geom = json.loads(u.geometry_geojson)
                    except Exception:
                        pass
                features.append({
                    "type": "Feature",
                    "geometry": geom or {
                        "type": "Point",
                        "coordinates": [float(u.centroid_lon or 76.5), float(u.centroid_lat or 9.6)]
                    },
                    "properties": {
                        "id": u.id,
                        "name": u.name.replace(" [DEMO]", ""),
                        "code": u.code,
                        "level": u.level,
                        "area_sqkm": float(u.area_sqkm or 0),
                    }
                })

        # 4. Check if linked to HazardLayer by matching name
        if not features:
            from apps.hazards.models import HazardLayer
            clean_name = ds.name.replace(" [DEMO]", "").replace(" (Custom Upload)", "").strip()
            hl = HazardLayer.objects.filter(
                Q(name__icontains=clean_name) | Q(name__icontains="Kottayam")
            ).first()
            if hl and hl.geometry_geojson:
                try:
                    geom = json.loads(hl.geometry_geojson)
                    raw_geojson = geom
                    if geom.get("type") == "FeatureCollection":
                        features = geom.get("features", [])
                    elif geom.get("type") == "Feature":
                        features = [geom]
                    else:
                        features = [{"type": "Feature", "geometry": geom, "properties": {"name": hl.name, "hazard_type": hl.hazard_type}}]
                    record_count = len(features)
                    geometry_type = hl.geometry_type or "POLYGON"
                except Exception:
                    pass

        # Derive properties keys & geometry types
        if features:
            for f in features:
                if f.get("properties"):
                    for k in f["properties"].keys():
                        if k not in properties_keys:
                            properties_keys.append(k)
                if f.get("geometry") and isinstance(f["geometry"], dict) and f["geometry"].get("type"):
                    geometry_type = f["geometry"]["type"]

        return Response({
            "id": ds.id,
            "name": ds.name,
            "organization": ds.organization,
            "vintage": ds.vintage,
            "record_count": record_count or len(features),
            "geometry_type": geometry_type,
            "properties_keys": properties_keys[:12],
            "features_preview": features[:50],
            "raw_geojson": raw_geojson,
        })


class UploadedDatasetViewSet(viewsets.ModelViewSet):
    queryset = UploadedDataset.objects.all()
    serializer_class = UploadedDatasetSerializer
    permission_classes = [CanContributeData]

    def perform_destroy(self, instance):
        from apps.accounts.permissions import user_can_delete
        if not user_can_delete(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                "Employees and non-administrative officers are not authorized to delete uploaded datasets."
            )
        if instance.file:
            try:
                instance.file.delete(save=False)
            except Exception:
                pass
        instance.delete()


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
