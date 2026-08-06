export interface ProductVariant {
  weight: string;
  basePrice: number;
}

export interface BestsellerProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  gstPercentage: number;
  isAvailable: boolean;
  variants: ProductVariant[];
}

export const BESTSELLERS: BestsellerProduct[] = [];

export interface CartItem {
  id: string; // Composite ID: `${productId}-${weight}`
  productId: string;
  name: string;
  weight: string;
  pricePerUnit: number; // Final price including GST per single unit
  quantity: number;
  imageUrl: string;
  gstPercentage: number;
}

export const WHATSAPP_PHONE_NUMBER = '918608857705';

/**
 * Calculates final price including GST.
 * Formula: Final Price = basePrice + (basePrice * gstPercentage / 100)
 */
export function calculatePriceDetails(basePrice: number, gstPercentage: number) {
  const gstAmount = (basePrice * gstPercentage) / 100;
  const totalPrice = Math.round(basePrice + gstAmount);
  return {
    basePrice,
    gstPercentage,
    gstAmount: Math.round(gstAmount),
    totalPrice,
  };
}
