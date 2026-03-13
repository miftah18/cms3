'use client';

import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { useEffect } from 'react';

export function TopProducts() {
  const { stats, loading, error, fetchDashboardStats } = useAnalytics();

  useEffect(() => {
    fetchDashboardStats('30d');
  }, [fetchDashboardStats]);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!stats) return <div className="text-center py-8">No data</div>;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Top Products</h3>

      <div className="space-y-3">
        {stats.topProducts.map((product, index) => (
          <div key={product.id} className="flex items-center gap-4 pb-3 border-b border-border last:border-0 last:pb-0">
            <div className="text-lg font-bold text-muted-foreground w-6">{index + 1}</div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground">{product.quantity} units sold</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-foreground">${product.revenue.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
