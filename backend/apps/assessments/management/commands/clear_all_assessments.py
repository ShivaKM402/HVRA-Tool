"""
Management command: clear_all_assessments

Deletes all generated assessments, risk assessments, results, saved queries,
generated reports, field incident reports, workflow logs, and sent/dispatched data.
Leaves all core baseline entities (Users, Roles, Administrative Units, Hazard Indicators,
Templates, and Weightage Rules) 100% intact so the portal is pristine for client demos.

Usage:
    python manage.py clear_all_assessments
"""
import os
import shutil
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.assessments.models import Assessment, RiskAssessment, SavedQuery
from apps.reports.models import GeneratedReport
from apps.datasets.models import UploadedDataset, DataSource
from apps.issues.models import IssueReport, IssueWorkflowLog, IssueAttachment


class Command(BaseCommand):
    help = "Delete all generated assessments, incident reports, workflow logs, and sent/dispatched data for client demos."

    def handle(self, *args, **options):
        with transaction.atomic():
            # 1. Purge assessments and linked results/indicators
            a_count = Assessment.objects.all().delete()[0]
            ra_count = RiskAssessment.objects.all().delete()[0]
            sq_count = SavedQuery.objects.all().delete()[0]
            rep_count = GeneratedReport.objects.all().delete()[0]
            ds_count = UploadedDataset.objects.all().delete()[0]

            # 2. Purge field incident reports & workflow audit trail
            log_count = IssueWorkflowLog.objects.all().delete()[0]
            att_count = IssueAttachment.objects.all().delete()[0]
            issue_count = IssueReport.objects.all().delete()[0]

            # 3. Clean any dispatched metadata on DataSources
            for ds in DataSource.objects.all():
                if isinstance(ds.metadata, dict) and ("dispatches" in ds.metadata or "last_dispatch" in ds.metadata):
                    meta = dict(ds.metadata)
                    meta.pop("dispatches", None)
                    meta.pop("last_dispatch", None)
                    ds.metadata = meta
                    ds.save(update_fields=["metadata"])

        # 4. Clean physical uploaded/generated files while preserving directory skeletons
        media_subdirs = [
            os.path.join("media", "uploads", "datasets"),
            os.path.join("media", "uploads"),
            os.path.join("media", "reports"),
            os.path.join("media", "issues"),
        ]
        cleaned_files = 0
        for dirpath in media_subdirs:
            if os.path.exists(dirpath):
                for item in os.listdir(dirpath):
                    item_path = os.path.join(dirpath, item)
                    try:
                        if os.path.isfile(item_path):
                            os.remove(item_path)
                            cleaned_files += 1
                        elif os.path.isdir(item_path) and item not in ("datasets", "uploads"):
                            shutil.rmtree(item_path)
                    except Exception:
                        pass

        self.stdout.write(self.style.SUCCESS(
            f"Successfully cleared all generated and sent data for client demo:\n"
            f"  - Deleted {a_count} assessment objects & results\n"
            f"  - Deleted {ra_count} risk assessment objects & results\n"
            f"  - Deleted {sq_count} saved queries\n"
            f"  - Deleted {rep_count} generated reports\n"
            f"  - Deleted {ds_count} uploaded datasets\n"
            f"  - Deleted {issue_count} incident reports & tickets\n"
            f"  - Deleted {log_count} workflow audit logs & {att_count} attachments\n"
            f"  - Cleaned {cleaned_files} temporary media files\n\n"
            f"Baseline fixtures (Kerala hierarchy, hazard indicators, users, rules) remain intact.\n"
            f"The portal is pristine and ready for a fresh client demonstration!"
        ))

