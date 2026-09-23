"""Administration views"""
from django.db import models
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AdministrativeUnit
from .serializers import AdministrativeUnitSerializer, AdministrativeUnitGeoSerializer


class AdministrativeUnitViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for administrative units.
    Supports filtering by level, parent, district, and state.
    """
    queryset = AdministrativeUnit.objects.select_related("parent", "parent__parent").all()
    serializer_class = AdministrativeUnitSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "level", "area_sqkm"]
    ordering = ["level", "name"]

    def get_queryset(self):
        qs = super().get_queryset()
        level = self.request.query_params.get("level")
        parent = self.request.query_params.get("parent")
        district = self.request.query_params.get("district")
        state = self.request.query_params.get("state")

        if level:
            qs = qs.filter(level=level.upper())

        if parent:
            if parent.isdigit():
                qs = qs.filter(parent_id=int(parent))
            else:
                qs = qs.filter(
                    models.Q(parent__code__iexact=parent) |
                    models.Q(parent__name__icontains=parent)
                )

        if district:
            if district.isdigit():
                d_id = int(district)
                qs = qs.filter(models.Q(id=d_id) | models.Q(parent_id=d_id))
            else:
                qs = qs.filter(
                    models.Q(name__icontains=district) |
                    models.Q(code__iexact=district) |
                    models.Q(parent__name__icontains=district) |
                    models.Q(parent__code__iexact=district)
                )

        if state:
            if state.isdigit():
                s_id = int(state)
                qs = qs.filter(
                    models.Q(id=s_id) |
                    models.Q(parent_id=s_id) |
                    models.Q(parent__parent_id=s_id)
                )
            else:
                qs = qs.filter(
                    models.Q(name__icontains=state) |
                    models.Q(code__iexact=state) |
                    models.Q(parent__name__icontains=state) |
                    models.Q(parent__code__iexact=state) |
                    models.Q(parent__parent__name__icontains=state)
                )

        return qs

    @action(detail=True, methods=["get"])
    def geo(self, request, pk=None):
        """Return unit with geometry for map rendering."""
        unit = self.get_object()
        serializer = AdministrativeUnitGeoSerializer(unit)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def children(self, request, pk=None):
        """Return direct children of this unit."""
        unit = self.get_object()
        children = AdministrativeUnit.objects.filter(parent=unit)
        level = request.query_params.get("level")
        if level:
            children = children.filter(level=level.upper())
        serializer = self.get_serializer(children, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def states(self, request):
        """Convenience: list states."""
        qs = self.get_queryset().filter(level="STATE")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def districts(self, request):
        """Convenience: list districts, optionally filtered by state."""
        qs = self.get_queryset().filter(level="DISTRICT")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def blocks(self, request):
        """Convenience: list blocks, optionally filtered by district."""
        qs = self.get_queryset().filter(level="BLOCK")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def geojson(self, request):
        """Return units as a GeoJSON FeatureCollection."""
        qs = self.get_queryset()

        features = []
        for unit in qs:
            if unit.geometry_geojson:
                features.append(unit.to_geojson_feature())

        return Response(
            {
                "type": "FeatureCollection",
                "features": features,
                "count": len(features),
            }
        )

