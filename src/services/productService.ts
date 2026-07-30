import { fetchApi } from './apiClient';
import { type Product } from '../data/products';

let memoryCache: Product[] | null = null;

// Initialize memory cache from localStorage if available
try {
  const saved = localStorage.getItem('hf_live_products_cache');
  if (saved) {
    memoryCache = JSON.parse(saved);
  }
} catch {
  // Ignore JSON parse errors
}

export function getCachedProductsSync(): Product[] {
  return memoryCache || [];
}

export async function getLiveProducts(category?: string, search?: string): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (search) params.append('search', search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetchApi<{ success: boolean; data: Product[] }>(`/products${query}`);

    if (res.success && res.data) {
      if (!category || category === 'all') {
        if (!search) {
          memoryCache = res.data;
          try {
            localStorage.setItem('hf_live_products_cache', JSON.stringify(res.data));
          } catch {
            // Ignore storage quota errors
          }
        }
      }
      return res.data;
    }
  } catch (error) {
    console.error('Error fetching live products from WooCommerce backend:', error);
  }

  return memoryCache || [];
}

export async function getLiveCategories(): Promise<{ id: string; label: string; count: number }[]> {
  try {
    const res = await fetchApi<{ success: boolean; data: { id: string; label: string; count: number }[] }>('/products/categories');
    if (res.success && res.data) {
      return res.data;
    }
  } catch (error) {
    console.error('Error fetching live categories:', error);
  }
  return [];
}
