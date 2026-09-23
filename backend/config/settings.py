"""
HVRA Digital Tool — Django Settings
"""
import os
import shutil
from pathlib import Path
from decouple import config

# -------------------------------------------------------
# Base paths
# -------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# -------------------------------------------------------
# Security
# -------------------------------------------------------
SECRET_KEY = config("SECRET_KEY", default="dev-secret-key-change-in-production")
DEBUG = config("DEBUG", default=True, cast=bool)
if os.environ.get("VERCEL"):
    ALLOWED_HOSTS = ["*"]
else:
    ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1").split(",")

# -------------------------------------------------------
# Application definition
# -------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.administration",
    "apps.hazards",
    "apps.datasets",
    "apps.assessments",
    "apps.reports",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# -------------------------------------------------------
# Database — SQLite only
# -------------------------------------------------------
DATABASE_PATH = config("DATABASE_PATH", default="db.sqlite3")
db_path = BASE_DIR / DATABASE_PATH

if os.environ.get("VERCEL"):
    tmp_db_path = "/tmp/db.sqlite3"
    if not os.path.exists(tmp_db_path) and os.path.exists(db_path):
        shutil.copyfile(db_path, tmp_db_path)
    if os.path.exists(tmp_db_path):
        db_path = tmp_db_path

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": db_path,
    }
}

# -------------------------------------------------------
# Password validation
# -------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# -------------------------------------------------------
# Internationalization
# -------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# -------------------------------------------------------
# Static and Media files
# -------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

UPLOAD_DIR = config("UPLOAD_DIR", default="uploads/")
_max_upload = config("MAX_UPLOAD_SIZE_MB", default="50")
MAX_UPLOAD_SIZE_MB = int(_max_upload) if str(_max_upload).strip() else 50

# -------------------------------------------------------
# Default primary key
# -------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# -------------------------------------------------------
# Django REST Framework
# -------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",  # Open for prototype; restrict in production
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "config.exception_handler.custom_exception_handler",
}

# -------------------------------------------------------
# CORS
# -------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
).split(",")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = DEBUG or bool(os.environ.get("VERCEL"))

# -------------------------------------------------------
# Prototype / Application settings
# -------------------------------------------------------
PROTOTYPE_MODE = config("PROTOTYPE_MODE", default=True, cast=bool)
DEMO_DATA_LABEL = config("DEMO_DATA_LABEL", default="DEMO DATA")
API_VERSION = config("API_VERSION", default="v1")

# Flood weightage thresholds (configurable, not official values)
FLOOD_PRONE_AREA_THRESHOLDS = {
    "low": 25,       # ≤25% → weight 4
    "moderate": 50,  # 25–50% → weight 6
    "high": 75,      # 50–75% → weight 8
    "very_high": 100 # >75% → weight 9
}

FLOOD_EVENT_FREQUENCY_THRESHOLDS = {
    "none": 0,
    "low": 2,        # ≤2 events → weight 6
    "moderate": 5,   # 3–5 events → weight 8
    "high": 999      # >5 events → weight 10
}

# Classification thresholds (configurable)
HAZARD_CLASS_THRESHOLDS = {
    "NH": 0,   # No Hazard
    "LH": 4,   # Low Hazard
    "MH": 6,   # Medium Hazard
    "HH": 8,   # High Hazard
}

HAZARD_NORMALIZATION_METHOD = "min_max"  # Options: min_max, z_score, rank
