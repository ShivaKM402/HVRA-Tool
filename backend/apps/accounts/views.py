"""accounts views — registration, login (token), profile, user management."""
from django.contrib.auth.models import User
from rest_framework import viewsets, status, permissions
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserProfile
from .permissions import IsPlatformAdmin
from .serializers import (
    LoginSerializer,
    MeSerializer,
    RegisterSerializer,
    UserAdminSerializer,
)


class RegisterView(APIView):
    """POST /api/auth/register/ — public self-registration."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "success": True,
                "token": token.key,
                "user": MeSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """POST /api/auth/login/ — returns a Bearer token (TokenAuthentication)."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"success": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "success": True,
                "token": token.key,
                "user": MeSerializer(user).data,
            }
        )


class LogoutView(APIView):
    """POST /api/auth/logout/ — delete the current token."""

    def post(self, request):
        request.user.auth_token.delete()
        return Response({"success": True, "message": "Logged out."})


class MeView(APIView):
    """GET /api/auth/me/ — current authenticated user profile."""

    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    """Admin-only user management (HVRA Section 2 — users and access levels).

    GET    /api/users/
    POST   /api/users/
    PATCH  /api/users/{id}/
    DELETE /api/users/{id}/
    """

    queryset = User.objects.select_related("profile").all().order_by("username")
    serializer_class = UserAdminSerializer
    permission_classes = [IsPlatformAdmin]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(profile__role=role.upper())
        return qs

    @action(detail=False, methods=["get"])
    def roles(self, request):
        """List the supported roles and their descriptions."""
        return Response(
            [{"code": code, "label": label} for code, label in UserProfile._meta.get_field("role").choices]
        )