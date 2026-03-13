'use client';

import { useInventory } from '@/lib/hooks/useInventory';
import { useState } from 'react';

export default function InventoryPage() {
  const { logs, loading, error, fetchInventoryLogs } = useInventory();
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out' | 'adjustment'>('all');

  const filteredLogs = filterType === 'all' ? logs : logs.filter(l => l.type === filterType);

  if (loading) return <div className="text-center py-8">Loading inventory logs...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Inventory Management</h1>
        <p className="text-muted-foreground">Track all stock movements</p>
      </div>

      <div className="mb-6 flex gap-2">
        {(['all', 'in', 'out', 'adjustment'] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-lg transition-colors capitalize ${
              filterType === type
                ? 'bg-primary text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            }`}
          >
            {type === 'all' ? 'All' : type === 'in' ? 'Stock In' : type === 'out' ? 'Stock Out' : 'Adjustments'}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Product</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Type</th>
              <th className="text-right py-3 px-4 font-semibold text-foreground">Quantity</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Reason</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Reference</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Created By</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(log => (
              <tr key={log.id} className="border-b border-border hover:bg-muted">
                <td className="py-3 px-4 text-foreground">{log.productName}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                      log.type === 'in'
                        ? 'bg-green-100 text-green-700'
                        : log.type === 'out'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {log.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-semibold text-foreground">
                  {log.quantity}
                </td>
                <td className="py-3 px-4 text-muted-foreground">{log.reason}</td>
                <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                  {log.reference || '-'}
                </td>
                <td className="py-3 px-4 text-muted-foreground">{log.createdBy}</td>
                <td className="py-3 px-4 text-muted-foreground">
                  {new Date(log.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLogs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No inventory logs found</div>
      )}
    </div>
  );
}
