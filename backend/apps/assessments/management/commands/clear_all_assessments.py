"""
Management command: clear_all_assessments

Deletes all assessments, risk assessments, results, saved queries, and generated reports.
Leaves the underlying foundation data (Admin Units, Hazard Layers, Indicators, Events)
intact so the user can run fresh assessments and see results generated from scratch.

Usage:
    python manage.py clear_all_assessments
"""
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.assessments.models import Assessment, RiskAssessment, SavedQuery
from apps.reports.models import GeneratedReport
from apps.datasets.models import UploadedDataset


class Command(BaseCommand):
    help = "Delete all assessments, risk assessments, results, and generated reports."

    def handle(self, *args, **options):
        with transaction.atomic():
            a_count = Assessment.objects.all().delete()[0]
            ra_count = RiskAssessment.objects.all().delete()[0]
            sq_count = SavedQuery.objects.all().delete()[0]
            rep_count = GeneratedReport.objects.all().delete()[0]
            ds_count = UploadedDataset.objects.all().delete()[0]

        upload_dir = os.path.join("media", "uploads", "datasets")
        if os.path.exists(upload_dir):
            for f in os.listdir(upload_dir):
                f_path = os.path.join(upload_dir, f)
                try:
                    if os.path.isfile(f_path):
                        os.remove(f_path)
                except Exception:
                    pass

        self.stdout.write(self.style.SUCCESS(
            f"Successfully reset assessments & reports:\n"
            f"  - Deleted {a_count} assessment objects & results\n"
            f"  - Deleted {ra_count} risk assessment objects & results\n"
            f"  - Deleted {sq_count} saved queries\n"
            f"  - Deleted {rep_count} generated reports\n"
            f"  - Deleted {ds_count} uploaded datasets & test files\n\n"
            f"System is clean and ready to test generating new assessments from scratch!"
        ))
