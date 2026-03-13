'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface SalesMetrics {
  totalSales: number;
  totalRevenue: number;
  averageOrderValue: number;
  transactionCount: number;
  periodLabel: string;
}

export interface InventoryMetrics {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

export interface DashboardStats {
  sales: SalesMetrics;
  inventory: InventoryMetrics;
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  recentTransactions: Array<{
    id: string;
    code: string;
    total: number;
    date: string;
  }>;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>;
}

export function useAnalytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesChart, setSalesChart] = useState<ChartData | null>(null);
  const [inventoryChart, setInventoryChart] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async (period = '30d') => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/analytics/dashboard/', {
        params: { period },
      });
      setStats(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSalesChart = useCallback(async (period = '30d') => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/analytics/sales-chart/', {
        params: { period },
      });
      setSalesChart(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales chart');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInventoryChart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/analytics/inventory-chart/');
      setInventoryChart(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory chart');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchSalesChart();
    fetchInventoryChart();
  }, [fetchDashboardStats, fetchSalesChart, fetchInventoryChart]);

  return {
    stats,
    salesChart,
    inventoryChart,
    loading,
    error,
    fetchDashboardStats,
    fetchSalesChart,
    fetchInventoryChart,
  };
}
