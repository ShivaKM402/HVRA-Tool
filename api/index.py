"""
Vercel Serverless Function entrypoint for Django WSGI application.
"""
import os
import sys

# Ensure backend directory is in Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Set default settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Import Django WSGI application
from config.wsgi import application

# Export app for Vercel WSGI runner
app = application
