'use client';

import { useCallback, useState } from 'react';

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);

  const addItem = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
    } else {
      setItems(prev =>
        prev.map(i =>
          i.productId === productId ? { ...i, quantity } : i
        )
      );
    }
  }, [removeItem]);

  const updateDiscount = useCallback((productId: string, discount?: number) => {
    setItems(prev =>
      prev.map(i =>
        i.productId === productId ? { ...i, discount } : i
      )
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setTax(0);
    setDiscount(0);
  }, []);

  const subtotal = items.reduce((sum, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    const itemDiscount = item.discount || 0;
    return sum + itemTotal - itemDiscount;
  }, 0);

  const total = subtotal + tax - discount;

  return {
    items,
    subtotal,
    tax,
    setTax,
    discount,
    setDiscount,
    total,
    addItem,
    removeItem,
    updateQuantity,
    updateDiscount,
    clear,
    isEmpty: items.length === 0,
  };
}
