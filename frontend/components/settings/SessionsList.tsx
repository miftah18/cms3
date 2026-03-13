'use client';

import { useSession } from '@/lib/hooks/useSession';
import { useState } from 'react';

export function SessionsList() {
  const { sessions, loading, error, revokeSession, revokeAllOtherSessions } = useSession();
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await revokeSession(sessionId);
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (confirm('Are you sure you want to revoke all other sessions?')) {
      setRevoking('all');
      try {
        await revokeAllOtherSessions();
      } finally {
        setRevoking(null);
      }
    }
  };

  if (loading) return <div className="text-center py-4">Loading sessions...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">Active Sessions</h3>
        <button
          onClick={handleRevokeAll}
          disabled={sessions.length <= 1 || revoking === 'all'}
          className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          Revoke All Other
        </button>
      </div>

      <div className="space-y-3">
        {sessions.map(session => (
          <div
            key={session.id}
            className="bg-card border border-border rounded-lg p-4 flex justify-between items-start"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-medium text-foreground">{session.device}</p>
                {session.isCurrent && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                    Current
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{session.ipAddress}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Last active: {new Date(session.lastActiveAt).toLocaleString()}
              </p>
            </div>
            {!session.isCurrent && (
              <button
                onClick={() => handleRevoke(session.id)}
                disabled={revoking === session.id}
                className="ml-4 px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {revoking === session.id ? 'Revoking...' : 'Revoke'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
