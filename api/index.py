import os
import sys
import traceback

# Explicitly tell Django it's running on Vercel
os.environ["VERCEL"] = "1"

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

try:
    from config.wsgi import application
    app = application
except Exception:
    # If Django fails to start, return a diagnostic error response
    _error = traceback.format_exc()

    def app(environ, start_response):
        status = '500 Internal Server Error'
        headers = [('Content-Type', 'text/plain; charset=utf-8'),
                   ('Access-Control-Allow-Origin', '*')]
        start_response(status, headers)
        yield f"[HVRA API] Django startup failed:\n{_error}".encode('utf-8')
