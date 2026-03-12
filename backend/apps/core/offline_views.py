"""
Offline Support Views

Endpoints for offline token and sync operations.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import logging

from .offline_support import (
    OfflineTokenManager,
    OfflineQueue,
    OfflineStrategy,
)
from .jwt_service import get_token_manager
from .jwt_exceptions import OfflineTokenError
from .audit import audit_action

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class OfflineTokenGenerateView(APIView):
    """
    POST /auth/offline/token/
    Generate offline token for offline operations.
    """

    permission_classes = [IsAuthenticated]

    @audit_action(action="auth.offline_token_generate", entity_type="authentication")
    def post(self, request):
        """
        Generate offline token from access token.

        Request:
        {
            "device_id": "device-uuid"
        }

        Returns:
        {
            "offline_token": "eyJ...",
            "expires_in": 43200,
            "allowed_scopes": ["pos:read", "pos:write"],
            "sync_on_online": true
        }
        """
        user = request.user
        token_claims = getattr(request, "token_claims", {})
        device_id = request.data.get("device_id", token_claims.get("device_id"))

        tenant_id = token_claims.get("tenant_id") or str(user.id)
        permissions = token_claims.get("permissions", [])

        # Generate offline token
        offline_token = OfflineTokenManager.generate_offline_token(
            user, tenant_id, device_id, permissions
        )

        # Get token TTL
        token_manager = get_token_manager()
        ttl = token_manager.get_token_ttl(offline_token)

        # Get allowed scopes
        offline_claims = token_manager.extract_claims(offline_token)
        allowed_scopes = offline_claims.get("allowed_scopes", [])

        logger.info(f"Generated offline token for user {user.id} on device {device_id}")

        return Response(
            {
                "offline_token": offline_token,
                "expires_in": ttl,
                "allowed_scopes": allowed_scopes,
                "sync_on_online": True,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name="dispatch")
class OfflineTokenValidateView(APIView):
    """
    POST /auth/offline/validate/
    Validate offline token and check scope.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        """
        Validate offline token.

        Request:
        {
            "offline_token": "eyJ...",
            "check_endpoint": "/api/v1/transactions/"
        }

        Returns:
        {
            "valid": true,
            "expires_in": 43000,
            "allowed_scopes": ["pos:read", "pos:write"],
            "can_access_endpoint": true,
            "reason": null
        }
        """
        offline_token = request.data.get("offline_token")
        endpoint = request.data.get("check_endpoint")

        if not offline_token:
            return Response(
                {"error": "offline_token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate token
        token_manager = get_token_manager()
        claims = token_manager.extract_claims(offline_token)

        if not claims:
            return Response(
                {
                    "valid": False,
                    "reason": "Invalid token format",
                },
                status=status.HTTP_200_OK,
            )

        # Check if offline token
        if claims.get("token_type") != "offline":
            return Response(
                {
                    "valid": False,
                    "reason": "Not an offline token",
                },
                status=status.HTTP_200_OK,
            )

        ttl = token_manager.get_token_ttl(offline_token)
        allowed_scopes = claims.get("allowed_scopes", [])

        # Check endpoint access
        can_access = True
        reason = None

        if endpoint:
            can_access = OfflineTokenManager.can_use_offline_token(
                endpoint, "GET", allowed_scopes
            )
            if not can_access:
                reason = f"Offline token cannot access {endpoint}"

        logger.debug(f"Validated offline token: valid={claims is not None}")

        return Response(
            {
                "valid": True,
                "expires_in": ttl,
                "allowed_scopes": allowed_scopes,
                "can_access_endpoint": can_access,
                "reason": reason,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name="dispatch")
class OfflineSyncView(APIView):
    """
    POST /auth/offline/sync/
    Handle sync when device comes back online.
    """

    permission_classes = [IsAuthenticated]

    @audit_action(action="auth.offline_sync", entity_type="sync")
    def post(self, request):
        """
        Process offline sync.

        Request:
        {
            "offline_token": "eyJ...",
            "queued_operations": [
                {
                    "type": "create",
                    "entity_type": "transaction",
                    "entity_id": "txn-123",
                    "data": {...}
                }
            ]
        }

        Returns:
        {
            "status": "synced",
            "new_tokens": {...},
            "processed_operations": {
                "total": 5,
                "successful": 4,
                "failed": 1,
                "failed_operations": [...]
            }
        }
        """
        user = request.user
        token_claims = getattr(request, "token_claims", {})
        offline_token = request.data.get("offline_token")
        queued_operations = request.data.get("queued_operations", [])

        tenant_id = token_claims.get("tenant_id") or str(user.id)

        # Validate offline token
        if offline_token:
            is_valid = OfflineTokenManager.validate_offline_token(offline_token)
            if not is_valid:
                logger.warning(f"Invalid offline token for sync by user {user.id}")
                return Response(
                    {"error": "Invalid offline token"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Process queued operations
        processing_results = OfflineQueue.process_queue(
            queued_operations, user, tenant_id
        )

        # Generate new tokens for next offline period
        device_id = token_claims.get("device_id")
        new_tokens_data = None

        if offline_token:
            new_tokens_data = OfflineTokenManager.handle_offline_sync(
                user, device_id, offline_token
            )

        logger.info(
            f"Offline sync complete for user {user.id}: "
            f"{processing_results['successful']} successful, "
            f"{processing_results['failed']} failed"
        )

        return Response(
            {
                "status": "synced",
                "new_tokens": new_tokens_data,
                "processed_operations": processing_results,
            },
            status=status.HTTP_200_OK,
        )


class OfflineQueueStatusView(APIView):
    """
    GET /auth/offline/queue-status/
    Get status of offline operation queue.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get offline queue statistics.

        Returns:
        {
            "queue_stats": {
                "total_operations": 5,
                "by_type": {...},
                "by_entity": {...}
            },
            "offline_token_status": {
                "has_valid_token": true,
                "expires_in": 43000
            }
        }
        """
        user = request.user
        token_claims = getattr(request, "token_claims", {})

        # Get queue stats from localStorage (frontend)
        # This endpoint mainly returns offline token status
        offline_token = request.data.get("offline_token")

        offline_token_status = {
            "has_valid_token": False,
            "expires_in": None,
        }

        if offline_token:
            is_valid = OfflineTokenManager.validate_offline_token(offline_token)
            if is_valid:
                token_manager = get_token_manager()
                ttl = token_manager.get_token_ttl(offline_token)
                offline_token_status = {
                    "has_valid_token": True,
                    "expires_in": ttl,
                }

        logger.debug(f"Retrieved offline queue status for user {user.id}")

        return Response(
            {
                "offline_token_status": offline_token_status,
            },
            status=status.HTTP_200_OK,
        )


class OfflineStrategyView(APIView):
    """
    GET /auth/offline/strategy/
    Get offline strategy for tenant/business type.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get offline strategy configuration.

        Returns:
        {
            "strategy": "limited_offline",
            "config": {
                "name": "Limited Offline",
                "description": "...",
                "allowed_endpoints": [...],
                "requires_sync": true,
                "queue_operations": true
            },
            "available_strategies": [...]
        }
        """
        # Get user's tenant offline strategy
        # For now, use limited_offline as default
        strategy_name = "limited_offline"

        strategy = OfflineStrategy.get_strategy(strategy_name)
        available_strategies = OfflineStrategy.get_allowed_strategies()

        logger.debug(f"Retrieved offline strategy for user {request.user.id}")

        return Response(
            {
                "strategy": strategy_name,
                "config": strategy,
                "available_strategies": available_strategies,
            },
            status=status.HTTP_200_OK,
        )
