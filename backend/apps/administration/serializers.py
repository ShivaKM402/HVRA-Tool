"""Administration serializers"""
import re
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


class CreateDistrictSerializer(serializers.Serializer):
    """
    User-friendly serializer for creating a new district from the frontend.
    Non-technical users only need to provide name + state_id.
    Code is auto-generated. District is always marked as is_demo=True.
    """
    name = serializers.CharField(
        max_length=255,
        help_text="Name of the district, e.g. 'Wayanad'"
    )
    state_id = serializers.IntegerField(
        help_text="ID of the parent state"
    )
    centroid_lat = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text="Optional: approximate latitude of the district centre"
    )
    centroid_lon = serializers.FloatField(
        required=False,
        allow_null=True,
        help_text="Optional: approximate longitude of the district centre"
    )

    def validate_state_id(self, value):
        try:
            state = AdministrativeUnit.objects.get(id=value, level="STATE")
        except AdministrativeUnit.DoesNotExist:
            raise serializers.ValidationError("State not found. Please select a valid state.")
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("District name cannot be empty.")
        if len(value) < 2:
            raise serializers.ValidationError("District name must be at least 2 characters.")
        return value

    def _generate_code(self, state_obj, name):
        """Auto-generate a unique code like KL_WAYANAD_USER"""
        state_code = re.sub(r'[^A-Z]', '', state_obj.code.upper())[:3]
        name_part = re.sub(r'[^A-Z]', '', name.upper())[:10]
        base_code = f"{state_code}_{name_part}_USER"
        # Ensure uniqueness
        code = base_code
        counter = 1
        while AdministrativeUnit.objects.filter(code=code).exists():
            code = f"{base_code}_{counter}"
            counter += 1
        return code

    def create(self, validated_data):
        state = AdministrativeUnit.objects.get(id=validated_data['state_id'], level="STATE")
        name = validated_data['name']

        # Check if district with this name already exists under this state
        existing = AdministrativeUnit.objects.filter(
            name__iexact=name,
            level="DISTRICT",
            parent=state
        ).first()
        if existing:
            raise serializers.ValidationError({
                "name": f"A district named '{name}' already exists under {state.name}."
            })

        code = self._generate_code(state, name)

        district = AdministrativeUnit.objects.create(
            name=name,
            code=code,
            level="DISTRICT",
            parent=state,
            centroid_lat=validated_data.get('centroid_lat'),
            centroid_lon=validated_data.get('centroid_lon'),
            is_demo=True,
        )
        return district
