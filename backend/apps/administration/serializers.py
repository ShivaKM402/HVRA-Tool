"""Administration serializers"""
from rest_framework import serializers
from .models import AdministrativeUnit


class AdministrativeUnitSerializer(serializers.ModelSerializer):
    parent_name = serializers.SerializerMethodField()
    parent_id = serializers.SerializerMethodField()

    class Meta:
        model = AdministrativeUnit
        fields = [
            "id",
            "name",
            "code",
            "level",
            "parent_id",
            "parent_name",
            "area_sqkm",
            "centroid_lat",
            "centroid_lon",
            "is_demo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_parent_name(self, obj):
        return obj.parent.name if obj.parent else None

    def get_parent_id(self, obj):
        return obj.parent.id if obj.parent else None


class AdministrativeUnitGeoSerializer(AdministrativeUnitSerializer):
    """Extended serializer that includes geometry for map rendering."""
    geometry = serializers.SerializerMethodField()

    class Meta(AdministrativeUnitSerializer.Meta):
        fields = AdministrativeUnitSerializer.Meta.fields + ["geometry"]

    def get_geometry(self, obj):
        return obj.geometry
