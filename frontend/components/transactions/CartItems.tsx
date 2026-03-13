'use client';

import { useCart } from '@/lib/hooks/useCart';

export function CartItems() {
  const { items, removeItem, updateQuantity, updateDiscount, subtotal, tax, discount, total } = useCart();

  if (items.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No items in cart</div>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Product</th>
              <th className="text-right py-3 px-4 font-semibold text-foreground">Unit Price</th>
              <th className="text-center py-3 px-4 font-semibold text-foreground">Quantity</th>
              <th className="text-right py-3 px-4 font-semibold text-foreground">Discount</th>
              <th className="text-right py-3 px-4 font-semibold text-foreground">Subtotal</th>
              <th className="text-center py-3 px-4 font-semibold text-foreground">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const itemTotal = item.quantity * item.unitPrice - (item.discount || 0);
              return (
                <tr key={item.productId} className="border-b border-border hover:bg-muted">
                  <td className="py-3 px-4 text-foreground">{item.productName}</td>
                  <td className="py-3 px-4 text-right text-foreground">
                    ${item.unitPrice.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateQuantity(item.productId, parseInt(e.target.value))}
                      className="w-16 px-2 py-1 border border-border rounded text-center bg-background text-foreground"
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <input
                      type="number"
                      min="0"
                      value={item.discount || 0}
                      onChange={e => updateDiscount(item.productId, parseFloat(e.target.value))}
                      className="w-20 px-2 py-1 border border-border rounded text-right bg-background text-foreground"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-foreground">
                    ${itemTotal.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-foreground">Subtotal:</span>
          <span className="font-semibold text-foreground">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground">Tax:</span>
          <span className="font-semibold text-foreground">${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground">Discount:</span>
          <span className="font-semibold text-foreground">-${discount.toFixed(2)}</span>
        </div>
        <div className="border-t border-border pt-2 flex justify-between text-lg">
          <span className="font-bold text-foreground">Total:</span>
          <span className="font-bold text-primary">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
