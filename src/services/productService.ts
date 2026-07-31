import { fetchApi } from './apiClient';
import { type Product } from '../data/products';

const DEFAULT_FALLBACK_PRODUCTS: Product[] = [
  {
    id: '35',
    name: 'Black Urad Dal Kali Mix (கருப்பு உளுந்து களி மாவு)',
    slug: 'black-urad-dal-kali-mix',
    categoryId: 'flour-premix-malt',
    categoryName: 'Flour/ Premix/ Malt',
    description: 'Traditional nutrient-dense Black Urad Dal porridge mix rich in natural protein, iron, and calcium. Prepared using authentic Tamil grandma recipes.',
    ingredients: 'Whole Black Urad Dal, Raw Rice, Fenugreek Seeds, Cardamom.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 70 },
      { weight: '500g', basePrice: 130 },
      { weight: '1kg', basePrice: 250 },
    ],
  },
  {
    id: '36',
    name: 'Vendaya Kali Mix (வெந்தயக் களி மாவு)',
    slug: 'vendaya-kali-mix',
    categoryId: 'flour-premix-malt',
    categoryName: 'Flour/ Premix/ Malt',
    description: 'Cooling, digestive Fenugreek porridge mix crafted with roasted whole fenugreek and red rice. Excellent for body cooling and stamina.',
    ingredients: 'Fenugreek Seeds, Red Rice, Palm Jaggery Blend, Dry Ginger.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 70 },
      { weight: '500g', basePrice: 130 },
    ],
  },
  {
    id: '37',
    name: 'Adai Mix (அடை மாவு)',
    slug: 'adai-mix',
    categoryId: 'flour-premix-malt',
    categoryName: 'Flour/ Premix/ Malt',
    description: 'Protein-packed multi-dal Adai mix prepared with roasted lentils and spices. Quick, healthy, and traditional breakfast dish.',
    ingredients: 'Toor Dal, Chana Dal, Urad Dal, Moong Dal, Raw Rice, Red Chillies, Asafoetida.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 70 },
      { weight: '500g', basePrice: 130 },
    ],
  },
];

let memoryCache: Product[] | null = null;

try {
  const saved = localStorage.getItem('hf_live_products_cache');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryCache = parsed;
    }
  }
} catch {}

export function getCachedProductsSync(): Product[] {
  return memoryCache && memoryCache.length > 0 ? memoryCache : DEFAULT_FALLBACK_PRODUCTS;
}

export async function getLiveProducts(category?: string, search?: string): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (search) params.append('search', search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi<{ success: boolean; data: Product[] }>(`/products${query}`);

    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      if (!category || category === 'all') {
        if (!search) {
          memoryCache = res.data;
          try {
            localStorage.setItem('hf_live_products_cache', JSON.stringify(res.data));
          } catch {}
        }
      }
      return res.data;
    }
  } catch (error) {
    console.error('Error fetching live products from WooCommerce backend:', error);
  }

  return memoryCache && memoryCache.length > 0 ? memoryCache : DEFAULT_FALLBACK_PRODUCTS;
}

export async function getLiveCategories(): Promise<{ id: string; label: string; count: number }[]> {
  try {
    const res = await fetchApi<{ success: boolean; data: { id: string; label: string; count: number }[] }>('/products/categories');
    if (res.success && res.data && res.data.length > 0) {
      return res.data;
    }
  } catch (error) {
    console.error('Error fetching live categories:', error);
  }

  return [
    { id: 'all', label: 'All Products', count: 3 },
    { id: 'flour-premix-malt', label: 'Flour/ Premix/ Malt', count: 3 },
  ];
}
