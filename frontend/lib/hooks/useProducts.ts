'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  cost?: number;
  quantity: number;
  unit: string;
  image?: string;
  sku?: string;
  barcode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  code: string;
  category: string;
  price: number;
  cost?: number;
  quantity: number;
  unit: string;
  description?: string;
  sku?: string;
  barcode?: string;
}

interface PaginatedResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ count: 0, page: 1, pageSize: 20 });

  const fetchProducts = useCallback(async (page = 1, pageSize = 20, search = '') => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/v1/products/', {
        params: { page, page_size: pageSize, search },
      });
      const data = response.data as PaginatedResponse;
      setProducts(data.results);
      setPagination({
        count: data.count,
        page,
        pageSize,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, []);

  const createProduct = useCallback(async (data: CreateProductInput) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/api/v1/products/', data);
      setProducts(prev => [response.data, ...prev]);
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create product';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<CreateProductInput>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.patch(`/api/v1/products/${id}/`, data);
      setProducts(prev => prev.map(p => (p.id === id ? response.data : p)));
      return response.data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update product';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.delete(`/api/v1/products/${id}/`);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete product';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    pagination,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
