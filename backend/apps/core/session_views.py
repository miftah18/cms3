"""
Multi-Device Session Management Views

Endpoints for managing user sessions across multiple devices.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from django.utils import timezone
import logging

from .blacklist import SessionManager, TokenBlacklist
from .jwt_service import get_token_manager
from .audit import audit_action

logger = logging.getLogger(__name__)


class SessionListView(APIView):
    """
    GET /auth/sessions/
    List all active sessions for the current user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        List user's active sessions.

        Returns:
        {
            "sessions": [
                {
                    "device_id": "device-uuid",
                    "device_type": "web",
                    "device_name": "Chrome on Windows",
                    "created_at": "2024-01-01T10:00:00Z",
                    "last_activity_at": "2024-01-15T14:30:00Z",
                    "is_current_device": true,
                    "expires_at": "2024-01-22T10:00:00Z"
                }
            ]
        }
        """
        user_id = request.user.id
        token_claims = getattr(request, "token_claims", {})
        current_device_id = token_claims.get("device_id")

        # Get all active sessions for user
        sessions = TokenBlacklist.get_user_sessions(user_id)
        
        session_details = []
        for jti in sessions:
            # Get session details from Redis
            # In production, you'd also query the database for rich session info
            session_info = {
                "device_id": f"device-{jti[:8]}",
                "device_type": "web",
                "device_name": "Unknown Device",
                "created_at": timezone.now().isoformat(),
                "last_activity_at": timezone.now().isoformat(),
                "is_current_device": False,
                "expires_at": timezone.now().isoformat(),
            }
            
            if jti == token_claims.get("jti"):
                session_info["is_current_device"] = True
            
            session_details.append(session_info)

        logger.info(f"User {user_id} retrieved {len(session_details)} sessions")
        
        return Response({
            "sessions": session_details,
            "total": len(session_details),
        }, status=status.HTTP_200_OK)


class SessionDetailView(APIView):
    """
    GET /auth/sessions/{device_id}/
    Get details of a specific session.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, device_id):
        """
        Get session details for specific device.

        Returns:
        {
            "device_id": "device-uuid",
            "device_type": "web",
            "device_name": "Chrome on Windows",
            "ip_address": "192.168.1.1",
            "user_agent": "Mozilla/5.0...",
            "created_at": "2024-01-01T10:00:00Z",
            "last_activity_at": "2024-01-15T14:30:00Z",
            "expires_at": "2024-01-22T10:00:00Z"
        }
        """
        user_id = request.user.id
        token_claims = getattr(request, "token_claims", {})

        # Get session from SessionManager
        session = SessionManager.get_session(user_id, device_id)

        if not session:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        session["is_current_device"] = (
            session.get("device_id") == token_claims.get("device_id")
        )

        logger.info(f"User {user_id} retrieved details for device {device_id}")

        return Response(session, status=status.HTTP_200_OK)


class SessionRevokeView(APIView):
    """
    DELETE /auth/sessions/{device_id}/
    Revoke a specific session (logout from one device).
    """

    permission_classes = [IsAuthenticated]

    @audit_action(action="auth.session_revoke", entity_type="session")
    def delete(self, request, device_id):
        """
        Revoke a specific session.

        Returns:
        {
            "message": "Session revoked successfully"
        }
        """
        user_id = request.user.id
        token_claims = getattr(request, "token_claims", {})
        current_device_id = token_claims.get("device_id")

        # Prevent user from revoking their current session via this endpoint
        # Use logout endpoint instead
        if device_id == current_device_id:
            return Response(
                {"error": "Use logout endpoint to revoke current session"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Revoke the session
        success = TokenBlacklist.revoke_user_session(user_id, device_id)

        if not success:
            return Response(
                {"error": "Failed to revoke session"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(f"User {user_id} revoked session on device {device_id}")

        return Response(
            {"message": "Session revoked successfully"},
            status=status.HTTP_200_OK,
        )


class SessionRevokeAllView(APIView):
    """
    POST /auth/sessions/revoke-all/
    Revoke all sessions except current device (logout from all other devices).
    """

    permission_classes = [IsAuthenticated]

    @audit_action(action="auth.session_revoke_all_others", entity_type="session")
    def post(self, request):
        """
        Revoke all sessions except current one.

        Returns:
        {
            "message": "All other sessions revoked successfully",
            "revoked_count": 3
        }
        """
        user_id = request.user.id
        token_claims = getattr(request, "token_claims", {})
        current_jti = token_claims.get("jti")

        # Get all sessions
        all_sessions = TokenBlacklist.get_user_sessions(user_id)

        # Revoke all except current
        revoked_count = 0
        for jti in all_sessions:
            if jti != current_jti:
                TokenBlacklist.revoke_token(
                    jti,
                    ttl_seconds=7 * 24 * 3600,
                    reason="revoke_all_others"
                )
                revoked_count += 1

        logger.info(
            f"User {user_id} revoked {revoked_count} other sessions"
        )

        return Response(
            {
                "message": "All other sessions revoked successfully",
                "revoked_count": revoked_count,
            },
            status=status.HTTP_200_OK,
        )


class SessionTerminateAllView(APIView):
    """
    POST /auth/sessions/terminate-all/
    Terminate all sessions including current device (full logout).
    """

    permission_classes = [IsAuthenticated]

    @audit_action(action="auth.session_terminate_all", entity_type="session")
    def post(self, request):
        """
        Terminate all sessions for user.

        Returns:
        {
            "message": "All sessions terminated successfully",
            "terminated_count": 4
        }
        """
        user_id = request.user.id

        # Revoke all sessions
        all_sessions = TokenBlacklist.get_user_sessions(user_id)
        terminated_count = len(all_sessions)

        success = TokenBlacklist.revoke_all_user_sessions(user_id)

        if not success:
            return Response(
                {"error": "Failed to terminate sessions"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            f"User {user_id} terminated {terminated_count} sessions"
        )

        return Response(
            {
                "message": "All sessions terminated successfully",
                "terminated_count": terminated_count,
            },
            status=status.HTTP_200_OK,
        )


class SessionActivityView(APIView):
    """
    GET /auth/sessions/activity/
    Get session activity history for current user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get recent session activity.

        Query params:
        - limit: Number of activities to return (default: 50)
        - offset: Pagination offset (default: 0)

        Returns:
        {
            "activities": [
                {
                    "timestamp": "2024-01-15T14:30:00Z",
                    "action": "login",
                    "device_id": "device-uuid",
                    "device_type": "web",
                    "ip_address": "192.168.1.1",
                    "status": "success"
                }
            ],
            "total": 150
        }
        """
        user_id = request.user.id

        # Note: In production, query AuthenticationLog model
        # This is a simplified implementation
        activities = [
            {
                "timestamp": timezone.now().isoformat(),
                "action": "active",
                "device_id": "device-current",
                "device_type": "web",
                "ip_address": request.META.get("REMOTE_ADDR"),
                "status": "success",
            }
        ]

        logger.debug(f"User {user_id} retrieved activity history")

        return Response(
            {
                "activities": activities,
                "total": 1,
            },
            status=status.HTTP_200_OK,
        )


class SessionSecurityCheckView(APIView):
    """
    POST /auth/sessions/security-check/
    Perform security check on sessions (verify no unauthorized access).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Check for suspicious session activity.

        Returns:
        {
            "status": "secure",
            "warnings": [],
            "recommendations": []
        }
        """
        user_id = request.user.id
        token_claims = getattr(request, "token_claims", {})

        warnings = []
        recommendations = []

        # Get user sessions
        sessions = TokenBlacklist.get_user_sessions(user_id)

        # Check for suspicious patterns
        if len(sessions) > 5:
            warnings.append("More than 5 active sessions detected")
            recommendations.append("Review your sessions and revoke unknown devices")

        # Check token age
        token_age = timezone.now().timestamp() - token_claims.get("iat", 0)
        if token_age > 3600:  # More than 1 hour
            warnings.append("Current session is older than 1 hour")
            recommendations.append("Consider refreshing your token")

        status_value = "suspicious" if warnings else "secure"

        logger.info(
            f"Security check for user {user_id}: {status_value}"
        )

        return Response(
            {
                "status": status_value,
                "warnings": warnings,
                "recommendations": recommendations,
            },
            status=status.HTTP_200_OK,
        )
