"""
JWT-Related Database Models

Optional database models for persistent session tracking and audit logging.
Can be used alongside Redis-based blacklist for additional durability.
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid


class TokenBlacklistModel(models.Model):
    """
    Persistent token blacklist storage.

    Optional: Can be used alongside Redis for redundancy.
    Use Redis primarily, but sync revoked tokens to DB for audit/compliance.
    """

    TOKEN_TYPE_CHOICES = [
        ("access", "Access Token"),
        ("refresh", "Refresh Token"),
        ("offline", "Offline Token"),
    ]

    REVOKE_REASON_CHOICES = [
        ("logout", "User Logout"),
        ("logout_all_devices", "Logout All Devices"),
        ("device_logout", "Device Logout"),
        ("rotated", "Token Rotated"),
        ("security", "Security Revocation"),
        ("expired", "Token Expired"),
        ("manual", "Manual Revocation"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    jti = models.CharField(max_length=255, unique=True, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    token_type = models.CharField(max_length=20, choices=TOKEN_TYPE_CHOICES)
    reason = models.CharField(max_length=50, choices=REVOKE_REASON_CHOICES)

    blacklisted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "token_blacklist"
        indexes = [
            models.Index(fields=["user", "blacklisted_at"]),
            models.Index(fields=["expires_at"]),
        ]
        verbose_name = "Token Blacklist"
        verbose_name_plural = "Token Blacklists"

    def __str__(self):
        return f"Token {self.jti[:10]}... revoked on {self.blacklisted_at}"

    def is_expired(self):
        """Check if token expiration has passed."""
        return timezone.now() > self.expires_at


class UserSession(models.Model):
    """
    Track user device sessions for multi-device management.

    Persists session information for:
    - Device tracking
    - Session history
    - Logout-all functionality
    - Security auditing
    """

    DEVICE_TYPE_CHOICES = [
        ("web", "Web Browser"),
        ("mobile_ios", "iOS Mobile"),
        ("mobile_android", "Android Mobile"),
        ("pwa", "Progressive Web App"),
        ("desktop", "Desktop Application"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sessions"
    )
    tenant_id = models.UUIDField(db_index=True)

    device_id = models.CharField(max_length=255, db_index=True)
    device_type = models.CharField(max_length=50, choices=DEVICE_TYPE_CHOICES)
    device_name = models.CharField(max_length=255, blank=True)
    device_info = models.JSONField(default=dict, blank=True)

    refresh_token_jti = models.CharField(max_length=255, unique=True)
    access_token_jti = models.CharField(max_length=255, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_activity_at = models.DateTimeField(auto_now=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)

    is_active = models.BooleanField(default=True)
    is_revoked = models.BooleanField(default=False)

    class Meta:
        db_table = "user_sessions"
        indexes = [
            models.Index(fields=["user", "is_active"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["tenant_id", "is_active"]),
            models.Index(fields=["expires_at"]),
        ]
        verbose_name = "User Session"
        verbose_name_plural = "User Sessions"

    def __str__(self):
        return f"{self.user.email} - {self.device_id} ({self.device_type})"

    def is_expired(self):
        """Check if session has expired."""
        return timezone.now() > self.expires_at

    def revoke(self):
        """Revoke this session."""
        self.is_revoked = True
        self.is_active = False
        self.save(update_fields=["is_revoked", "is_active", "updated_at"])

    def update_activity(self):
        """Update last activity timestamp."""
        self.last_activity_at = timezone.now()
        self.save(update_fields=["last_activity_at"])


class TokenRefreshLog(models.Model):
    """
    Log token refresh events for security auditing.

    Tracks:
    - Token refresh attempts
    - Success/failure
    - IP address and user agent
    - Device information
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="token_refresh_logs"
    )
    tenant_id = models.UUIDField(db_index=True)

    device_id = models.CharField(max_length=255)
    old_refresh_jti = models.CharField(max_length=255)
    new_refresh_jti = models.CharField(max_length=255, blank=True)

    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)

    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "token_refresh_logs"
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["tenant_id", "created_at"]),
        ]
        verbose_name = "Token Refresh Log"
        verbose_name_plural = "Token Refresh Logs"

    def __str__(self):
        status = "Success" if self.success else "Failed"
        return f"{self.user.email} - {status} ({self.created_at})"


class AuthenticationLog(models.Model):
    """
    Log authentication events for security and compliance.

    Tracks:
    - Login attempts (success/failure)
    - Logout events
    - Failed authentication reasons
    - Device and location information
    """

    ACTION_CHOICES = [
        ("login", "Login"),
        ("login_failed", "Login Failed"),
        ("logout", "Logout"),
        ("logout_all", "Logout All Devices"),
        ("refresh_failed", "Refresh Failed"),
        ("token_revoked", "Token Revoked"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="authentication_logs", null=True, blank=True
    )
    tenant_id = models.UUIDField(db_index=True, null=True, blank=True)

    action = models.CharField(max_length=50, choices=ACTION_CHOICES, db_index=True)
    email = models.EmailField(db_index=True)

    device_id = models.CharField(max_length=255, blank=True)
    device_type = models.CharField(max_length=50, blank=True)

    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)

    success = models.BooleanField(default=True)
    reason = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "authentication_logs"
        indexes = [
            models.Index(fields=["email", "created_at"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["tenant_id", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]
        verbose_name = "Authentication Log"
        verbose_name_plural = "Authentication Logs"

    def __str__(self):
        return f"{self.email} - {self.action} ({self.created_at})"

    @classmethod
    def log_login(cls, email: str, user: User = None, tenant_id: str = None,
                  device_id: str = None, device_type: str = None,
                  ip_address: str = None, user_agent: str = None, success: bool = True):
        """Log a login attempt."""
        cls.objects.create(
            user=user,
            tenant_id=tenant_id,
            action="login" if success else "login_failed",
            email=email,
            device_id=device_id,
            device_type=device_type,
            ip_address=ip_address or "0.0.0.0",
            user_agent=user_agent or "",
            success=success,
        )

    @classmethod
    def log_logout(cls, user: User, tenant_id: str = None, device_id: str = None,
                   ip_address: str = None, user_agent: str = None):
        """Log a logout event."""
        cls.objects.create(
            user=user,
            tenant_id=tenant_id,
            action="logout",
            email=user.email,
            device_id=device_id or "",
            ip_address=ip_address or "0.0.0.0",
            user_agent=user_agent or "",
            success=True,
        )
