import { useState, useEffect } from "react";
import { Product, Shift } from "../types";

export function useCart(shift: Shift) {
  const [cart, setCart] = useState<{ product: Product; quantity: number; notes?: string }[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState({ value: 0, type: "fixed" as "fixed" | "percent", reason: "" });

  // Clear cart if shift changes
  useEffect(() => {
    setCart([]);
    setAppliedDiscount({ value: 0, type: "fixed", reason: "" });
  }, [shift]);

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.product.id === product.id);
      if (index !== -1) {
        const newCart = [...prev];
        newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + 1 };
        return newCart;
      }
      return [...prev, { product, quantity: 1, notes: "" }];
    });
  };

  const handleUpdateQuantity = (index: number, change: number) => {
    setCart((prev) => {
      const newCart = [...prev];
      const newQty = newCart[index].quantity + change;
      if (newQty <= 0) {
        newCart.splice(index, 1);
      } else {
        newCart[index] = { ...newCart[index], quantity: newQty };
      }
      return newCart;
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveItemNotes = (index: number, notes: string) => {
    setCart((prev) => {
      const newCart = [...prev];
      if (newCart[index]) {
        newCart[index] = { ...newCart[index], notes };
      }
      return newCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    setAppliedDiscount({ value: 0, type: "fixed", reason: "" });
  };

  // Recalculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  
  let discountAmount = 0;
  if (appliedDiscount.value > 0) {
    if (appliedDiscount.type === "percent") {
      discountAmount = (subtotal * appliedDiscount.value) / 100;
    } else {
      discountAmount = appliedDiscount.value;
    }
  }
  discountAmount = Math.min(subtotal, discountAmount);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = 0;
  const grandTotal = taxableAmount;

  return {
    cart,
    setCart,
    appliedDiscount,
    setAppliedDiscount,
    addToCart: handleAddToCart,
    updateQuantity: handleUpdateQuantity,
    removeFromCart: handleRemoveFromCart,
    saveItemNotes: handleSaveItemNotes,
    clearCart,
    totals: {
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount,
      grandTotal,
    },
  };
}
