import { fetchApi } from './apiClient';
import { PRODUCTS, type Product } from '../data/products';

let memoryCache: Product[] | null = null;

try {
  const saved = localStorage.getItem('hf_live_products_cache');
  const savedTime = localStorage.getItem('hf_live_products_cache_time');
  const isExpired = !savedTime || (Date.now() - parseInt(savedTime, 10) > 10 * 60 * 1000); // 10 mins cache
  if (saved && !isExpired) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryCache = parsed;
    }
  }
} catch {}

export function getCachedProductsSync(): Product[] {
  return memoryCache && memoryCache.length > 0 ? memoryCache : PRODUCTS;
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
    { id: 'all', label: 'All Products', count: PRODUCTS.length },
    { id: 'flour-premix-malt', label: 'Flours & Premixes', count: 4 },
    { id: 'thokku-varieties', label: 'Thokku Varieties', count: 2 },
  ];
}
