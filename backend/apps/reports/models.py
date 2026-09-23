"""
Reports models.
GeneratedReport — tracks generated report files.
"""
from django.db import models


class GeneratedReport(models.Model):
    FORMAT_CHOICES = [("PDF", "PDF"), ("DOCX", "DOCX")]
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("GENERATING", "Generating"),
        ("READY", "Ready"),
        ("FAILED", "Failed"),
    ]

    assessment = models.ForeignKey(
        "assessments.Assessment",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    format = models.CharField(max_length=8, choices=FORMAT_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="PENDING")
    file = models.FileField(upload_to="reports/", null=True, blank=True)
    file_size_bytes = models.PositiveBigIntegerField(default=0)
    generated_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "auth.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "generated_report"
        verbose_name = "Generated Report"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Report [{self.format}] for {self.assessment.name} — {self.status}"
