"""
Session Management URL Routing

Maps session management endpoints to their views.
"""

from django.urls import path
from .session_views import (
    SessionListView,
    SessionDetailView,
    SessionRevokeView,
    SessionRevokeAllView,
    SessionTerminateAllView,
    SessionActivityView,
    SessionSecurityCheckView,
)

app_name = "sessions"

urlpatterns = [
    # Session management
    path("", SessionListView.as_view(), name="list"),
    path("<str:device_id>/", SessionDetailView.as_view(), name="detail"),
    path("<str:device_id>/revoke/", SessionRevokeView.as_view(), name="revoke"),
    path("revoke-all/", SessionRevokeAllView.as_view(), name="revoke-all"),
    path("terminate-all/", SessionTerminateAllView.as_view(), name="terminate-all"),
    path("activity/", SessionActivityView.as_view(), name="activity"),
    path("security-check/", SessionSecurityCheckView.as_view(), name="security-check"),
]
