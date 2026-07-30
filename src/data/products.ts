export interface ProductVariant {
  weight: string;
  basePrice: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  description: string;
  ingredients: string;
  shelfLife: string;
  storageInstructions: string;
  imageUrl: string;
  gstPercentage: number;
  isAvailable: boolean;
  variants: ProductVariant[];
}

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Products', count: 0 },
];

export const PRODUCTS: Product[] = [];
