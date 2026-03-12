"""
JWT-Specific Exception Classes

Custom exception handlers for JWT authentication and authorization.
"""

from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework import status


class InvalidTokenError(AuthenticationFailed):
    """Raised when token signature or format is invalid."""

    default_detail = "Invalid token."
    default_code = "invalid_token"


class TokenExpiredError(AuthenticationFailed):
    """Raised when token has expired."""

    default_detail = "Token has expired. Please refresh your token."
    default_code = "token_expired"


class TokenRevokedError(AuthenticationFailed):
    """Raised when token has been revoked (blacklisted)."""

    default_detail = "Token has been revoked. Please authenticate again."
    default_code = "token_revoked"


class MissingTokenError(AuthenticationFailed):
    """Raised when required token is missing from request."""

    default_detail = "Authentication credentials were not provided."
    default_code = "missing_token"


class InvalidRefreshTokenError(AuthenticationFailed):
    """Raised when refresh token cannot be used to generate new access token."""

    default_detail = "Invalid refresh token. Please authenticate again."
    default_code = "invalid_refresh_token"


class OfflineTokenError(AuthenticationFailed):
    """Raised when offline token is used for non-offline operations."""

    default_detail = (
        "Offline token cannot be used for this operation. Please go online."
    )
    default_code = "offline_token_error"


class InsufficientPermissionsError(PermissionDenied):
    """Raised when user lacks required permissions."""

    default_detail = "You do not have permission to perform this action."
    default_code = "insufficient_permissions"


class DeviceNotAuthorizedError(PermissionDenied):
    """Raised when device is not authorized for this operation."""

    default_detail = "This device is not authorized for this operation."
    default_code = "device_not_authorized"


class TenantContextMissingError(PermissionDenied):
    """Raised when tenant context is missing or invalid."""

    default_detail = "Invalid or missing tenant context."
    default_code = "tenant_context_missing"


class TokenRefreshRequiredError(AuthenticationFailed):
    """Raised when token needs to be refreshed."""

    default_detail = "Token refresh required. Please refresh your access token."
    default_code = "token_refresh_required"

    def __init__(self, detail=None, code=None):
        """Initialize with optional custom detail."""
        super().__init__(detail or self.default_detail, code or self.default_code)
        self.status_code = status.HTTP_401_UNAUTHORIZED


class DeviceRevokedException(AuthenticationFailed):
    """Raised when device has been revoked from account."""

    default_detail = "This device has been revoked. Please authenticate again."
    default_code = "device_revoked"
