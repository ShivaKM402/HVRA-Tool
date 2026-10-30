"""
OpenAI client singleton — loaded once, reused across all AI service calls.
Falls back gracefully if OPENAI_API_KEY is not configured.
"""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def get_openai_client():
    """Return a shared OpenAI client. Returns None if key is not configured."""
    global _client
    if _client is not None:
        return _client

    api_key = getattr(settings, "OPENAI_API_KEY", None)
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — AI features will use fallback text.")
        return None

    try:
        from openai import OpenAI
        _client = OpenAI(api_key=api_key)
        return _client
    except Exception as exc:
        logger.error("Failed to initialise OpenAI client: %s", exc)
        return None


def is_ai_available() -> bool:
    """Quick check whether AI features are available."""
    return get_openai_client() is not None

