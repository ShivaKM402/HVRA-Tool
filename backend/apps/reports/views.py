"""Reports views — stub for Phase 1."""
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets
from .models import GeneratedReport
from rest_framework import serializers


class GeneratedReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneratedReport
        fields = ["id", "assessment", "format", "status", "file_size_bytes", "generated_at"]


class GeneratedReportViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = GeneratedReport.objects.all()
    serializer_class = GeneratedReportSerializer
