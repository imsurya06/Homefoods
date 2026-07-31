import type { CartItem } from '../data/bestsellers';
import { getSavedToken } from './authService';
import { fetchApi } from './apiClient';

const GUEST_CART_KEY = 'hf_guest_cart';

let lastLocalCartUpdate = 0;

export function recordLocalCartUpdate() {
  lastLocalCartUpdate = Date.now();
}

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
    if (!token) return getStoredCart(true);

    const localItems = getStoredCart(true);
    const isRecentLocalAction = Date.now() - lastLocalCartUpdate < 5000;

    const res = await fetchApi<{ success: boolean; items: CartItem[]; cartCleared?: boolean }>('/cart/get');
    if (res && res.success && Array.isArray(res.items)) {
      if (isRecentLocalAction && localItems.length > 0 && res.items.length === 0 && !res.cartCleared) {
        return localItems;
      }

      localStorage.setItem('hf_user_cart', JSON.stringify(res.items));
      if (res.cartCleared) {
        window.dispatchEvent(new CustomEvent('hf_cart_cleared'));
      }
      return res.items;
    }
  } catch (err) {
    console.warn('Fetch remote cart warning:', err);
  }
  return getStoredCart(true);
}

export function saveCartItems(cartItems: CartItem[], isLoggedIn: boolean) {
  if (Array.isArray(cartItems) && cartItems.length > 0) {
    lastLocalCartUpdate = Date.now();
  }

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
      fetchApi<{ success: boolean; cartCleared?: boolean; items?: CartItem[] }>('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: cartItems, isUserAction: true }),
      }).then((res) => {
        if (res && res.cartCleared) {
          localStorage.setItem('hf_user_cart', JSON.stringify([]));
          window.dispatchEvent(new CustomEvent('hf_cart_cleared'));
        }
      }).catch((err) => console.warn('Cart sync warning:', err));
    }
  } catch (err) {
    console.error('Failed to save user cart:', err);
  }
}

export function clearCartStorage(isLoggedIn: boolean) {
  try {
    sessionStorage.removeItem(GUEST_CART_KEY);
    localStorage.setItem('hf_user_cart', JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('hf_cart_cleared'));
    const token = getSavedToken();
    if (isLoggedIn && token) {
      fetchApi('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: [] }),
      }).catch((err) => console.warn('Cart clear sync warning:', err));
    }
  } catch (err) {
    console.error('Failed to clear cart storage:', err);
  }
}

export function mergeCartItems(accountItems: CartItem[], guestItems: CartItem[]): CartItem[] {
  const safeAccount = Array.isArray(accountItems) ? accountItems : [];
  const safeGuest = Array.isArray(guestItems) ? guestItems : [];

  if (safeGuest.length === 0) return safeAccount;
  if (safeAccount.length === 0) return safeGuest;

  const mergedMap = new Map<string, CartItem>();

  for (const item of safeAccount) {
    if (item && item.id) {
      mergedMap.set(item.id, { ...item });
    }
  }

  for (const guestItem of safeGuest) {
    if (!guestItem || !guestItem.id) continue;
    if (mergedMap.has(guestItem.id)) {
      const existing = mergedMap.get(guestItem.id)!;
      mergedMap.set(guestItem.id, {
        ...existing,
        quantity: existing.quantity + (guestItem.quantity || 1),
      });
    } else {
      mergedMap.set(guestItem.id, { ...guestItem });
    }
  }

  return Array.from(mergedMap.values());
}
