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
    id: 'nannari-sherbet',
    name: 'Nannari Sherbet Concentrate',
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
 * Generates formatted WhatsApp Order URL for a product.
 * Number: +918608857705
 */
export function generateWhatsAppOrderUrl(
  productName: string,
  selectedWeight: string,
  basePrice: number,
  gstPercentage: number
): string {
  const { gstAmount, totalPrice } = calculatePriceDetails(basePrice, gstPercentage);

  const message = `Hello Homemade Foods! I would like to order:
Product: ${productName}
Variant: ${selectedWeight}
Base Price: ₹${basePrice}
GST (${gstPercentage}%): ₹${gstAmount}
Total Price: ₹${totalPrice}
Please confirm availability and share payment details. Thank you!`;

  return `https://wa.me/918608857705?text=${encodeURIComponent(message)}`;
}
