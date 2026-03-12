"""
Token Blacklist/Revocation System

Manages token revocation using Redis for high-performance lookups.
Prevents use of revoked tokens (e.g., after logout).
"""

from typing import Optional, List
from datetime import datetime
import logging
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class TokenBlacklist:
    """
    Redis-backed token blacklist system for managing revoked tokens.
    Uses JTI (unique token ID) to track which tokens are revoked.
    """

    # Redis key prefix for blacklist
    BLACKLIST_PREFIX = "token_blacklist:"
    # Redis key prefix for user sessions (for logout-all)
    USER_SESSIONS_PREFIX = "user_sessions:"

    @staticmethod
    def get_blacklist_key(jti: str) -> str:
        """Generate Redis key for a specific JTI."""
        return f"{TokenBlacklist.BLACKLIST_PREFIX}{jti}"

    @staticmethod
    def get_user_sessions_key(user_id: str) -> str:
        """Generate Redis key for user's active session JTIs."""
        return f"{TokenBlacklist.USER_SESSIONS_PREFIX}{user_id}"

    @classmethod
    def revoke_token(
        cls, jti: str, ttl_seconds: int, reason: str = "logout"
    ) -> bool:
        """
        Add token JTI to blacklist.

        Args:
            jti: Unique token ID to revoke
            ttl_seconds: Time to keep in blacklist (usually token expiration time)
            reason: Reason for revocation (logout, security, etc.)

        Returns:
            True if revoked successfully
        """
        key = cls.get_blacklist_key(jti)
        value = {
            "revoked_at": int(datetime.utcnow().timestamp()),
            "reason": reason,
        }

        try:
            # Store in Redis with expiration = token TTL
            # After token naturally expires, Redis auto-deletes entry
            cache.set(key, value, timeout=ttl_seconds)
            logger.info(f"Revoked token: {jti}, reason: {reason}")
            return True
        except Exception as e:
            logger.error(f"Failed to revoke token {jti}: {str(e)}")
            return False

    @classmethod
    def is_revoked(cls, jti: str) -> bool:
        """
        Check if token JTI is in blacklist.

        Args:
            jti: Unique token ID to check

        Returns:
            True if revoked, False if still valid
        """
        key = cls.get_blacklist_key(jti)
        try:
            value = cache.get(key)
            return value is not None
        except Exception as e:
            logger.error(f"Error checking blacklist for {jti}: {str(e)}")
            # Fail secure: if Redis is down, reject token
            return True

    @classmethod
    def track_session(cls, user_id: str, jti: str) -> bool:
        """
        Track active session JTI for a user (for logout-all).

        Args:
            user_id: User's UUID
            jti: Refresh token JTI

        Returns:
            True if tracked successfully
        """
        key = cls.get_user_sessions_key(user_id)

        try:
            # Get existing sessions
            sessions = cache.get(key, [])
            if not isinstance(sessions, list):
                sessions = []

            # Add new session if not already present
            if jti not in sessions:
                sessions.append(jti)

            # Keep in cache for 7 days (refresh token TTL)
            cache.set(key, sessions, timeout=7 * 24 * 3600)
            logger.info(f"Tracked session for user {user_id}: {jti}")
            return True
        except Exception as e:
            logger.error(f"Failed to track session for {user_id}: {str(e)}")
            return False

    @classmethod
    def get_user_sessions(cls, user_id: str) -> List[str]:
        """
        Get all active session JTIs for a user.

        Args:
            user_id: User's UUID

        Returns:
            List of active session JTIs
        """
        key = cls.get_user_sessions_key(user_id)

        try:
            sessions = cache.get(key, [])
            return sessions if isinstance(sessions, list) else []
        except Exception as e:
            logger.error(f"Error getting sessions for {user_id}: {str(e)}")
            return []

    @classmethod
    def revoke_user_session(cls, user_id: str, jti: str) -> bool:
        """
        Revoke a specific session for a user (logout from one device).

        Args:
            user_id: User's UUID
            jti: Session JTI to revoke

        Returns:
            True if revoked successfully
        """
        sessions = cls.get_user_sessions(user_id)

        try:
            # Remove this session
            if jti in sessions:
                sessions.remove(jti)
                key = cls.get_user_sessions_key(user_id)
                cache.set(key, sessions, timeout=7 * 24 * 3600)

            # Also add to blacklist
            cls.revoke_token(jti, ttl_seconds=7 * 24 * 3600, reason="device_logout")
            logger.info(f"Revoked session {jti} for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to revoke session for {user_id}: {str(e)}")
            return False

    @classmethod
    def revoke_all_user_sessions(cls, user_id: str) -> bool:
        """
        Revoke all sessions for a user (logout from all devices).

        Args:
            user_id: User's UUID

        Returns:
            True if all sessions revoked successfully
        """
        sessions = cls.get_user_sessions(user_id)

        try:
            # Revoke all session JTIs
            for jti in sessions:
                cls.revoke_token(
                    jti, ttl_seconds=7 * 24 * 3600, reason="logout_all_devices"
                )

            # Clear user sessions
            key = cls.get_user_sessions_key(user_id)
            cache.delete(key)

            logger.info(f"Revoked all sessions for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to revoke all sessions for {user_id}: {str(e)}")
            return False

    @classmethod
    def clear_user_sessions(cls, user_id: str) -> bool:
        """
        Clear session tracking for a user (after user deleted/deactivated).

        Args:
            user_id: User's UUID

        Returns:
            True if cleared successfully
        """
        key = cls.get_user_sessions_key(user_id)

        try:
            cache.delete(key)
            logger.info(f"Cleared session tracking for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to clear sessions for {user_id}: {str(e)}")
            return False

    @classmethod
    def get_stats(cls) -> dict:
        """
        Get blacklist statistics for monitoring.

        Returns:
            Dict with blacklist stats
        """
        try:
            # Note: This is a simple implementation
            # In production, you'd want to use Redis KEYS or maintain counters
            return {
                "status": "operational",
                "backend": "redis",
                "note": "Use Redis SCAN to get accurate counts",
            }
        except Exception as e:
            logger.error(f"Error getting blacklist stats: {str(e)}")
            return {"status": "error", "message": str(e)}


class SessionManager:
    """
    Manages user sessions for multi-device tracking.
    Tracks which devices are logged in for each user.
    """

    DEVICE_SESSIONS_PREFIX = "device_sessions:"

    @staticmethod
    def get_device_session_key(user_id: str, device_id: str) -> str:
        """Generate Redis key for device session."""
        return f"{SessionManager.DEVICE_SESSIONS_PREFIX}{user_id}:{device_id}"

    @classmethod
    def create_session(
        cls,
        user_id: str,
        device_id: str,
        device_type: str,
        jti: str,
        ttl_seconds: int = 7 * 24 * 3600,
    ) -> bool:
        """
        Create or update a device session.

        Args:
            user_id: User's UUID
            device_id: Device identifier
            device_type: Type of device (web, mobile, pwa, etc.)
            jti: Refresh token JTI
            ttl_seconds: Session TTL

        Returns:
            True if session created
        """
        key = cls.get_device_session_key(user_id, device_id)
        session_data = {
            "device_id": device_id,
            "device_type": device_type,
            "refresh_token_jti": jti,
            "created_at": int(datetime.utcnow().timestamp()),
            "last_activity_at": int(datetime.utcnow().timestamp()),
        }

        try:
            cache.set(key, session_data, timeout=ttl_seconds)
            logger.info(f"Created session for user {user_id} on device {device_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to create session: {str(e)}")
            return False

    @classmethod
    def update_activity(cls, user_id: str, device_id: str) -> bool:
        """
        Update last activity timestamp for device session.

        Args:
            user_id: User's UUID
            device_id: Device identifier

        Returns:
            True if updated
        """
        key = cls.get_device_session_key(user_id, device_id)

        try:
            session_data = cache.get(key, {})
            if session_data:
                session_data["last_activity_at"] = int(datetime.utcnow().timestamp())
                cache.set(key, session_data, timeout=7 * 24 * 3600)
            return bool(session_data)
        except Exception as e:
            logger.error(f"Failed to update activity: {str(e)}")
            return False

    @classmethod
    def get_session(cls, user_id: str, device_id: str) -> Optional[dict]:
        """
        Get device session details.

        Args:
            user_id: User's UUID
            device_id: Device identifier

        Returns:
            Session data dict or None
        """
        key = cls.get_device_session_key(user_id, device_id)

        try:
            return cache.get(key)
        except Exception as e:
            logger.error(f"Error getting session: {str(e)}")
            return None

    @classmethod
    def delete_session(cls, user_id: str, device_id: str) -> bool:
        """
        Delete a device session.

        Args:
            user_id: User's UUID
            device_id: Device identifier

        Returns:
            True if deleted
        """
        key = cls.get_device_session_key(user_id, device_id)

        try:
            cache.delete(key)
            logger.info(f"Deleted session for user {user_id} on device {device_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete session: {str(e)}")
            return False
