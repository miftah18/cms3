'use client';

import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { DashboardCard } from '@/components/analytics/DashboardCard';
import { SalesChart } from '@/components/analytics/SalesChart';
import { TopProducts } from '@/components/analytics/TopProducts';
import { useEffect } from 'react';

export default function AnalyticsPage() {
  const { stats, loading, error, fetchDashboardStats } = useAnalytics();

  useEffect(() => {
    fetchDashboardStats('30d');
  }, [fetchDashboardStats]);

  if (loading) return <div className="text-center py-8">Loading analytics...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics & Reports</h1>
        <p className="text-muted-foreground">Business insights and performance metrics</p>
      </div>

      {stats && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <DashboardCard
              title="Total Revenue"
              value={`$${stats.sales.totalRevenue.toFixed(2)}`}
              subtitle={`${stats.sales.periodLabel}`}
              variant="success"
            />
            <DashboardCard
              title="Total Sales"
              value={stats.sales.totalSales}
              subtitle={`${stats.sales.transactionCount} transactions`}
            />
            <DashboardCard
              title="Average Order Value"
              value={`$${stats.sales.averageOrderValue.toFixed(2)}`}
            />
            <DashboardCard
              title="Low Stock Items"
              value={stats.inventory.lowStockCount}
              variant={stats.inventory.lowStockCount > 0 ? 'warning' : 'default'}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <SalesChart />
            </div>
            <div>
              <TopProducts />
            </div>
          </div>

          {/* Inventory Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <DashboardCard
              title="Total Products"
              value={stats.inventory.totalProducts}
              subtitle="In catalog"
            />
            <DashboardCard
              title="Out of Stock"
              value={stats.inventory.outOfStockCount}
              variant={stats.inventory.outOfStockCount > 0 ? 'danger' : 'default'}
            />
            <DashboardCard
              title="Inventory Value"
              value={`$${stats.inventory.totalValue.toFixed(2)}`}
            />
          </div>

          {/* Recent Transactions */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recent Transactions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Code</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTransactions.map(transaction => (
                    <tr key={transaction.id} className="border-b border-border hover:bg-muted">
                      <td className="py-3 px-4 font-mono text-xs text-foreground">
                        {transaction.code}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-foreground">
                        ${transaction.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stats.recentTransactions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No recent transactions</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
