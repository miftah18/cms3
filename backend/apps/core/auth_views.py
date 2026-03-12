"""
Authentication Views/Endpoints

Implements JWT authentication endpoints:
- POST /auth/login/ - Generate tokens
- POST /auth/refresh/ - Get new access token
- POST /auth/logout/ - Revoke tokens
- POST /auth/logout-all/ - Logout from all devices
- GET /auth/token-status/ - Check token validity
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
import logging

from .jwt_service import get_token_manager
from .blacklist import TokenBlacklist, SessionManager
from .jwt_exceptions import (
    InvalidTokenError,
    TokenExpiredError,
    TokenRevokedError,
    InvalidRefreshTokenError,
)
from .auth_serializers import (
    LoginSerializer,
    TokenResponseSerializer,
    RefreshTokenSerializer,
    LogoutSerializer,
    TokenStatusSerializer,
)
from .audit import audit_action

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class LoginView(APIView):
    """
    POST /auth/login/
    Generate access, refresh, and offline tokens for user.
    """

    permission_classes = [AllowAny]

    @audit_action(action="auth.login", entity_type="authentication")
    def post(self, request):
        """
        Handle login request.

        Expected request body:
        {
            "email": "user@example.com",
            "password": "password123",
            "device_id": "device-uuid",
            "device_type": "web"
        }

        Returns:
        {
            "access_token": "eyJ...",
            "refresh_token": "eyJ...",
            "offline_token": "eyJ...",
            "expires_in": 900,
            "refresh_expires_in": 604800,
            "offline_expires_in": 43200,
            "token_type": "Bearer",
            "user": {...}
        }
        """
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]
        device_id = serializer.validated_data.get("device_id", f"web-{user.id}")
        device_type = serializer.validated_data.get("device_type", "web")

        # Get tenant_id from user (should be set during user creation)
        # For now, using default
        tenant_id = getattr(user, "tenant_id", None) or str(user.id)

        # Get user permissions
        permissions = self._get_user_permissions(user)

        # Generate tokens
        token_manager = get_token_manager()
        access_token = token_manager.generate_access_token(
            user, tenant_id, device_id, permissions
        )
        refresh_token = token_manager.generate_refresh_token(user, tenant_id, device_id)
        offline_token = token_manager.generate_offline_token(
            user, tenant_id, device_id, permissions
        )

        # Extract JTI for session tracking
        refresh_jti = token_manager.extract_jti(refresh_token)

        # Track session and blacklist
        SessionManager.create_session(user.id, device_id, device_type, refresh_jti)
        TokenBlacklist.track_session(user.id, refresh_jti)

        # Get token expiration times
        access_ttl = token_manager.get_token_ttl(access_token)
        refresh_ttl = token_manager.get_token_ttl(refresh_token)
        offline_ttl = token_manager.get_token_ttl(offline_token)

        response_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "offline_token": offline_token,
            "expires_in": access_ttl,
            "refresh_expires_in": refresh_ttl,
            "offline_expires_in": offline_ttl,
            "token_type": "Bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.get_full_name() or user.username,
            },
        }

        logger.info(f"User {user.id} logged in from device {device_id}")
        return Response(response_data, status=status.HTTP_200_OK)

    @staticmethod
    def _get_user_permissions(user: User) -> list:
        """Get user permissions based on role."""
        # This is a simplified version - in production, fetch from database
        permissions = []
        # TODO: Implement proper permission system
        return permissions


@method_decorator(csrf_exempt, name="dispatch")
class RefreshTokenView(APIView):
    """
    POST /auth/refresh/
    Generate new access token from refresh token.
    """

    permission_classes = [AllowAny]

    @audit_action(action="auth.refresh", entity_type="authentication")
    def post(self, request):
        """
        Handle refresh token request.

        Expected request body:
        {
            "refresh_token": "eyJ...",
            "device_id": "device-uuid"
        }

        Returns:
        {
            "access_token": "eyJ...",
            "expires_in": 900,
            "token_type": "Bearer"
        }
        """
        serializer = RefreshTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_token = serializer.validated_data["refresh_token"]
        device_id = serializer.validated_data.get("device_id")

        # Decode and validate refresh token
        token_manager = get_token_manager()
        claims = token_manager.extract_claims(refresh_token)

        if not claims:
            raise InvalidTokenError("Invalid refresh token format")

        # Check if token is revoked
        jti = claims.get("jti")
        if TokenBlacklist.is_revoked(jti):
            raise TokenRevokedError("Refresh token has been revoked")

        # Validate token type
        if claims.get("token_type") != "refresh":
            raise InvalidRefreshTokenError("Invalid token type")

        # Extract claims
        user_id = claims.get("user_id")
        tenant_id = claims.get("tenant_id")
        device_id = device_id or claims.get("device_id")

        # Load user
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise InvalidRefreshTokenError("User not found")

        # Get permissions
        permissions = LoginView._get_user_permissions(user)

        # Generate new access token (with token rotation for refresh token)
        access_token = token_manager.generate_access_token(
            user, tenant_id, device_id, permissions
        )
        new_refresh_token = token_manager.generate_refresh_token(
            user, tenant_id, device_id
        )

        # Revoke old refresh token and track new one
        TokenBlacklist.revoke_token(jti, ttl_seconds=7 * 24 * 3600, reason="rotated")
        new_jti = token_manager.extract_jti(new_refresh_token)
        TokenBlacklist.track_session(user_id, new_jti)

        access_ttl = token_manager.get_token_ttl(access_token)

        response_data = {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "expires_in": access_ttl,
            "token_type": "Bearer",
        }

        logger.info(f"User {user_id} refreshed token from device {device_id}")
        return Response(response_data, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name="dispatch")
class LogoutView(APIView):
    """
    POST /auth/logout/
    Revoke tokens and end session.
    """

    permission_classes = [AllowAny]

    @audit_action(action="auth.logout", entity_type="authentication")
    def post(self, request):
        """
        Handle logout request.

        Expected request body:
        {
            "refresh_token": "eyJ...",
            "device_id": "device-uuid",
            "logout_all_devices": false
        }

        Returns:
        {
            "message": "Logged out successfully"
        }
        """
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_token = serializer.validated_data.get("refresh_token")
        logout_all = serializer.validated_data.get("logout_all_devices", False)
        device_id = serializer.validated_data.get("device_id")

        if not refresh_token:
            return Response(
                {"message": "Logged out successfully"},
                status=status.HTTP_200_OK,
            )

        # Decode refresh token
        token_manager = get_token_manager()
        claims = token_manager.extract_claims(refresh_token)

        if not claims:
            # Token already invalid - just return success
            return Response(
                {"message": "Logged out successfully"},
                status=status.HTTP_200_OK,
            )

        user_id = claims.get("user_id")
        jti = claims.get("jti")

        if logout_all:
            # Revoke all sessions for this user
            TokenBlacklist.revoke_all_user_sessions(user_id)
            logger.info(f"User {user_id} logged out from all devices")
        else:
            # Revoke only this session
            TokenBlacklist.revoke_user_session(user_id, jti)
            logger.info(f"User {user_id} logged out from device {device_id}")

        return Response(
            {"message": "Logged out successfully"},
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name="dispatch")
class TokenStatusView(APIView):
    """
    POST /auth/token-status/
    Check validity and TTL of tokens.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        """
        Check token status.

        Expected request body:
        {
            "access_token": "eyJ...",
            "refresh_token": "eyJ...",
            "offline_token": "eyJ..."
        }

        Returns:
        {
            "access_token": {
                "valid": true,
                "expires_in": 850,
                "claims": {...}
            },
            ...
        }
        """
        serializer = TokenStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token_manager = get_token_manager()
        response_data = {}

        # Check access token
        access_token = serializer.validated_data.get("access_token")
        if access_token:
            claims = token_manager.extract_claims(access_token)
            ttl = token_manager.get_token_ttl(access_token) if claims else 0
            response_data["access_token"] = {
                "valid": bool(claims),
                "expires_in": ttl,
                "claims": claims,
            }

        # Check refresh token
        refresh_token = serializer.validated_data.get("refresh_token")
        if refresh_token:
            claims = token_manager.extract_claims(refresh_token)
            ttl = token_manager.get_token_ttl(refresh_token) if claims else 0
            is_revoked = TokenBlacklist.is_revoked(claims.get("jti")) if claims else False
            response_data["refresh_token"] = {
                "valid": bool(claims) and not is_revoked,
                "expires_in": ttl,
                "revoked": is_revoked,
            }

        # Check offline token
        offline_token = serializer.validated_data.get("offline_token")
        if offline_token:
            claims = token_manager.extract_claims(offline_token)
            ttl = token_manager.get_token_ttl(offline_token) if claims else 0
            response_data["offline_token"] = {
                "valid": bool(claims),
                "expires_in": ttl,
                "claims": claims,
            }

        return Response(response_data, status=status.HTTP_200_OK)
