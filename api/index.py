"""
Vercel Serverless Function entrypoint for Django WSGI application.
Includes exception catching to expose any Django boot or runtime errors directly.
"""
import os
import sys
import traceback

# Ensure backend directory is in Python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_app = None
init_error = None

try:
    from django.core.wsgi import get_wsgi_application
    django_app = get_wsgi_application()
except Exception as e:
    init_error = traceback.format_exc()


def app(environ, start_response):
    global django_app, init_error

    if init_error:
        body = f"Django Initialization Error:\n\n{init_error}".encode("utf-8")
        start_response("500 Internal Server Error", [
            ("Content-Type", "text/plain; charset=utf-8"),
            ("Content-Length", str(len(body)))
        ])
        return [body]

    try:
        return django_app(environ, start_response)
    except Exception as e:
        error_msg = f"Django Runtime Error:\n\n{traceback.format_exc()}".encode("utf-8")
        start_response("500 Internal Server Error", [
            ("Content-Type", "text/plain; charset=utf-8"),
            ("Content-Length", str(len(error_msg)))
        ])
        return [error_msg]
