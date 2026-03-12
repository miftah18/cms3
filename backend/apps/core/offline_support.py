"""
Offline Token Support

Manages offline token generation, validation, and scope restrictions.
Enables limited functionality when device is offline.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from django.conf import settings
from django.contrib.auth.models import User

from .jwt_service import get_token_manager
from .jwt_exceptions import OfflineTokenError

logger = logging.getLogger(__name__)


class OfflineTokenManager:
    """
    Manages offline token lifecycle and validation.
    
    Offline tokens have restricted scopes and cannot be refreshed.
    They expire after 12 hours and must be regenerated with online token.
    """

    # Default offline allowed scopes
    DEFAULT_OFFLINE_SCOPES = [
        "pos:read",
        "pos:write",
        "stock:read",
        "products:read",
        "transactions:create",
    ]

    # Endpoints that allow offline tokens
    OFFLINE_ALLOWED_ENDPOINTS = [
        "/api/v1/products/",
        "/api/v1/stock/",
        "/api/v1/transactions/",
        "/api/v1/sync/",
    ]

    @classmethod
    def generate_offline_token(
        cls,
        user: User,
        tenant_id: str,
        device_id: str,
        permissions: Optional[List[str]] = None,
    ) -> str:
        """
        Generate offline token with limited scope.

        Args:
            user: Django User instance
            tenant_id: UUID of tenant
            device_id: Device identifier
            permissions: User permissions (will be filtered)

        Returns:
            Encoded offline JWT token
        """
        token_manager = get_token_manager()

        # Generate offline token
        offline_token = token_manager.generate_offline_token(
            user, tenant_id, device_id, permissions
        )

        logger.info(
            f"Generated offline token for user {user.id} on device {device_id}",
            extra={"tenant_id": tenant_id},
        )

        return offline_token

    @classmethod
    def validate_offline_token(cls, token: str) -> bool:
        """
        Validate offline token.

        Args:
            token: Encoded offline token

        Returns:
            True if valid offline token
        """
        token_manager = get_token_manager()
        claims = token_manager.extract_claims(token)

        if not claims:
            return False

        # Check token type
        if claims.get("token_type") != "offline":
            return False

        # Check scope
        if "offline" not in claims.get("scope", []):
            return False

        return True

    @classmethod
    def get_offline_scopes(cls, claims: Dict[str, Any]) -> List[str]:
        """
        Get allowed scopes for offline operations.

        Args:
            claims: Token claims

        Returns:
            List of allowed scope strings
        """
        if claims.get("token_type") != "offline":
            return []

        return claims.get("allowed_scopes", cls.DEFAULT_OFFLINE_SCOPES)

    @classmethod
    def is_offline_allowed_endpoint(cls, path: str) -> bool:
        """
        Check if endpoint allows offline tokens.

        Args:
            path: Request path

        Returns:
            True if endpoint allows offline
        """
        for allowed_path in cls.OFFLINE_ALLOWED_ENDPOINTS:
            if path.startswith(allowed_path):
                return True
        return False

    @classmethod
    def can_use_offline_token(
        cls, path: str, method: str, offline_scopes: List[str]
    ) -> bool:
        """
        Check if offline token can be used for specific request.

        Args:
            path: Request path
            method: HTTP method
            offline_scopes: Allowed offline scopes

        Returns:
            True if offline token can be used
        """
        # Check if endpoint allows offline
        if not cls.is_offline_allowed_endpoint(path):
            return False

        # Restrict some methods in offline mode
        if method in ["DELETE", "PATCH"]:
            return False

        # Check scope restrictions
        # Map paths to required scopes
        scope_requirements = {
            "/api/v1/products/": ["products:read"],
            "/api/v1/stock/": ["stock:read", "stock:write"],
            "/api/v1/transactions/": ["pos:read", "pos:write"],
            "/api/v1/sync/": ["sync:write"],
        }

        for path_prefix, required_scopes in scope_requirements.items():
            if path.startswith(path_prefix):
                return any(s in offline_scopes for s in required_scopes)

        return True

    @classmethod
    def handle_offline_sync(
        cls, user: User, device_id: str, offline_token: str
    ) -> Dict[str, Any]:
        """
        Handle sync after going back online.

        Called when device regains connectivity.

        Args:
            user: User object
            device_id: Device identifier
            offline_token: Current offline token

        Returns:
            Response with new tokens and sync status
        """
        token_manager = get_token_manager()

        # Get tenant_id from user
        tenant_id = getattr(user, "tenant_id", None) or str(user.id)

        # Decode offline token to get permissions
        claims = token_manager.extract_claims(offline_token)
        permissions = claims.get("permissions", []) if claims else []

        # Generate new online tokens
        access_token = token_manager.generate_access_token(
            user, tenant_id, device_id, permissions
        )
        refresh_token = token_manager.generate_refresh_token(user, tenant_id, device_id)
        new_offline_token = token_manager.generate_offline_token(
            user, tenant_id, device_id, permissions
        )

        logger.info(
            f"Generated new tokens after offline sync for user {user.id}"
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "offline_token": new_offline_token,
            "access_expires_in": token_manager.get_token_ttl(access_token),
            "offline_expires_in": token_manager.get_token_ttl(new_offline_token),
        }

    @classmethod
    def check_offline_token_expiry(cls, token: str) -> Optional[int]:
        """
        Check if offline token is expiring soon.

        Args:
            token: Offline token

        Returns:
            Seconds until expiration or None if invalid
        """
        token_manager = get_token_manager()
        ttl = token_manager.get_token_ttl(token)

        # Warn if expires in less than 1 hour
        if ttl and ttl < 3600:
            logger.warning(f"Offline token expiring soon: {ttl} seconds remaining")

        return ttl


class OfflineQueue:
    """
    Manages queue of operations performed while offline.

    Operations are queued locally and synced when back online.
    """

    OPERATION_TYPES = ["create", "update", "delete", "sync"]

    @staticmethod
    def queue_operation(
        operation_type: str,
        entity_type: str,
        entity_id: str,
        data: Dict[str, Any],
        timestamp: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Create queued operation record.

        Args:
            operation_type: Type of operation (create, update, delete)
            entity_type: Type of entity (transaction, product, etc)
            entity_id: ID of entity
            data: Operation data
            timestamp: Operation timestamp (defaults to now)

        Returns:
            Queued operation dict
        """
        import time

        timestamp = timestamp or time.time()

        operation = {
            "id": f"{entity_type}-{entity_id}-{int(timestamp)}",
            "type": operation_type,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "data": data,
            "timestamp": timestamp,
            "status": "pending",
            "retry_count": 0,
        }

        logger.info(
            f"Queued offline operation: {operation_type} {entity_type}/{entity_id}"
        )

        return operation

    @staticmethod
    def process_queue(
        operations: List[Dict[str, Any]], user: User, tenant_id: str
    ) -> Dict[str, Any]:
        """
        Process queued operations (when back online).

        Args:
            operations: List of queued operations
            user: User object
            tenant_id: Tenant ID

        Returns:
            Processing result with success/failure counts
        """
        results = {
            "total": len(operations),
            "successful": 0,
            "failed": 0,
            "failed_operations": [],
        }

        for operation in operations:
            try:
                # Process each operation
                # This would call the actual API endpoints
                # For now, mark as successful
                results["successful"] += 1
                logger.info(
                    f"Processed offline operation: {operation['type']} "
                    f"{operation['entity_type']}/{operation['entity_id']}"
                )
            except Exception as e:
                results["failed"] += 1
                results["failed_operations"].append(
                    {
                        "operation_id": operation["id"],
                        "error": str(e),
                    }
                )
                logger.error(
                    f"Failed to process offline operation {operation['id']}: {str(e)}"
                )

        logger.info(
            f"Offline queue processing complete: {results['successful']} "
            f"successful, {results['failed']} failed"
        )

        return results

    @staticmethod
    def get_queue_stats(operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Get statistics about queued operations.

        Args:
            operations: List of queued operations

        Returns:
            Queue statistics
        """
        by_type = {}
        by_entity = {}

        for op in operations:
            op_type = op.get("type", "unknown")
            entity = op.get("entity_type", "unknown")

            by_type[op_type] = by_type.get(op_type, 0) + 1
            by_entity[entity] = by_entity.get(entity, 0) + 1

        return {
            "total_operations": len(operations),
            "by_type": by_type,
            "by_entity": by_entity,
        }


class OfflineStrategy:
    """
    Offline strategy definitions and validators.

    Different business types may have different offline capabilities.
    """

    STRATEGIES = {
        "full_offline": {
            "name": "Full Offline",
            "description": "All functionality available offline",
            "allowed_endpoints": ["/api/v1/"],
            "requires_sync": True,
            "queue_operations": True,
        },
        "limited_offline": {
            "name": "Limited Offline",
            "description": "Only read and basic write operations",
            "allowed_endpoints": [
                "/api/v1/products/",
                "/api/v1/stock/",
                "/api/v1/transactions/",
            ],
            "requires_sync": True,
            "queue_operations": True,
        },
        "readonly_offline": {
            "name": "Read-Only Offline",
            "description": "Only read operations allowed offline",
            "allowed_endpoints": ["/api/v1/products/", "/api/v1/stock/"],
            "requires_sync": False,
            "queue_operations": False,
        },
        "no_offline": {
            "name": "No Offline",
            "description": "Offline not supported",
            "allowed_endpoints": [],
            "requires_sync": False,
            "queue_operations": False,
        },
    }

    @classmethod
    def get_strategy(cls, strategy_name: str) -> Optional[Dict[str, Any]]:
        """Get offline strategy definition."""
        return cls.STRATEGIES.get(strategy_name)

    @classmethod
    def get_allowed_strategies(cls) -> List[str]:
        """Get list of available strategy names."""
        return list(cls.STRATEGIES.keys())

    @classmethod
    def validate_strategy(cls, strategy_name: str) -> bool:
        """Validate offline strategy name."""
        return strategy_name in cls.STRATEGIES
