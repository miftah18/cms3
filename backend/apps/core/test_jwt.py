"""
JWT Authentication Tests

Comprehensive test suite for JWT implementation.
"""

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
import json

from .jwt_service import TokenManager, get_token_manager
from .blacklist import TokenBlacklist, SessionManager
from .offline_support import OfflineTokenManager


class TokenManagerTestCase(TestCase):
    """Test TokenManager functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.token_manager = get_token_manager()
        self.tenant_id = "test-tenant-uuid"
        self.device_id = "test-device-1"

    def test_generate_access_token(self):
        """Test access token generation."""
        token = self.token_manager.generate_access_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        self.assertIsNotNone(token)
        self.assertIsInstance(token, str)

        # Verify token can be decoded
        claims = self.token_manager.extract_claims(token)
        self.assertIsNotNone(claims)
        self.assertEqual(claims["user_id"], str(self.user.id))
        self.assertEqual(claims["tenant_id"], self.tenant_id)
        self.assertEqual(claims["device_id"], self.device_id)
        self.assertEqual(claims["token_type"], "access")

    def test_generate_refresh_token(self):
        """Test refresh token generation."""
        token = self.token_manager.generate_refresh_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        self.assertIsNotNone(token)

        claims = self.token_manager.extract_claims(token)
        self.assertEqual(claims["token_type"], "refresh")
        self.assertEqual(claims["user_id"], str(self.user.id))

    def test_generate_offline_token(self):
        """Test offline token generation."""
        token = self.token_manager.generate_offline_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        self.assertIsNotNone(token)

        claims = self.token_manager.extract_claims(token)
        self.assertEqual(claims["token_type"], "offline")
        self.assertIn("offline", claims["scope"])

    def test_validate_token(self):
        """Test token validation."""
        token = self.token_manager.generate_access_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        self.assertTrue(self.token_manager.validate_token(token))
        self.assertTrue(
            self.token_manager.validate_token(token, token_type="access")
        )
        self.assertFalse(
            self.token_manager.validate_token(token, token_type="refresh")
        )

    def test_extract_jti(self):
        """Test JTI extraction."""
        token = self.token_manager.generate_access_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        jti = self.token_manager.extract_jti(token)
        self.assertIsNotNone(jti)
        self.assertIsInstance(jti, str)

    def test_get_token_ttl(self):
        """Test token TTL retrieval."""
        token = self.token_manager.generate_access_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        ttl = self.token_manager.get_token_ttl(token)
        self.assertIsNotNone(ttl)
        self.assertGreater(ttl, 0)
        self.assertLess(ttl, 901)  # 15 minutes


class TokenBlacklistTestCase(TestCase):
    """Test TokenBlacklist functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.jti = "test-token-jti-123"
        self.user_id = "test-user-uuid"

    def test_revoke_token(self):
        """Test token revocation."""
        success = TokenBlacklist.revoke_token(
            self.jti,
            ttl_seconds=3600,
            reason="logout"
        )

        self.assertTrue(success)
        self.assertTrue(TokenBlacklist.is_revoked(self.jti))

    def test_is_revoked(self):
        """Test revocation check."""
        # Not revoked initially
        self.assertFalse(TokenBlacklist.is_revoked(self.jti))

        # Revoke token
        TokenBlacklist.revoke_token(self.jti, 3600, "logout")

        # Should be revoked now
        self.assertTrue(TokenBlacklist.is_revoked(self.jti))

    def test_track_session(self):
        """Test session tracking."""
        success = TokenBlacklist.track_session(self.user_id, self.jti)

        self.assertTrue(success)

        sessions = TokenBlacklist.get_user_sessions(self.user_id)
        self.assertIn(self.jti, sessions)

    def test_revoke_user_session(self):
        """Test individual session revocation."""
        # Track session
        TokenBlacklist.track_session(self.user_id, self.jti)

        # Revoke session
        TokenBlacklist.revoke_user_session(self.user_id, self.jti)

        # Session should be revoked
        self.assertTrue(TokenBlacklist.is_revoked(self.jti))

    def test_revoke_all_user_sessions(self):
        """Test revoking all user sessions."""
        jti1 = "test-jti-1"
        jti2 = "test-jti-2"
        jti3 = "test-jti-3"

        # Track multiple sessions
        TokenBlacklist.track_session(self.user_id, jti1)
        TokenBlacklist.track_session(self.user_id, jti2)
        TokenBlacklist.track_session(self.user_id, jti3)

        # Revoke all
        success = TokenBlacklist.revoke_all_user_sessions(self.user_id)

        self.assertTrue(success)
        self.assertTrue(TokenBlacklist.is_revoked(jti1))
        self.assertTrue(TokenBlacklist.is_revoked(jti2))
        self.assertTrue(TokenBlacklist.is_revoked(jti3))


class AuthenticationAPITestCase(TestCase):
    """Test authentication API endpoints."""

    def setUp(self):
        """Set up test fixtures."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )

    def test_login_endpoint(self):
        """Test login endpoint."""
        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "test@example.com",
                "password": "testpass123",
                "device_id": "test-device",
                "device_type": "web"
            }
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn("access_token", data)
        self.assertIn("refresh_token", data)
        self.assertIn("offline_token", data)
        self.assertEqual(data["token_type"], "Bearer")

    def test_login_with_invalid_credentials(self):
        """Test login with invalid credentials."""
        response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "test@example.com",
                "password": "wrongpassword"
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_refresh_token_endpoint(self):
        """Test token refresh endpoint."""
        # First, login to get tokens
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "test@example.com",
                "password": "testpass123"
            }
        )

        refresh_token = login_response.json()["refresh_token"]

        # Now refresh
        response = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh_token": refresh_token}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn("access_token", data)
        self.assertIn("refresh_token", data)

    def test_logout_endpoint(self):
        """Test logout endpoint."""
        # Login first
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "test@example.com",
                "password": "testpass123"
            }
        )

        refresh_token = login_response.json()["refresh_token"]

        # Logout
        response = self.client.post(
            "/api/v1/auth/logout/",
            {"refresh_token": refresh_token}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Try to use refresh token (should fail)
        refresh_response = self.client.post(
            "/api/v1/auth/refresh/",
            {"refresh_token": refresh_token}
        )

        # Should fail because token is revoked
        self.assertNotEqual(refresh_response.status_code, status.HTTP_200_OK)

    def test_token_status_endpoint(self):
        """Test token status check endpoint."""
        # Login to get token
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {
                "email": "test@example.com",
                "password": "testpass123"
            }
        )

        access_token = login_response.json()["access_token"]

        # Check status
        response = self.client.post(
            "/api/v1/auth/token-status/",
            {"access_token": access_token}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn("access_token", data)
        self.assertTrue(data["access_token"]["valid"])


class OfflineTokenTestCase(TestCase):
    """Test offline token functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123"
        )
        self.tenant_id = "test-tenant"
        self.device_id = "test-device"

    def test_generate_offline_token(self):
        """Test offline token generation."""
        token = OfflineTokenManager.generate_offline_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        self.assertIsNotNone(token)

    def test_validate_offline_token(self):
        """Test offline token validation."""
        token = OfflineTokenManager.generate_offline_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        self.assertTrue(OfflineTokenManager.validate_offline_token(token))

    def test_offline_scope_restriction(self):
        """Test offline scope restrictions."""
        token = OfflineTokenManager.generate_offline_token(
            self.user,
            self.tenant_id,
            self.device_id
        )

        token_manager = get_token_manager()
        claims = token_manager.extract_claims(token)
        scopes = OfflineTokenManager.get_offline_scopes(claims)

        self.assertIn("pos:read", scopes)
        self.assertGreater(len(scopes), 0)


class SessionManagementTestCase(TestCase):
    """Test session management functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.user_id = "test-user-uuid"
        self.device_id = "test-device-1"
        self.jti = "test-jti"

    def test_create_session(self):
        """Test session creation."""
        success = SessionManager.create_session(
            self.user_id,
            self.device_id,
            "web",
            self.jti
        )

        self.assertTrue(success)

    def test_get_session(self):
        """Test retrieving session."""
        SessionManager.create_session(
            self.user_id,
            self.device_id,
            "web",
            self.jti
        )

        session = SessionManager.get_session(self.user_id, self.device_id)
        self.assertIsNotNone(session)
        self.assertEqual(session["device_id"], self.device_id)

    def test_update_activity(self):
        """Test updating session activity."""
        SessionManager.create_session(
            self.user_id,
            self.device_id,
            "web",
            self.jti
        )

        success = SessionManager.update_activity(self.user_id, self.device_id)
        self.assertTrue(success)

    def test_delete_session(self):
        """Test deleting session."""
        SessionManager.create_session(
            self.user_id,
            self.device_id,
            "web",
            self.jti
        )

        success = SessionManager.delete_session(self.user_id, self.device_id)
        self.assertTrue(success)

        session = SessionManager.get_session(self.user_id, self.device_id)
        self.assertIsNone(session)
