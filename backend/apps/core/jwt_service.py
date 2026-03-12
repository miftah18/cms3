"""
JWT Token Service Module

Comprehensive JWT token management for the SaaS platform.
Handles generation, validation, and claims management.
"""

from datetime import datetime, timedelta
from typing import Dict, Optional, Any, List
from uuid import uuid4
import jwt
import logging
from django.conf import settings
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)


class TokenManager:
    """
    Manages JWT token generation and validation with custom claims.
    Supports multiple token types: access, refresh, and offline tokens.
    """

    # Token types
    TOKEN_TYPE_ACCESS = "access"
    TOKEN_TYPE_REFRESH = "refresh"
    TOKEN_TYPE_OFFLINE = "offline"

    def __init__(self):
        """Initialize token manager with Django settings."""
        self.algorithm = settings.SIMPLE_JWT.get("ALGORITHM", "RS256")
        self.signing_key = settings.SIMPLE_JWT.get("SIGNING_KEY")
        self.verifying_key = settings.SIMPLE_JWT.get("VERIFYING_KEY")

    def generate_access_token(
        self,
        user: User,
        tenant_id: str,
        device_id: str,
        permissions: Optional[List[str]] = None,
    ) -> str:
        """
        Generate access token with 15-minute TTL.

        Args:
            user: Django User instance
            tenant_id: UUID of tenant
            device_id: Device identifier
            permissions: List of permission strings

        Returns:
            Encoded JWT token
        """
        now = datetime.utcnow()
        ttl = settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME", timedelta(minutes=15))
        exp = now + ttl

        claims = {
            "jti": str(uuid4()),  # Unique token ID for revocation
            "user_id": str(user.id),
            "tenant_id": tenant_id,
            "role": getattr(user, "role", "user"),
            "permissions": permissions or [],
            "device_id": device_id,
            "device_type": "web",
            "scope": ["online"],
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
            "token_type": self.TOKEN_TYPE_ACCESS,
            "type": self.TOKEN_TYPE_ACCESS,  # For DRF simplejwt compatibility
        }

        token = jwt.encode(claims, self.signing_key, algorithm=self.algorithm)
        logger.info(
            f"Generated access token for user {user.id} on device {device_id}",
            extra={"tenant_id": tenant_id, "jti": claims["jti"]},
        )
        return token

    def generate_refresh_token(
        self, user: User, tenant_id: str, device_id: str
    ) -> str:
        """
        Generate refresh token with 7-day TTL.

        Args:
            user: Django User instance
            tenant_id: UUID of tenant
            device_id: Device identifier

        Returns:
            Encoded JWT token
        """
        now = datetime.utcnow()
        ttl = settings.SIMPLE_JWT.get("REFRESH_TOKEN_LIFETIME", timedelta(days=7))
        exp = now + ttl

        claims = {
            "jti": str(uuid4()),  # Unique token ID for revocation and rotation
            "user_id": str(user.id),
            "tenant_id": tenant_id,
            "device_id": device_id,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
            "token_type": self.TOKEN_TYPE_REFRESH,
            "type": self.TOKEN_TYPE_REFRESH,  # For DRF simplejwt compatibility
        }

        token = jwt.encode(claims, self.signing_key, algorithm=self.algorithm)
        logger.info(
            f"Generated refresh token for user {user.id} on device {device_id}",
            extra={"tenant_id": tenant_id, "jti": claims["jti"]},
        )
        return token

    def generate_offline_token(
        self,
        user: User,
        tenant_id: str,
        device_id: str,
        permissions: Optional[List[str]] = None,
    ) -> str:
        """
        Generate offline token with 12-hour TTL and limited scope.

        Args:
            user: Django User instance
            tenant_id: UUID of tenant
            device_id: Device identifier
            permissions: List of permission strings (subset for offline use)

        Returns:
            Encoded JWT token
        """
        now = datetime.utcnow()
        ttl = settings.OFFLINE_JWT.get("LIFETIME", timedelta(hours=12))
        exp = now + ttl

        # Restrict offline token permissions
        offline_scopes = settings.OFFLINE_JWT.get(
            "SCOPES", ["pos:read", "pos:write", "stock:read", "products:read"]
        )

        claims = {
            "jti": str(uuid4()),
            "user_id": str(user.id),
            "tenant_id": tenant_id,
            "device_id": device_id,
            "role": getattr(user, "role", "user"),
            "permissions": permissions or [],
            "scope": ["offline"],  # Mark as offline token
            "allowed_scopes": offline_scopes,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
            "token_type": self.TOKEN_TYPE_OFFLINE,
            "type": self.TOKEN_TYPE_OFFLINE,
        }

        token = jwt.encode(claims, self.signing_key, algorithm=self.algorithm)
        logger.info(
            f"Generated offline token for user {user.id} on device {device_id}",
            extra={"tenant_id": tenant_id, "jti": claims["jti"]},
        )
        return token

    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Decode and validate JWT token signature and expiration.

        Args:
            token: Encoded JWT token

        Returns:
            Decoded claims dict or None if invalid
        """
        try:
            claims = jwt.decode(
                token, self.verifying_key, algorithms=[self.algorithm]
            )
            return claims
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidSignatureError:
            logger.warning("Invalid token signature")
            return None
        except jwt.DecodeError:
            logger.warning("Failed to decode token")
            return None
        except Exception as e:
            logger.error(f"Unexpected error decoding token: {str(e)}")
            return None

    def validate_token(self, token: str, token_type: Optional[str] = None) -> bool:
        """
        Validate token and optionally check token type.

        Args:
            token: Encoded JWT token
            token_type: Optional token type to verify (access, refresh, offline)

        Returns:
            True if valid, False otherwise
        """
        claims = self.decode_token(token)
        if not claims:
            return False

        # Check token type if specified
        if token_type and claims.get("token_type") != token_type:
            logger.warning(
                f"Token type mismatch: expected {token_type}, got {claims.get('token_type')}"
            )
            return False

        return True

    def get_token_ttl(self, token: str) -> Optional[int]:
        """
        Get remaining TTL (time to live) for token in seconds.

        Args:
            token: Encoded JWT token

        Returns:
            Seconds until expiration or None if invalid
        """
        claims = self.decode_token(token)
        if not claims:
            return None

        exp = claims.get("exp", 0)
        now = int(datetime.utcnow().timestamp())
        ttl = exp - now

        return max(0, ttl)  # Return 0 if already expired

    def extract_jti(self, token: str) -> Optional[str]:
        """
        Extract JTI (unique token ID) from token for revocation tracking.

        Args:
            token: Encoded JWT token

        Returns:
            JTI string or None if invalid
        """
        claims = self.decode_token(token)
        return claims.get("jti") if claims else None

    def extract_claims(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Extract all claims from token.

        Args:
            token: Encoded JWT token

        Returns:
            Claims dict or None if invalid
        """
        return self.decode_token(token)


# Global token manager instance
_token_manager = None


def get_token_manager() -> TokenManager:
    """Get or create token manager singleton."""
    global _token_manager
    if _token_manager is None:
        _token_manager = TokenManager()
    return _token_manager
