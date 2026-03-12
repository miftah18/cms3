"""
Authentication Serializers

Request and response serializers for JWT auth endpoints.
Validates email/password and formats token responses.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _


class LoginSerializer(serializers.Serializer):
    """Serializer for login endpoint validation."""

    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)
    device_id = serializers.CharField(max_length=255, required=False)
    device_type = serializers.CharField(
        max_length=50, required=False, default="web"
    )

    def validate(self, data):
        """Validate email and password."""
        email = data.get("email")
        password = data.get("password")

        if email and password:
            # Try to authenticate using email (username field in Django)
            user = authenticate(username=email, password=password)

            if not user:
                msg = _("Unable to log in with provided credentials.")
                raise serializers.ValidationError(msg)

            data["user"] = user
        else:
            msg = _("Must include 'email' and 'password'.")
            raise serializers.ValidationError(msg)

        return data


class TokenResponseSerializer(serializers.Serializer):
    """Serializer for token response."""

    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    offline_token = serializers.CharField()
    expires_in = serializers.IntegerField()  # Seconds until access token expires
    refresh_expires_in = serializers.IntegerField()  # Seconds for refresh token
    offline_expires_in = serializers.IntegerField()  # Seconds for offline token
    token_type = serializers.CharField(default="Bearer")
    user = serializers.SerializerMethodField()

    def get_user(self, obj):
        """Include basic user info in response."""
        user = obj.get("user")
        if user:
            return {
                "id": str(user.id),
                "email": user.email,
                "name": user.get_full_name() or user.username,
            }
        return None


class RefreshTokenSerializer(serializers.Serializer):
    """Serializer for refresh token endpoint."""

    refresh_token = serializers.CharField(required=True)
    device_id = serializers.CharField(max_length=255, required=False)

    def validate_refresh_token(self, value):
        """Validate refresh token format."""
        if not value:
            raise serializers.ValidationError("Refresh token is required.")
        return value


class LogoutSerializer(serializers.Serializer):
    """Serializer for logout endpoint."""

    refresh_token = serializers.CharField(required=False)
    device_id = serializers.CharField(max_length=255, required=False)
    logout_all_devices = serializers.BooleanField(required=False, default=False)


class TokenStatusSerializer(serializers.Serializer):
    """Serializer for token status check endpoint."""

    access_token = serializers.CharField(required=False)
    refresh_token = serializers.CharField(required=False)
    offline_token = serializers.CharField(required=False)


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change endpoint."""

    old_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        """Validate password change request."""
        if data["new_password"] != data["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Passwords do not match."}
            )

        if data["new_password"] == data["old_password"]:
            raise serializers.ValidationError(
                {"new_password": "New password must be different from old password."}
            )

        # Check password strength (minimum 8 chars)
        if len(data["new_password"]) < 8:
            raise serializers.ValidationError(
                {"new_password": "Password must be at least 8 characters long."}
            )

        return data


class PINSetupSerializer(serializers.Serializer):
    """Serializer for PIN setup endpoint."""

    pin = serializers.CharField(
        max_length=6, min_length=4, write_only=True, required=True
    )

    def validate_pin(self, value):
        """Validate PIN format."""
        if not value.isdigit():
            raise serializers.ValidationError("PIN must contain only digits.")
        return value


class PINVerifySerializer(serializers.Serializer):
    """Serializer for PIN verification endpoint."""

    pin = serializers.CharField(max_length=6, write_only=True, required=True)
    device_id = serializers.CharField(max_length=255, required=False)

    def validate_pin(self, value):
        """Validate PIN format."""
        if not value.isdigit():
            raise serializers.ValidationError("PIN must contain only digits.")
        return value


class SessionListSerializer(serializers.Serializer):
    """Serializer for listing user sessions."""

    device_id = serializers.CharField()
    device_type = serializers.CharField()
    created_at = serializers.DateTimeField()
    last_activity_at = serializers.DateTimeField()
    is_current_device = serializers.BooleanField()


class RevokeSessionSerializer(serializers.Serializer):
    """Serializer for revoking a specific session."""

    device_id = serializers.CharField(required=True)
