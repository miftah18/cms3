"""
Offline Support URL Routing

Maps offline endpoints to their views.
"""

from django.urls import path
from .offline_views import (
    OfflineTokenGenerateView,
    OfflineTokenValidateView,
    OfflineSyncView,
    OfflineQueueStatusView,
    OfflineStrategyView,
)

app_name = "offline"

urlpatterns = [
    # Offline token operations
    path("token/", OfflineTokenGenerateView.as_view(), name="token"),
    path("validate/", OfflineTokenValidateView.as_view(), name="validate"),
    
    # Offline sync
    path("sync/", OfflineSyncView.as_view(), name="sync"),
    path("queue-status/", OfflineQueueStatusView.as_view(), name="queue-status"),
    
    # Offline configuration
    path("strategy/", OfflineStrategyView.as_view(), name="strategy"),
]
