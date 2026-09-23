"""
HVRA Digital Tool — Custom Exception Handler
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns consistent JSON error responses.
    """
    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            "error": True,
            "status_code": response.status_code,
            "message": _get_error_message(response.data),
            "detail": response.data,
        }
    else:
        # Unhandled exception
        response = Response(
            {
                "error": True,
                "status_code": 500,
                "message": "An internal server error occurred.",
                "detail": str(exc),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response


def _get_error_message(data):
    if isinstance(data, dict):
        if "detail" in data:
            return str(data["detail"])
        return "Validation error. Please check your input."
    if isinstance(data, list):
        return str(data[0]) if data else "Unknown error"
    return str(data)
