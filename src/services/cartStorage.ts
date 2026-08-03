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

export function resetLocalRevision() {
  localRevision = 0;
  lastUserActionTime = 0;
}

export function isUserRecentlyActive(): boolean {
  return isSyncingCart || (Date.now() - lastUserActionTime < 30000);
}

export async function checkRemoteCartRevision(): Promise<{
  shouldUpdate: boolean;
  revision: number;
  lastDeviceId: string;
}> {
  try {
    const token = getSavedToken();
    if (!token) return { shouldUpdate: false, revision: localRevision, lastDeviceId: '' };

    const myDeviceId = getDeviceId();
    const res = await fetchApi<{ success: boolean; revision: number; lastDeviceId?: string }>('/cart/revision');

    console.log('[CartSync] checkRemoteCartRevision res:', res, 'localRevision:', localRevision, 'myDeviceId:', myDeviceId);

    if (res && res.success && typeof res.revision === 'number') {
      const serverRev = res.revision;
      const lastDev = res.lastDeviceId || '';

      // Cross-Device Sync Signal: Update ONLY if server has a newer revision AND action originated from ANOTHER device
      if (serverRev > localRevision && lastDev !== myDeviceId) {
        console.log('[CartSync] Triggering update! serverRev > localRevision && lastDev !== myDeviceId');
        return { shouldUpdate: true, revision: serverRev, lastDeviceId: lastDev };
      }
    }
  } catch (err) {
    console.warn('Check remote revision warning:', err);
  }
  return { shouldUpdate: false, revision: localRevision, lastDeviceId: '' };
}

let lastFetchRequestTime = 0;

export async function fetchRemoteCart(expectedRevision?: number): Promise<{ items: CartItem[]; cartCleared: boolean }> {
  try {
    const token = getSavedToken();
    if (!token) return { items: getStoredCart(false), cartCleared: false };

    const localItems = getStoredCart(true);

    // If local cart is currently sending POST sync, protect local state during write
    if (isSyncingCart) {
      console.log('[CartSync] fetchRemoteCart blocked by active sync');
      return { items: localItems, cartCleared: false };
    }

    const requestTime = Date.now();
    lastFetchRequestTime = requestTime;

    const deviceId = getDeviceId();
    let url = `/cart/get?deviceId=${deviceId}`;
    if (expectedRevision !== undefined) {
      url += `&revision=${expectedRevision}`;
    }

    const res = await fetchApi<{
      success: boolean;
      items: CartItem[];
      revision?: number;
      lastActiveDeviceId?: string;
      cartCleared?: boolean;
      isLagging?: boolean;
    }>(url);

    console.log('[CartSync] fetchRemoteCart API res:', res, 'localItems:', localItems);

    // Discard response if a newer fetch request was dispatched while this request was traveling over HTTP
    if (requestTime < lastFetchRequestTime) {
      console.log('[CartSync] fetchRemoteCart discarded stale HTTP response');
      return { items: localItems, cartCleared: false };
    }

    if (res && res.success && Array.isArray(res.items)) {
      if (res.isLagging) {
        console.log('[CartSync] fetchRemoteCart blocked: server database is lagging behind expected revision');
        return { items: localItems, cartCleared: false };
      }

      const serverRevision = res.revision || 0;
      const cartCleared = !!res.cartCleared && res.items.length === 0;

      // Monotonic Shield: If user is actively shopping/modifying, protect local state from older/same server states
      if (isUserRecentlyActive() && serverRevision <= localRevision) {
        console.log('[CartSync] fetchRemoteCart blocked by active user shield (monotonic check)');
        return { items: localItems, cartCleared: false };
      }

      // Database Vault Source of Truth: Always adopt server account cart if content differs or server revision is newer
      const isDifferent = JSON.stringify(localItems) !== JSON.stringify(res.items);

      if (isDifferent || serverRevision > localRevision || cartCleared) {
        console.log('[CartSync] Adopting server items:', res.items, 'serverRevision:', serverRevision);
        localRevision = Math.max(localRevision, serverRevision);
        localStorage.setItem('hf_user_cart', JSON.stringify(res.items));
        return { items: res.items, cartCleared };
      }

      // If content is identical, keep local items
      return { items: localItems, cartCleared: false };
    }
  } catch (err) {
    console.warn('Fetch remote cart warning:', err);
  }
  return { items: getStoredCart(true), cartCleared: false };
}

export function getIsSyncingCart(): boolean {
  return isSyncingCart;
}

let pendingSyncItems: CartItem[] | null = null;
let pendingIsLoggedIn = false;

function sendCartSync(cartItems: CartItem[], _isLoggedIn: boolean) {
  isSyncingCart = true;
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
        if (pendingSyncItems !== null) {
          const itemsToSync = pendingSyncItems;
          const loginState = pendingIsLoggedIn;
          pendingSyncItems = null;
          console.log('[CartSync] Processing queued cart sync items...');
          sendCartSync(itemsToSync, loginState);
        } else {
          isSyncingCart = false;
        }
      });
  } else {
    isSyncingCart = false;
  }
}

export function saveCartItems(cartItems: CartItem[], isLoggedIn: boolean) {
  recordUserCartAction();

  if (!isLoggedIn) {
    try {
      sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(cartItems));
    } catch (err) {
      console.error('Failed to save guest cart to sessionStorage:', err);
    }
    isSyncingCart = false;
    return;
  }

  try {
    localStorage.setItem('hf_user_cart', JSON.stringify(cartItems));
    
    if (isSyncingCart) {
      pendingSyncItems = cartItems;
      pendingIsLoggedIn = isLoggedIn;
      console.log('[CartSync] Active sync in progress. Queued latest cart items for next sync.');
      return;
    }

    sendCartSync(cartItems, isLoggedIn);
  } catch (err) {
    console.error('Failed to save user cart:', err);
    isSyncingCart = false;
  }
}

export function clearCartStorage(isLoggedIn: boolean) {
  lastUserActionTime = Date.now();
  localRevision++;
  try {
    sessionStorage.removeItem(GUEST_CART_KEY);
    localStorage.setItem('hf_user_cart', JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('hf_cart_cleared'));

    if (!isLoggedIn) {
      isSyncingCart = false;
      return;
    }

    if (isSyncingCart) {
      pendingSyncItems = [];
      pendingIsLoggedIn = isLoggedIn;
      console.log('[CartSync] Active sync in progress. Queued clear operation.');
      return;
    }

    sendCartSync([], isLoggedIn);
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
