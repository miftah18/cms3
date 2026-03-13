'use client';

import { useProducts } from '@/lib/hooks/useProducts';
import { useState } from 'react';
import Link from 'next/link';

export function ProductList() {
  const { products, loading, error, pagination, fetchProducts, deleteProduct } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchProducts(1, pagination.pageSize, value);
  };

  const handleDelete = async (productId: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setDeleting(productId);
      try {
        await deleteProduct(productId);
      } finally {
        setDeleting(null);
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchProducts(newPage, pagination.pageSize, searchTerm);
  };

  if (loading && products.length === 0)
    return <div className="text-center py-4">Loading products...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const totalPages = Math.ceil(pagination.count / pagination.pageSize);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={e => handleSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Link
          href="/products/new"
          className="ml-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          Add Product
        </Link>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Code</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Product</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Category</th>
              <th className="text-right py-3 px-4 font-semibold text-foreground">Price</th>
              <th className="text-right py-3 px-4 font-semibold text-foreground">Quantity</th>
              <th className="text-center py-3 px-4 font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id} className="border-b border-border hover:bg-muted">
                <td className="py-3 px-4 text-foreground font-mono text-xs">{product.code}</td>
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.description}</p>
                  </div>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{product.category}</td>
                <td className="py-3 px-4 text-right font-semibold text-foreground">
                  ${product.price.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={product.quantity < 10 ? 'text-red-500 font-semibold' : 'text-foreground'}>
                    {product.quantity} {product.unit}
                  </span>
                </td>
                <td className="py-3 px-4 text-center space-x-2">
                  <Link
                    href={`/products/${product.id}`}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(product.id)}
                    disabled={deleting === product.id}
                    className="text-red-500 hover:text-red-600 disabled:opacity-50"
                  >
                    {deleting === product.id ? 'Deleting...' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No products found</div>
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
