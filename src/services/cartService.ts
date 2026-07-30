import { fetchApi } from './apiClient';
import type { CartItem } from '../data/bestsellers';

export interface ValidationSummary {
  subtotal: number;
  gst: number;
  shippingCharge: number;
  discountAmount: number;
  grandTotal: number;
  appliedCoupon?: { code: string; discount: number } | null;
  freeShippingThresholdMet: boolean;
}

export async function validateCart(
  items: CartItem[],
  pincode: string = '625001',
  couponCode?: string
): Promise<ValidationSummary> {
  try {
    const res = await fetchApi<{ success: boolean; summary: ValidationSummary }>('/cart/validate', {
      method: 'POST',
      body: JSON.stringify({ items, pincode, couponCode }),
    });

    if (res.success && res.summary) {
      return res.summary;
    }
  } catch (error) {
    console.warn('Backend cart validation failed, computing client-side fallback:', error);
  }

  // Fallback local calculation
  const subtotal = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
  const gst = Math.round(subtotal * 0.05);
  const shippingCharge = subtotal >= 499 ? 0 : 40;
  const grandTotal = subtotal + gst + shippingCharge;

  return {
    subtotal,
    gst,
    shippingCharge,
    discountAmount: 0,
    grandTotal,
    appliedCoupon: null,
    freeShippingThresholdMet: shippingCharge === 0,
  };
}
