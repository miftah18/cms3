"""
Authentication URL Routing

Maps JWT auth endpoints to their views.
"""

from django.urls import path, include
from .auth_views import (
    LoginView,
    RefreshTokenView,
    LogoutView,
    TokenStatusView,
)

app_name = "auth"

urlpatterns = [
    # Authentication endpoints
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshTokenView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("token-status/", TokenStatusView.as_view(), name="token-status"),
    
    # Session management endpoints
    path("sessions/", include("apps.core.session_urls")),
    
    # Offline support endpoints
    path("offline/", include("apps.core.offline_urls")),
]
