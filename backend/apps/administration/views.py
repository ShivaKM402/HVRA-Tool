"""Administration views"""
from django.db import models
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AdministrativeUnit
from .serializers import (
    AdministrativeUnitSerializer,
    AdministrativeUnitGeoSerializer,
    CreateDistrictSerializer,
)


def _territory_filter(request, qs, level=None):
    """Restrict admin-unit lookups to the caller's state/district territory.

    HVRA §2 — STATE_OFFICIAL users see only their state's units; DISTRICT_OFFICIAL
    users see only their own district (and its blocks/villages). Platform admins,
    analysts, viewers and anonymous callers are unrestricted.
    """
    user = request.user
    if not (user and user.is_authenticated) or user.is_staff or user.is_superuser:
        return qs
    profile = getattr(user, "profile", None)
    if not profile or not profile.is_territory_restricted():
        return qs

    from apps.accounts.models import UserRole

    if profile.role == UserRole.DISTRICT_OFFICIAL:
        d_id = profile.territory_district_id
        if not d_id:
            return qs
        if level == "DISTRICT":
            return qs.filter(id=d_id)
        if level == "BLOCK":
            return qs.filter(parent_id=d_id)
        if level == "VILLAGE":
            return qs.filter(parent__parent_id=d_id)
        if level == "STATE":
            return qs.filter(id__in=AdministrativeUnit.objects.filter(
                children__id=d_id, level="STATE"
            ).values("id"))
        # generic: the district plus everything beneath it
        return qs.filter(
            models.Q(id=d_id)
            | models.Q(parent_id=d_id)
            | models.Q(parent__parent_id=d_id)
        )

    if profile.role == UserRole.STATE_OFFICIAL:
        s_id = profile.territory_state_id
        if not s_id:
            return qs
        if level == "STATE":
            return qs.filter(id=s_id)
        if level == "DISTRICT":
            return qs.filter(parent_id=s_id)
        if level == "BLOCK":
            return qs.filter(parent__parent_id=s_id)
        if level == "VILLAGE":
            return qs.filter(parent__parent__parent_id=s_id)
        return qs.filter(
            models.Q(id=s_id)
            | models.Q(parent_id=s_id)
            | models.Q(parent__parent_id=s_id)
            | models.Q(parent__parent__parent_id=s_id)
        )
    return qs


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

        # Territorial RBAC (HVRA §2): restrict non-admin territorial roles.
        qs = _territory_filter(self.request, qs, level=level or None)

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
        qs = _territory_filter(request, self.get_queryset(), level="STATE").filter(level="STATE")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def districts(self, request):
        """Convenience: list districts, optionally filtered by state."""
        qs = _territory_filter(request, self.get_queryset(), level="DISTRICT").filter(level="DISTRICT")
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def blocks(self, request):
        """Convenience: list blocks, optionally filtered by district."""
        qs = _territory_filter(request, self.get_queryset(), level="BLOCK").filter(level="BLOCK")
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

    @action(detail=False, methods=["post"], url_path="create-district")
    def create_district(self, request):
        """
        User-friendly endpoint: create a new district from the frontend UI.

        Flow:
        1. User sends { "name": "Thrissur", "state_id": 1 }
        2. Backend checks if that district already exists (from seed data)
           - If YES → returns the existing district (with all its talukas already there)
           - If NO  → creates it fresh + auto-creates talukas from Kerala reference data
        3. Returns the district so the frontend can immediately select it.
        """
        from apps.administration.management.commands.seed_kerala_hierarchy import KERALA_HIERARCHY

        serializer = CreateDistrictSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        name = serializer.validated_data["name"].strip()
        state_id = serializer.validated_data["state_id"]

        try:
            state = AdministrativeUnit.objects.get(id=state_id, level="STATE")
        except AdministrativeUnit.DoesNotExist:
            return Response(
                {"success": False, "errors": {"state_id": ["State not found."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Check if this district already exists in the database
        existing = AdministrativeUnit.objects.filter(
            level="DISTRICT",
            parent=state,
            name__iexact=name,
        ).first()

        if not existing:
            # Also fuzzy-check by stripping spaces and case
            existing = AdministrativeUnit.objects.filter(
                level="DISTRICT",
                parent=state,
            ).filter(
                name__icontains=name
            ).first()

        if existing:
            # District already seeded — just return it (blocks already exist)
            out = AdministrativeUnitSerializer(
                AdministrativeUnit.objects.select_related("parent", "parent__parent").get(pk=existing.pk)
            )
            block_count = AdministrativeUnit.objects.filter(parent=existing, level="BLOCK").count()
            return Response(
                {
                    "success": True,
                    "district": out.data,
                    "message": f"'{existing.name}' already exists with {block_count} talukas/blocks. Selected it for you!",
                    "blocks_auto_added": block_count,
                    "already_existed": True,
                },
                status=status.HTTP_200_OK,
            )

        # 2. District doesn't exist — create it and auto-populate blocks from Kerala reference
        district = serializer.save()

        # Find this district in the Kerala reference hierarchy
        ref_talukas = []
        for ref_dist in KERALA_HIERARCHY["districts"]:
            if ref_dist["name"].lower() == name.lower() or name.lower() in ref_dist["name"].lower():
                ref_talukas = ref_dist["talukas"]
                # Also update centroid from reference data
                AdministrativeUnit.objects.filter(pk=district.pk).update(
                    centroid_lat=ref_dist["centroid_lat"],
                    centroid_lon=ref_dist["centroid_lon"],
                )
                break

        # Auto-create talukas from reference data
        blocks_created = 0
        for taluka in ref_talukas:
            _, created = AdministrativeUnit.objects.get_or_create(
                code=taluka["code"],
                defaults={
                    "name": taluka["name"],
                    "level": "BLOCK",
                    "parent": district,
                    "centroid_lat": district.centroid_lat,
                    "centroid_lon": district.centroid_lon,
                    "is_demo": True,
                },
            )
            if created:
                blocks_created += 1

        out = AdministrativeUnitSerializer(
            AdministrativeUnit.objects.select_related("parent", "parent__parent").get(pk=district.pk)
        )
        return Response(
            {
                "success": True,
                "district": out.data,
                "message": (
                    f"'{district.name}' added with {blocks_created} talukas auto-populated!"
                    if blocks_created
                    else f"'{district.name}' added. No matching talukas found in reference data — please add data manually."
                ),
                "blocks_auto_added": blocks_created,
                "already_existed": False,
            },
            status=status.HTTP_201_CREATED,
        )

