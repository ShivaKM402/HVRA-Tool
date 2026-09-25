"""accounts serializers — registration, login, profile and user management."""
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.administration.models import AdministrativeUnit
from .models import UserProfile, UserRole


class RegisterSerializer(serializers.ModelSerializer):
    """Create a user + profile. Registration is public.

    Public self-registration may only pick a non-privileged role. Officer roles
    (STATE_OFFICIAL / DISTRICT_OFFICIAL) and PLATFORM_ADMIN must be assigned by
    an existing Platform Admin from Settings — otherwise anyone could
    self-register an administrator and approve assessments / curate libraries.
    """

    PUBLIC_ROLES = (UserRole.ANALYST, UserRole.VIEWER)

    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=PUBLIC_ROLES, default=UserRole.VIEWER)
    organization = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "username", "email", "password",
            "first_name", "last_name", "role", "organization",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        role = validated_data.pop("role", UserRole.VIEWER)
        organization = validated_data.pop("organization", "")
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user, role=role, organization=organization)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from django.contrib.auth import authenticate
        user = authenticate(
            username=attrs["username"], password=attrs["password"]
        )
        if not user or not user.is_active:
            raise serializers.ValidationError("Invalid username or password.")
        attrs["user"] = user
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    role = serializers.CharField(source="get_role_display", read_only=True)
    role_code = serializers.CharField(source="role", read_only=True)
    is_admin = serializers.BooleanField(read_only=True)
    state_name = serializers.CharField(source="state.name", read_only=True, default=None)
    district_name = serializers.CharField(source="district.name", read_only=True, default=None)
    territory_restricted = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "role", "role_code", "role_label", "organization",
            "state", "state_name", "district", "district_name",
            "territory_restricted", "is_admin",
        ]


class MeSerializer(serializers.ModelSerializer):
    """Authenticated user + profile summary."""
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "date_joined", "is_staff", "profile",
        ]


class UserAdminSerializer(serializers.ModelSerializer):
    """Admin-only user management payload."""
    role = serializers.ChoiceField(choices=UserRole.choices, default=UserRole.VIEWER)
    role_code = serializers.CharField(source="profile.role", read_only=True)
    role_label = serializers.CharField(source="profile.get_role_display", read_only=True)
    organization = serializers.CharField(source="profile.organization", required=False, allow_blank=True)
    district = serializers.PrimaryKeyRelatedField(
        source="profile.district",
        queryset=AdministrativeUnit.objects.filter(level="DISTRICT"),
        required=False, allow_null=True,
    )
    state = serializers.PrimaryKeyRelatedField(
        source="profile.state",
        queryset=AdministrativeUnit.objects.filter(level="STATE"),
        required=False, allow_null=True,
    )
    state_name = serializers.CharField(source="profile.state.name", read_only=True, default=None)
    district_name = serializers.CharField(source="profile.district.name", read_only=True, default=None)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "is_active", "date_joined", "last_login",
            "role", "role_code", "role_label", "organization",
            "state", "state_name", "district", "district_name", "password",
        ]
        read_only_fields = ["date_joined", "last_login"]

    def create(self, validated_data):
        role = validated_data.pop("role", UserRole.VIEWER)
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "role": role,
                "organization": profile_data.get("organization", ""),
                "state": profile_data.get("state"),
                "district": profile_data.get("district"),
            },
        )
        return user

    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        profile = instance.profile
        if role:
            profile.role = role
        if "organization" in profile_data:
            profile.organization = profile_data.get("organization", "")
        if "state" in profile_data:
            profile.state = profile_data.get("state")
        if "district" in profile_data:
            profile.district = profile_data.get("district")
        profile.save()
        return instance