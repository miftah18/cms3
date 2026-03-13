'use client';

import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { useEffect } from 'react';

export function SalesChart() {
  const { salesChart, loading, error, fetchSalesChart } = useAnalytics();

  useEffect(() => {
    fetchSalesChart('30d');
  }, [fetchSalesChart]);

  if (loading) return <div className="text-center py-8">Loading chart...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!salesChart) return <div className="text-center py-8">No data available</div>;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6">Sales Trend (Last 30 Days)</h3>
      
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-4">
            {salesChart.labels.map((label, index) => (
              <div key={label} className="flex flex-col items-center">
                <div
                  className="bg-primary rounded-t w-12 mb-2"
                  style={{
                    height: `${(salesChart.datasets[0].data[index] / 1000) * 200}px`,
                  }}
                  title={`${salesChart.datasets[0].data[index]}`}
                />
                <span className="text-xs text-muted-foreground text-center w-12 truncate">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Max</p>
            <p className="text-lg font-semibold text-foreground">
              ${Math.max(...salesChart.datasets[0].data).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-lg font-semibold text-foreground">
              ${(salesChart.datasets[0].data.reduce((a, b) => a + b, 0) / salesChart.datasets[0].data.length).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold text-foreground">
              ${salesChart.datasets[0].data.reduce((a, b) => a + b, 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
