import { fetchApi } from './apiClient';
import { PRODUCTS, type Product } from '../data/products';

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
  return memoryCache && memoryCache.length > 0 ? memoryCache : [];
}

export async function getLiveProducts(category?: string, search?: string, forceRefresh?: boolean): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (search) params.append('search', search);
    if (forceRefresh) params.append('forceRefresh', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi<{ success: boolean; data: Product[] }>(`/products${query}`);

    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      if (!category || category === 'all') {
        if (!search) {
          memoryCache = res.data;
          try {
            localStorage.setItem('hf_live_products_cache', JSON.stringify(res.data));
            localStorage.setItem('hf_live_products_cache_time', Date.now().toString());
          } catch {}
        }
      }
      return res.data;
    }
  } catch (error) {
    console.error('Error fetching live products from WooCommerce backend:', error);
  }

  return memoryCache && memoryCache.length > 0 ? memoryCache : PRODUCTS;
}

export interface LiveCategoryItem {
  id: string;
  wcId?: number;
  name: string;
  title: string;
  label: string;
  slug: string;
  subtitle?: string;
  description?: string;
  count: number;
  imageUrl?: string;
}

let categoryMemoryCache: LiveCategoryItem[] | null = null;

try {
  const savedCats = localStorage.getItem('hf_live_categories_cache');
  if (savedCats) {
    const parsed = JSON.parse(savedCats);
    if (Array.isArray(parsed) && parsed.length > 0) {
      categoryMemoryCache = parsed;
    }
  }
} catch {}

export function getCachedCategoriesSync(): LiveCategoryItem[] {
  return categoryMemoryCache && categoryMemoryCache.length > 0 ? categoryMemoryCache : [];
}

export async function getLiveCategories(): Promise<LiveCategoryItem[]> {
  try {
    const res = await fetchApi<{ success: boolean; data: LiveCategoryItem[] }>('/products/categories');
    if (res.success && res.data && res.data.length > 0) {
      categoryMemoryCache = res.data;
      try {
        localStorage.setItem('hf_live_categories_cache', JSON.stringify(res.data));
      } catch {}
      return res.data;
    }
  } catch (error) {
    console.error('Error fetching live categories:', error);
  }

  return categoryMemoryCache && categoryMemoryCache.length > 0 ? categoryMemoryCache : [
    { id: 'beverage-sweeteners', name: 'Beverages & Sweeteners', title: 'Beverages & Sweeteners', label: 'Beverages & Sweeteners', slug: 'beverage-sweeteners', subtitle: 'Nannari Sharbath & Raw Forest Wild Honey', count: 7, imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80' },
    { id: 'cookies-brownies', name: 'Cookies & Brownies', title: 'Cookies & Brownies', label: 'Cookies & Brownies', slug: 'cookies-brownies', subtitle: 'Healthy Millet & Whole Wheat Bakes', count: 10, imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80' },
    { id: 'flour-premix-malt', name: 'Flours & Premixes', title: 'Flours & Premixes', label: 'Flours & Premixes', slug: 'flour-premix-malt', subtitle: 'Ragi, Rice & Healthy Grain Flours', count: 13, imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80' },
    { id: 'idly-podi-rice-mix-soup-mix', name: 'Idly Podi / Rice Mix / Soup Mix', title: 'Idly Podi & Rice Mixes', label: 'Idly Podi & Rice Mixes', slug: 'idly-podi-rice-mix-soup-mix', subtitle: 'Traditional Gunpowder & Soup Powders', count: 10, imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80' },
    { id: 'masala-varieties', name: 'Masala Varieties', title: 'Masala Varieties', label: 'Masala Varieties', slug: 'masala-varieties', subtitle: 'Hand-ground South Indian Spices', count: 5, imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80' },
    { id: 'non-veg-masalas', name: 'Non Veg Masalas', title: 'Non Veg Masalas', label: 'Non Veg Masalas', slug: 'non-veg-masalas', subtitle: 'Authentic Traditional Non-Veg Masala Blends', count: 6, imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80' },
    { id: 'thokku-varieties', name: 'Thokku Varieties', title: 'Thokku Varieties', label: 'Thokku Varieties', slug: 'thokku-varieties', subtitle: 'Garlic, Tomato & Mango Relishes', count: 8, imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80' }
  ];
}
