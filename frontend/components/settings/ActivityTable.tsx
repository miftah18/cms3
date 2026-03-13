'use client';

import { useActivityLog } from '@/lib/hooks/useActivityLog';

export function ActivityTable() {
  const { logs, loading, error, pagination, fetchLogs } = useActivityLog();

  const handlePageChange = (newPage: number) => {
    fetchLogs(newPage, pagination.pageSize);
  };

  if (loading) return <div className="text-center py-4">Loading activity...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const totalPages = Math.ceil(pagination.count / pagination.pageSize);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Activity Log</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 font-semibold text-foreground">Action</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Resource</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">IP Address</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-border hover:bg-muted">
                <td className="py-3 px-4 text-foreground">{log.action}</td>
                <td className="py-3 px-4 text-muted-foreground">{log.resource}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      log.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                  {log.ipAddress}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No activity found</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1 rounded border border-border disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === totalPages}
            className="px-3 py-1 rounded border border-border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
