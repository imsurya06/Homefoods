import type { CartItem } from '../data/bestsellers';
import { getSavedToken } from './authService';
import { fetchApi } from './apiClient';

const GUEST_CART_KEY = 'hf_guest_cart';

export function getStoredCart(isLoggedIn: boolean): CartItem[] {
  if (!isLoggedIn) {
    try {
      const saved = sessionStorage.getItem(GUEST_CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  try {
    const saved = localStorage.getItem('hf_user_cart');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export async function fetchRemoteCart(): Promise<CartItem[]> {
  try {
    const token = getSavedToken();
    if (!token) return [];
    const res = await fetchApi<{ success: boolean; items: CartItem[] }>('/cart/get');
    if (res.success && Array.isArray(res.items) && res.items.length > 0) {
      localStorage.setItem('hf_user_cart', JSON.stringify(res.items));
      return res.items;
    }
  } catch (err) {
    console.warn('Fetch remote cart warning:', err);
  }
  return getStoredCart(true);
}

export function saveCartItems(cartItems: CartItem[], isLoggedIn: boolean) {
  if (!isLoggedIn) {
    try {
      sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartItems));
    } catch (err) {
      console.error('Failed to save guest cart to sessionStorage:', err);
    }
    return;
  }

  try {
    localStorage.setItem('hf_user_cart', JSON.stringify(cartItems));
    const token = getSavedToken();
    if (token) {
      fetchApi('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: cartItems }),
      }).catch((err) => console.warn('Cart sync warning:', err));
    }
  } catch (err) {
    console.error('Failed to save user cart:', err);
  }
}

export function clearCartStorage(isLoggedIn: boolean) {
  if (!isLoggedIn) {
    try {
      sessionStorage.removeItem(GUEST_CART_KEY);
    } catch {}
  } else {
    try {
      localStorage.removeItem('hf_user_cart');
    } catch {}
  }
}
