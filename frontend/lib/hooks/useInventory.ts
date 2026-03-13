'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  type: 'in' | 'out' | 'adjustment';
  reason: string;
  reference?: string;
  createdAt: string;
  createdBy: string;
}

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  currentQuantity: number;
  minimumQuantity: number;
  alertType: 'low-stock' | 'out-of-stock' | 'overstock';
}

export interface StockMovement {
  productId: string;
  quantity: number;
  type: 'in' | 'out';
  reason: string;
  reference?: string;
}

export function useInventory() {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventoryLogs = useCallback(async (productId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/inventory/logs/', {
        params: productId ? { product: productId } : {},
      });
      setLogs(response.data.results || response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/inventory/alerts/');
      setAlerts(response.data.results || response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const adjustStock = useCallback(async (movement: StockMovement) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/api/v1/inventory/adjust/', movement);
      await fetchInventoryLogs();
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to adjust stock';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchInventoryLogs]);

  const setMinimumQuantity = useCallback(async (productId: string, minimumQuantity: number) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.patch(`/api/v1/products/${productId}/`, { minimumQuantity });
      await fetchAlerts();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to set minimum quantity';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchAlerts]);

  return {
    logs,
    alerts,
    loading,
    error,
    fetchInventoryLogs,
    fetchAlerts,
    adjustStock,
    setMinimumQuantity,
  };
}
