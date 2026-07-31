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

let isSyncingCart = false;

export async function fetchRemoteCart(): Promise<CartItem[]> {
  try {
    const token = getSavedToken();
    if (!token) return getStoredCart(false);

    const localItems = getStoredCart(true);

    // If local cart is currently syncing to backend, protect local items from in-flight GET responses
    if (isSyncingCart && localItems.length > 0) {
      return localItems;
    }

    const res = await fetchApi<{ success: boolean; items: CartItem[] }>('/cart/get');
    if (res && res.success && Array.isArray(res.items)) {
      if (isSyncingCart && res.items.length === 0 && localItems.length > 0) {
        return localItems;
      }

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
      isSyncingCart = true;
      fetchApi<{ success: boolean }>('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: cartItems, action: cartItems.length === 0 ? 'clear' : 'sync' }),
      })
        .catch((err) => console.warn('Cart sync warning:', err))
        .finally(() => {
          setTimeout(() => {
            isSyncingCart = false;
          }, 1500);
        });
    }
  } catch (err) {
    console.error('Failed to save user cart:', err);
  }
}

export function clearCartStorage(isLoggedIn: boolean) {
  isSyncingCart = false;
  try {
    sessionStorage.removeItem(GUEST_CART_KEY);
    localStorage.setItem('hf_user_cart', JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('hf_cart_cleared'));
    const token = getSavedToken();
    if (isLoggedIn && token) {
      fetchApi('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: [], action: 'clear', isUserAction: true }),
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
