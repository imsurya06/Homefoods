import { fetchApi } from './apiClient';
import type { CartItem } from '../data/bestsellers';

export interface ValidationSummary {
  subtotal: number;
  gst: number;
  shippingCharge: number;
  discountAmount: number;
  grandTotal: number;
  appliedCoupon?: { code: string; discount: number } | null;
  couponError?: string | null;
  freeShippingThresholdMet: boolean;
}

export async function validateCart(
  items: CartItem[],
  pincode: string = '625001',
  couponCode?: string
): Promise<ValidationSummary> {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((sum, item) => sum + (item?.pricePerUnit || 0) * (item?.quantity || 1), 0);
  const gst = Math.round(subtotal - (subtotal / 1.05)); // Included GST
  const shippingCharge = (subtotal >= 499 || subtotal === 0) ? 0 : 40;

  // Instant 0ms response when no coupon validation is requested
  if (!couponCode || !couponCode.trim()) {
    return {
      subtotal,
      gst,
      shippingCharge,
      discountAmount: 0,
      grandTotal: subtotal + shippingCharge,
      appliedCoupon: null,
      freeShippingThresholdMet: shippingCharge === 0,
    };
  }

  try {
    const res = await fetchApi<{ success: boolean; summary: ValidationSummary }>('/cart/validate', {
      method: 'POST',
      body: JSON.stringify({ items, pincode, couponCode: couponCode.trim() }),
    });

    if (res && res.success && res.summary) {
      return res.summary;
    }
  } catch (error) {
    console.warn('Backend cart validation failed, computing client-side fallback:', error);
  }

  return {
    subtotal,
    gst,
    shippingCharge,
    discountAmount: 0,
    grandTotal: subtotal + shippingCharge,
    appliedCoupon: null,
    freeShippingThresholdMet: shippingCharge === 0,
  };
}

export async function syncCartRemote(
  items: CartItem[],
  revision: number,
  operationId: string
): Promise<{ success: boolean; revision: number; items: CartItem[] }> {
  return fetchApi<{ success: boolean; revision: number; items: CartItem[] }>('/sync/cart', {
    method: 'POST',
    body: JSON.stringify({ items, revision, operationId }),
  });
}
