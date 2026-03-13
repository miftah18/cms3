'use client';

import { useOfflineMode } from '@/lib/hooks/useOfflineMode';
import { useState } from 'react';

export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingOperations, manualSync } = useOfflineMode();
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && pendingOperations === 0) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-4 right-4 rounded-lg shadow-lg p-4 max-w-xs z-50 border ${
        isOnline
          ? 'bg-yellow-50 border-yellow-200'
          : 'bg-red-50 border-red-200'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          {!isOnline ? (
            <div>
              <p className="font-medium text-red-900">You are offline</p>
              <p className="text-sm text-red-800">Changes will sync when online</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-yellow-900">Syncing data</p>
              <p className="text-sm text-yellow-800">{pendingOperations} pending changes</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {pendingOperations > 0 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-1 text-sm bg-white border border-current rounded hover:bg-opacity-90"
            >
              {showDetails ? 'Hide' : 'View'}
            </button>
          )}
          {!isSyncing && pendingOperations > 0 && (
            <button
              onClick={manualSync}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Sync
            </button>
          )}
          {isSyncing && (
            <span className="px-3 py-1 text-sm text-gray-600">Syncing...</span>
          )}
        </div>
      </div>

      {showDetails && pendingOperations > 0 && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <p className="text-xs font-medium mb-2 opacity-75">
            {pendingOperations} pending change{pendingOperations !== 1 ? 's' : ''}
          </p>
          <p className="text-xs opacity-75">
            These will be synced automatically when connection is restored
          </p>
        </div>
      )}
    </div>
  );
}
