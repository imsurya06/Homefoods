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

let cachedDeviceId = '';

export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let id = localStorage.getItem('hf_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('hf_device_id', id);
    }
    cachedDeviceId = id;
    return id;
  } catch {
    if (!cachedDeviceId) {
      cachedDeviceId = 'dev_' + Math.random().toString(36).substring(2, 9);
    }
    return cachedDeviceId;
  }
}

let isSyncingCart = false;
let localRevision = 0;
let lastUserActionTime = 0;

export function recordUserCartAction() {
  lastUserActionTime = Date.now();
  localRevision++;
}

export function isUserRecentlyActive(): boolean {
  return isSyncingCart || (Date.now() - lastUserActionTime < 4000);
}

export async function checkRemoteCartRevision(): Promise<{
  shouldUpdate: boolean;
  revision: number;
  lastDeviceId: string;
}> {
  try {
    const token = getSavedToken();
    if (!token || isSyncingCart) return { shouldUpdate: false, revision: localRevision, lastDeviceId: '' };

    const myDeviceId = getDeviceId();
    const res = await fetchApi<{ success: boolean; revision: number; lastDeviceId?: string }>('/cart/revision');

    if (res && res.success && typeof res.revision === 'number') {
      const serverRev = res.revision;
      const lastDev = res.lastDeviceId || '';

      // Signal Trigger: Update ONLY if server revision is newer AND action came from ANOTHER device
      if (serverRev > localRevision && lastDev && lastDev !== myDeviceId) {
        return { shouldUpdate: true, revision: serverRev, lastDeviceId: lastDev };
      }
    }
  } catch (err) {
    console.warn('Check remote revision warning:', err);
  }
  return { shouldUpdate: false, revision: localRevision, lastDeviceId: '' };
}

let lastFetchRequestTime = 0;

export async function fetchRemoteCart(): Promise<{ items: CartItem[]; cartCleared: boolean }> {
  try {
    const token = getSavedToken();
    if (!token) return { items: getStoredCart(false), cartCleared: false };

    const localItems = getStoredCart(true);

    // If local cart is currently sending POST sync, protect local state from GET polling
    if (isSyncingCart) {
      return { items: localItems, cartCleared: false };
    }

    const requestTime = Date.now();
    lastFetchRequestTime = requestTime;

    const res = await fetchApi<{
      success: boolean;
      items: CartItem[];
      revision?: number;
      lastActiveDeviceId?: string;
      cartCleared?: boolean;
    }>('/cart/get');

    // Discard response if a newer fetch request was dispatched while this request was traveling over HTTP
    if (requestTime < lastFetchRequestTime) {
      return { items: localItems, cartCleared: false };
    }

    if (res && res.success && Array.isArray(res.items)) {
      const serverRevision = res.revision || 0;
      const cartCleared = !!res.cartCleared && res.items.length === 0;

      // Golden Guard 1: Never overwrite a non-empty local cart with an empty remote cart unless cartCleared is explicitly true!
      if (res.items.length === 0 && !cartCleared && localItems.length > 0) {
        return { items: localItems, cartCleared: false };
      }

      // Golden Guard 2: Never allow a background poll to reduce local item count unless cartCleared is explicitly true!
      if (!cartCleared && localItems.length > 0 && res.items.length < localItems.length) {
        return { items: localItems, cartCleared: false };
      }

      const hasContentChanged = JSON.stringify(localItems) !== JSON.stringify(res.items);

      // Update local state IF server revision is newer, content has changed, or cart was cleared
      if (serverRevision > localRevision || hasContentChanged || cartCleared) {
        localRevision = Math.max(localRevision, serverRevision);
        localStorage.setItem('hf_user_cart', JSON.stringify(res.items));
        return { items: res.items, cartCleared };
      }

      // If server revision is same or older, keep local items
      return { items: localItems, cartCleared: false };
    }
  } catch (err) {
    console.warn('Fetch remote cart warning:', err);
  }
  return { items: getStoredCart(true), cartCleared: false };
}

export function saveCartItems(cartItems: CartItem[], isLoggedIn: boolean) {
  isSyncingCart = true;
  recordUserCartAction();

  if (!isLoggedIn) {
    try {
      sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartItems));
    } catch (err) {
      console.error('Failed to save guest cart to sessionStorage:', err);
    }
    setTimeout(() => {
      isSyncingCart = false;
    }, 1000);
    return;
  }

  try {
    localStorage.setItem('hf_user_cart', JSON.stringify(cartItems));
    const token = getSavedToken();
    if (token) {
      const deviceId = getDeviceId();
      fetchApi<{ success: boolean; revision?: number }>('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems,
          action: cartItems.length === 0 ? 'clear' : 'sync',
          revision: localRevision,
          deviceId,
        }),
      })
        .then((res) => {
          if (res && typeof res.revision === 'number') {
            localRevision = Math.max(localRevision, res.revision);
          }
        })
        .catch((err) => console.warn('Cart sync warning:', err))
        .finally(() => {
          setTimeout(() => {
            isSyncingCart = false;
          }, 2000);
        });
    } else {
      setTimeout(() => {
        isSyncingCart = false;
      }, 1000);
    }
  } catch (err) {
    console.error('Failed to save user cart:', err);
    isSyncingCart = false;
  }
}

export function clearCartStorage(isLoggedIn: boolean) {
  isSyncingCart = true;
  recordUserCartAction();
  try {
    sessionStorage.removeItem(GUEST_CART_KEY);
    localStorage.setItem('hf_user_cart', JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('hf_cart_cleared'));
    const token = getSavedToken();
    if (isLoggedIn && token) {
      const deviceId = getDeviceId();
      fetchApi<{ success: boolean; revision?: number }>('/cart/sync', {
        method: 'POST',
        body: JSON.stringify({ items: [], action: 'clear', isUserAction: true, revision: localRevision, deviceId }),
      })
        .then((res) => {
          if (res && typeof res.revision === 'number') {
            localRevision = Math.max(localRevision, res.revision);
          }
        })
        .catch((err) => console.warn('Cart clear sync warning:', err))
        .finally(() => {
          setTimeout(() => {
            isSyncingCart = false;
          }, 3000);
        });
    } else {
      setTimeout(() => {
        isSyncingCart = false;
      }, 1000);
    }
  } catch (err) {
    console.error('Failed to clear cart storage:', err);
    isSyncingCart = false;
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
