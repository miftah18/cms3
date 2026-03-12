"""
Permission-Based Decorators

Decorators for enforcing permission checks based on JWT claims.
"""

from functools import wraps
from typing import List, Callable
from rest_framework.response import Response
from rest_framework import status
from .jwt_exceptions import InsufficientPermissionsError
import logging

logger = logging.getLogger(__name__)


def permission_required(*required_permissions: str):
    """
    Decorator to check if user has required permissions.

    Can be used on both function-based and class-based views.

    Usage:
        @permission_required('pos:write', 'stock:read')
        def my_view(request):
            pass

    Args:
        *required_permissions: Permission strings to check

    Raises:
        InsufficientPermissionsError: If user lacks required permissions
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Get token claims from request
            token_claims = getattr(request, "token_claims", {})
            user_permissions = token_claims.get("permissions", [])

            # Check if user has all required permissions
            missing_permissions = set(required_permissions) - set(user_permissions)

            if missing_permissions:
                logger.warning(
                    f"User {token_claims.get('user_id')} missing permissions: {missing_permissions}"
                )
                raise InsufficientPermissionsError(
                    f"Missing permissions: {', '.join(missing_permissions)}"
                )

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def offline_not_allowed():
    """
    Decorator to prevent offline tokens from being used.

    Usage:
        @offline_not_allowed()
        def sensitive_operation(request):
            pass

    Raises:
        InsufficientPermissionsError: If using offline token
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            token_claims = getattr(request, "token_claims", {})
            scope = token_claims.get("scope", [])

            if "offline" in scope:
                logger.warning(
                    f"Offline token used for offline-not-allowed endpoint by user {token_claims.get('user_id')}"
                )
                raise InsufficientPermissionsError(
                    "This operation requires online connectivity"
                )

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def require_device_id():
    """
    Decorator to ensure request includes valid device_id in token.

    Usage:
        @require_device_id()
        def device_specific_operation(request):
            pass

    Raises:
        InsufficientPermissionsError: If device_id missing
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            token_claims = getattr(request, "token_claims", {})
            device_id = token_claims.get("device_id")

            if not device_id:
                logger.warning(
                    f"Request missing device_id from token for user {token_claims.get('user_id')}"
                )
                raise InsufficientPermissionsError("Device identification required")

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def role_required(*required_roles: str):
    """
    Decorator to check if user has required role.

    Usage:
        @role_required('tenant_admin', 'tenant_owner')
        def admin_operation(request):
            pass

    Args:
        *required_roles: Role strings to check

    Raises:
        InsufficientPermissionsError: If user lacks required role
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            token_claims = getattr(request, "token_claims", {})
            user_role = token_claims.get("role")

            if user_role not in required_roles:
                logger.warning(
                    f"User {token_claims.get('user_id')} with role {user_role} "
                    f"attempted to access role-restricted endpoint"
                )
                raise InsufficientPermissionsError(
                    f"Requires one of roles: {', '.join(required_roles)}"
                )

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def scope_required(*required_scopes: str):
    """
    Decorator to check if token has required scope.

    Usage:
        @scope_required('online')
        def online_only(request):
            pass

    Args:
        *required_scopes: Scope strings to check

    Raises:
        InsufficientPermissionsError: If token lacks required scope
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            token_claims = getattr(request, "token_claims", {})
            token_scope = token_claims.get("scope", [])

            missing_scopes = set(required_scopes) - set(token_scope)

            if missing_scopes:
                logger.warning(
                    f"Token missing scopes: {missing_scopes} for user {token_claims.get('user_id')}"
                )
                raise InsufficientPermissionsError(
                    f"Token missing required scope: {', '.join(missing_scopes)}"
                )

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def tenant_required():
    """
    Decorator to ensure valid tenant context exists.

    Usage:
        @tenant_required()
        def tenant_specific_operation(request):
            pass

    Raises:
        InsufficientPermissionsError: If no valid tenant context
    """

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            token_claims = getattr(request, "token_claims", {})
            tenant_id = token_claims.get("tenant_id")

            if not tenant_id:
                logger.warning(
                    f"Request missing tenant context for user {token_claims.get('user_id')}"
                )
                raise InsufficientPermissionsError("Tenant context required")

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def check_offline_scope(view_func: Callable) -> Callable:
    """
    Decorator that modifies behavior based on offline scope.

    Restricts operations when using offline token.

    Usage:
        @check_offline_scope
        def mixed_operation(request):
            if is_offline_scope(request):
                # Limited operations only
            else:
                # Full operations
    """

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        # Attach helper function to request
        request.is_offline = is_offline_scope(request)
        request.allowed_offline_scopes = get_allowed_offline_scopes(request)

        return view_func(request, *args, **kwargs)

    return wrapper


def is_offline_scope(request) -> bool:
    """Check if current request is using offline token."""
    token_claims = getattr(request, "token_claims", {})
    return "offline" in token_claims.get("scope", [])


def get_allowed_offline_scopes(request) -> List[str]:
    """Get allowed scopes for offline operations."""
    token_claims = getattr(request, "token_claims", {})
    return token_claims.get("allowed_scopes", [])


def get_user_permissions(request) -> List[str]:
    """Helper to get user permissions from token."""
    token_claims = getattr(request, "token_claims", {})
    return token_claims.get("permissions", [])


def has_permission(request, permission: str) -> bool:
    """Check if user has specific permission."""
    return permission in get_user_permissions(request)


def has_any_permission(request, permissions: List[str]) -> bool:
    """Check if user has any of the permissions."""
    user_perms = get_user_permissions(request)
    return any(p in user_perms for p in permissions)


def has_all_permissions(request, permissions: List[str]) -> bool:
    """Check if user has all the permissions."""
    user_perms = get_user_permissions(request)
    return all(p in user_perms for p in permissions)
