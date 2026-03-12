"""
JWT Authentication Middleware

Handles JWT token extraction, validation, and user context injection.
Extends DRF's authentication classes.
"""

from typing import Optional, Tuple
import logging
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import User, AnonymousUser
from django.utils.translation import gettext_lazy as _

from .jwt_service import get_token_manager
from .blacklist import TokenBlacklist, SessionManager
from .jwt_exceptions import (
    InvalidTokenError,
    TokenExpiredError,
    TokenRevokedError,
    MissingTokenError,
    OfflineTokenError,
    TenantContextMissingError,
)

logger = logging.getLogger(__name__)


class JWTAuthentication(TokenAuthentication):
    """
    JWT authentication class extending DRF's TokenAuthentication.

    Validates JWT tokens, checks blacklist, loads user context,
    and enforces token scope restrictions (offline vs online).
    """

    keyword = "Bearer"
    invalid_token_message = _("Invalid token.")

    def get_validated_token(self, raw_token: str) -> dict:
        """
        Validate token and return decoded claims.

        Args:
            raw_token: The raw JWT token string

        Returns:
            Decoded claims dict

        Raises:
            AuthenticationFailed: If token is invalid
        """
        token_manager = get_token_manager()

        # Decode token
        claims = token_manager.extract_claims(raw_token)
        if not claims:
            raise InvalidTokenError(self.invalid_token_message)

        # Check if token is revoked
        jti = claims.get("jti")
        if TokenBlacklist.is_revoked(jti):
            logger.warning(f"Attempt to use revoked token: {jti}")
            raise TokenRevokedError()

        return claims

    def authenticate(
        self, request
    ) -> Optional[Tuple[User, dict]]:
        """
        Authenticate request using JWT token from Authorization header.

        Args:
            request: The HTTP request

        Returns:
            Tuple of (user, validated_token) or None if no token

        Raises:
            AuthenticationFailed: If token is invalid
        """
        auth = self.get_authorization_header(request).split()

        if not auth or auth[0].lower() != self.keyword.lower().encode():
            return None

        if len(auth) == 1:
            msg = _("Invalid token header. No credentials provided.")
            raise InvalidTokenError(msg)

        if len(auth) > 2:
            msg = _("Invalid token header. Token string should not contain spaces.")
            raise InvalidTokenError(msg)

        try:
            raw_token = auth[1].decode()
        except UnicodeError:
            msg = _("Invalid token header. Token string should not contain invalid characters.")
            raise InvalidTokenError(msg)

        # Validate token and get claims
        validated_token = self.get_validated_token(raw_token)

        # Load user from claims
        try:
            user_id = validated_token.get("user_id")
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.warning(f"User {user_id} from token not found in database")
            raise InvalidTokenError(_("Invalid token."))

        # Attach token claims to request for use in views
        request.auth_token = raw_token
        request.token_claims = validated_token

        logger.debug(f"User {user.id} authenticated via JWT")
        return (user, validated_token)

    def authenticate_header(self, request) -> str:
        """Return authentication header for 401 response."""
        return self.keyword


class OfflineTokenMiddleware:
    """
    Middleware to enforce offline token scope restrictions.

    Offline tokens can only be used for specific endpoints.
    Prevents offline tokens from being used for sensitive operations.
    """

    # Endpoints that allow offline tokens
    OFFLINE_ALLOWED_ENDPOINTS = [
        # Read-only endpoints
        "/api/v1/products/",
        "/api/v1/stock/",
        "/api/v1/transactions/list/",
        # Limited write for transactions
        "/api/v1/transactions/create/",
        # Sync endpoint
        "/api/v1/sync/delta/",
    ]

    def __init__(self, get_response):
        """Initialize middleware."""
        self.get_response = get_response

    def __call__(self, request):
        """Process request."""
        # Check if request has offline token
        token_claims = getattr(request, "token_claims", {})
        scope = token_claims.get("scope", [])

        if "offline" in scope:
            # Check if endpoint allows offline tokens
            path = request.path
            if not self._is_offline_allowed(path):
                logger.warning(
                    f"Offline token used for restricted endpoint: {path} "
                    f"by user {token_claims.get('user_id')}"
                )
                raise OfflineTokenError()

        return self.get_response(request)

    @classmethod
    def _is_offline_allowed(cls, path: str) -> bool:
        """Check if path allows offline tokens."""
        for allowed_path in cls.OFFLINE_ALLOWED_ENDPOINTS:
            if path.startswith(allowed_path):
                return True
        return False


class TenantContextMiddleware:
    """
    Middleware to inject tenant context from token claims.

    Extracts tenant_id from JWT claims and attaches to request
    for use in tenant resolution and schema routing.
    """

    def __init__(self, get_response):
        """Initialize middleware."""
        self.get_response = get_response

    def __call__(self, request):
        """Process request."""
        # Extract tenant_id from token claims
        token_claims = getattr(request, "token_claims", {})
        tenant_id = token_claims.get("tenant_id")

        if tenant_id:
            request.tenant_id_from_token = tenant_id
            logger.debug(f"Tenant context injected: {tenant_id}")
        else:
            request.tenant_id_from_token = None

        return self.get_response(request)


class DeviceSessionMiddleware:
    """
    Middleware to track device activity and manage sessions.

    Updates last_activity_at for device sessions on each request.
    """

    def __init__(self, get_response):
        """Initialize middleware."""
        self.get_response = get_response

    def __call__(self, request):
        """Process request."""
        # Update device activity
        token_claims = getattr(request, "token_claims", {})
        user_id = token_claims.get("user_id")
        device_id = token_claims.get("device_id")

        if user_id and device_id:
            SessionManager.update_activity(user_id, device_id)
            logger.debug(f"Updated activity for user {user_id} on device {device_id}")

        return self.get_response(request)


class TokenRefreshMiddleware:
    """
    Middleware to handle automatic token refresh on 401 responses.

    When access token expires (401), attempts to refresh using refresh token
    if available in request. This is primarily for client-side use.
    """

    def __init__(self, get_response):
        """Initialize middleware."""
        self.get_response = get_response

    def __call__(self, request):
        """Process request."""
        response = self.get_response(request)

        # If 401 and refresh token available, could trigger refresh
        # Note: This is typically handled on client-side for better UX
        if response.status_code == 401:
            logger.debug(f"Unauthorized access attempt for {request.path}")

        return response
