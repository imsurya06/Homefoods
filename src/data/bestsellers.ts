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

export const BESTSELLERS: BestsellerProduct[] = [
  {
    id: 'garlic-thokku',
    name: 'Garlic Thokku (Poondu Thokku)',
    category: 'Thokku Varieties',
    description: 'Traditional slow-cooked garlic relish infused with hand-ground spices, sesame oil, and tamarind. Perfectly pairs with hot rice, idli, or dosa.',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '100gms', basePrice: 120 },
      { weight: '250gms', basePrice: 280 },
      { weight: '500gms', basePrice: 520 },
    ],
  },
  {
    id: 'karuppu-kavuni-kanji',
    name: 'Karuppu Kavuni Kanji Mix',
    category: 'Flour / Premix / Rice Mix',
    description: 'Nutrient-rich Black Rice porridge mix sourced from traditional organic heritage grains. Naturally high in antioxidants, fiber, and iron.',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250gms', basePrice: 90 },
      { weight: '500gms', basePrice: 170 },
      { weight: '1kg', basePrice: 320 },
    ],
  },
  {
    id: 'nannari-sharbath',
    name: 'Nannari Sharbath Concentrate',
    category: 'Beverage & Sweeteners',
    description: 'Refreshing traditional Indian Sarsaparilla root extract brewed with natural palm sugar. Known for its soothing, cooling digestive properties.',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 12,
    isAvailable: true,
    variants: [
      { weight: '250ml', basePrice: 150 },
      { weight: '500ml', basePrice: 280 },
    ],
  },
];

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

export const WHATSAPP_PHONE_NUMBER = '918667726345';

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

/**
 * Logic A - "Buy Now" (Single Item Immediate Checkout)
 * Format:
 * Hello Homemade Foods! 🌿
 * I would like to place a quick order:
 * 
 * *Product:* [Product Name]
 * *Weight:* [Selected Variant]
 * *Total Price:* ₹[Final Price] (Includes GST)
 * 
 * Please confirm availability. Thank you!
 */
export function generateBuyNowWhatsAppUrl(
  productName: string,
  selectedWeight: string,
  finalPrice: number
): string {
  const message = `Hello Homemade Foods! 🌿\nI would like to place a quick order:\n\n*Product:* ${productName}\n*Weight:* ${selectedWeight}\n*Total Price:* ₹${finalPrice} (Includes GST)\n\nPlease confirm availability. Thank you!`;

  return `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Legacy compatibility wrapper for single item WhatsApp order
 */
export function generateWhatsAppOrderUrl(
  productName: string,
  selectedWeight: string,
  basePrice: number,
  gstPercentage: number
): string {
  const { totalPrice } = calculatePriceDetails(basePrice, gstPercentage);
  return generateBuyNowWhatsAppUrl(productName, selectedWeight, totalPrice);
}

/**
 * Logic B - "Cart Checkout" (Multiple Items Checkout)
 * Loops through items with generous line breaks and dashed dividers (---).
 * Appends total items count and grand total.
 */
export function generateCartCheckoutWhatsAppUrl(cartItems: CartItem[]): string {
  if (!cartItems || cartItems.length === 0) {
    return `https://wa.me/${WHATSAPP_PHONE_NUMBER}`;
  }

  let itemsBody = '';
  let grandTotal = 0;

  cartItems.forEach((item, index) => {
    const itemTotal = item.pricePerUnit * item.quantity;
    grandTotal += itemTotal;
    const itemNum = index + 1;
    const qtyText = item.quantity > 1 ? ` (Qty: ${item.quantity})` : '';

    itemsBody += `${itemNum}. *Product:* ${item.name}\n*Weight:* ${item.weight}${qtyText}\n*Price:* ₹${itemTotal}\n-----------------------------------\n\n`;
  });

  const totalItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const message = `Hello Homemade Foods! 🌿\nI would like to place an order:\n\n${itemsBody}*Total Items:* ${totalItemsCount}\n*Grand Total:* ₹${grandTotal} (Includes GST)\n\nPlease confirm availability and share payment details. Thank you!`;

  return `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent(message)}`;
}

