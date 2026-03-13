'use client';

import { CartItems } from '@/components/transactions/CartItems';
import { useCart } from '@/lib/hooks/useCart';
import { useProducts } from '@/lib/hooks/useProducts';
import { useTransactions } from '@/lib/hooks/useTransactions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTransactionPage() {
  const router = useRouter();
  const { products } = useProducts();
  const { addItem } = useCart();
  const { createTransaction, loading } = useTransactions();
  const [transactionType, setTransactionType] = useState<'sale' | 'purchase' | 'return'>('sale');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  const handleAddProduct = () => {
    if (!selectedProduct) return;
    const product = products.find(p => p.id === selectedProduct);
    if (product) {
      addItem({
        productId: product.id,
        productName: product.name,
        quantity: selectedQuantity,
        unitPrice: product.price,
      });
      setSelectedProduct('');
      setSelectedQuantity(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const item = selectedProduct ? products.find(p => p.id === selectedProduct) : null;
      if (item) {
        addItem({
          productId: item.id,
          productName: item.name,
          quantity: selectedQuantity,
          unitPrice: item.price,
        });
      }
      
      await createTransaction({
        type: transactionType,
        items: [
          {
            productId: selectedProduct,
            quantity: selectedQuantity,
            unitPrice: products.find(p => p.id === selectedProduct)?.price || 0,
          },
        ],
        paymentMethod,
        notes,
      });
      router.push('/transactions');
    } catch (err) {
      console.error('Failed to create transaction:', err);
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Create Transaction</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Add Products</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Transaction Type
                </label>
                <select
                  value={transactionType}
                  onChange={e => setTransactionType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="sale">Sale</option>
                  <option value="purchase">Purchase</option>
                  <option value="return">Return</option>
                </select>
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedProduct}
                  onChange={e => setSelectedProduct(e.target.value)}
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - ${p.price.toFixed(2)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={selectedQuantity}
                  onChange={e => setSelectedQuantity(parseInt(e.target.value))}
                  className="w-24 px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleAddProduct}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <CartItems />
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Payment Details</h2>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Method</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Add any notes about this transaction..."
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Transaction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
