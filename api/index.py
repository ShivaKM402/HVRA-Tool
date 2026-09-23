"""
Vercel Serverless Function entrypoint for Django WSGI application.
"""
import os
import sys

# Locate backend directory in Vercel lambda filesystem
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", "backend"))

if not os.path.exists(backend_dir):
    # Fallback to relative workspace root
    backend_dir = os.path.abspath("backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Import Django WSGI application
from config.wsgi import application

# Vercel WSGI entry point
app = application
