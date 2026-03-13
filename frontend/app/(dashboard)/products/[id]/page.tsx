'use client';

import { ProductForm } from '@/components/products/ProductForm';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await apiClient.get(`/api/v1/products/${productId}/`);
        setProduct(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch product');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  if (loading) return <div className="text-center py-8">Loading product...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Edit Product</h1>
      <ProductForm productId={productId} initialData={product} />
    </div>
  );
}
