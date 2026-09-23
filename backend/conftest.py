"""
Pytest configuration for HVRA backend tests.
"""
import django
import os
import sys

# Add backend directory to path
sys.path.insert(0, os.path.dirname(__file__))


def pytest_configure(config):
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()
