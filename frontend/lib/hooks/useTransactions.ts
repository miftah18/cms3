'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface TransactionItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discount?: number;
}

export interface Transaction {
  id: string;
  code: string;
  type: 'sale' | 'purchase' | 'return';
  status: 'draft' | 'completed' | 'cancelled';
  items: TransactionItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionInput {
  type: 'sale' | 'purchase' | 'return';
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
  }>;
  tax?: number;
  discount?: number;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Transaction[];
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ count: 0, page: 1, pageSize: 20 });

  const fetchTransactions = useCallback(async (page = 1, pageSize = 20, type?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/transactions/', {
        params: { page, page_size: pageSize, type },
      });
      const data = response.data as PaginatedResponse;
      setTransactions(data.results);
      setPagination({
        count: data.count,
        page,
        pageSize,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTransaction = useCallback(async (data: CreateTransactionInput) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/api/v1/transactions/', data);
      setTransactions(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create transaction';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTransaction = useCallback(async (id: string, data: Partial<CreateTransactionInput>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.patch(`/api/v1/transactions/${id}/`, data);
      setTransactions(prev => prev.map(t => (t.id === id ? response.data : t)));
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update transaction';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const completeTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post(`/api/v1/transactions/${id}/complete/`, {});
      setTransactions(prev => prev.map(t => (t.id === id ? response.data : t)));
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to complete transaction';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelTransaction = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post(`/api/v1/transactions/${id}/cancel/`, {});
      setTransactions(prev => prev.map(t => (t.id === id ? response.data : t)));
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to cancel transaction';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    pagination,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    completeTransaction,
    cancelTransaction,
  };
}
