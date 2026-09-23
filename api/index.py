import os
import sys
import traceback

# Explicitly tell Django it's running on Vercel
os.environ["VERCEL"] = "1"

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

_startup_error = None

try:
    from config.wsgi import application
    app = application
except Exception:
    _startup_error = traceback.format_exc()

    # Return 200 with the diagnostic error so we can read it
    def app(environ, start_response):
        status = '200 OK'
        headers = [('Content-Type', 'text/plain; charset=utf-8'),
                   ('Access-Control-Allow-Origin', '*')]
        start_response(status, headers)
        yield f"[HVRA API - Django startup failed]\n\nPython: {sys.version}\nbackend_dir: {backend_dir}\nsys.path: {sys.path[:5]}\n\nTraceback:\n{_startup_error}".encode('utf-8')
