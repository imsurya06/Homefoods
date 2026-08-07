import { fetchApi } from './apiClient';
import { useSyncStore } from '../store/useSyncStore';
import { syncCartRemote } from './cartService';
import { syncWishlistRemote } from './wishlistService';
import { syncProfileRemote, syncAddressesRemote } from './profileService';
import { syncBus } from './eventBus';

let pollingTimer: any = null;
let currentEtag = '';
let isReplaying = false;

export async function bootstrapSync() {
  const state = useSyncStore.getState();
  if (!state.isLoggedIn) {
    console.log('[SyncManager] bootstrapSync skipped: User is not logged in.');
    return;
  }

  console.log('[SyncManager] Starting bootstrapSync...');
  try {
    state.setSyncingStatus(true);
    const data = await fetchApi('/sync/bootstrap');
    console.log('[SyncManager] bootstrapSync API Response:', data);
    if (data && data.success) {
      if (data.cart) {
        console.log('[SyncManager] Hydrating cart:', data.cart.items, 'Rev:', data.cart.revision);
        useSyncStore.getState().setCart(data.cart.items, data.cart.revision);
      }
      if (data.wishlist) {
        console.log('[SyncManager] Hydrating wishlist:', data.wishlist.items, 'Rev:', data.wishlist.revision);
        useSyncStore.getState().setWishlist(data.wishlist.items, data.wishlist.revision);
      }
      if (data.addresses) {
        console.log('[SyncManager] Hydrating addresses:', data.addresses);
        useSyncStore.getState().setAddresses(data.addresses, data.revisions.addressRevision);
      }
      if (data.customer) {
        console.log('[SyncManager] Hydrating profile:', data.customer);
        useSyncStore.getState().updateProfile(data.customer, data.revisions.profileRevision);
      }
      if (data.revisions) {
        console.log('[SyncManager] Setting revisions:', data.revisions);
        useSyncStore.getState().setRevisions(data.revisions);
      }
      if (data.preferences) {
        useSyncStore.getState().setPreferences(data.preferences);
      }
      console.log('[SyncManager] bootstrapSync completed successfully.');
    }
  } catch (err) {
    console.error('[SyncManager] Bootstrap sync failed:', err);
  } finally {
    state.setSyncingStatus(false);
  }
}

export async function checkRevisions() {
  const state = useSyncStore.getState();
  if (!state.isLoggedIn || !state.isOnline || state.isSyncing) return;

  console.log('[SyncManager] Checking revisions... Local:', {
    cart: state.cartRevision,
    wishlist: state.wishlistRevision,
    profile: state.profileRevision,
    address: state.addressRevision
  });

  try {
    const headers: Record<string, string> = {};
    if (currentEtag) {
      headers['If-None-Match'] = currentEtag;
    }

    const res = await fetchApi('/sync/revision', {
      headers
    });

    if (res === null || !res.success) {
      return;
    }

    if (res.success && res.revisions) {
      const localRevs = {
        cart: state.cartRevision,
        wishlist: state.wishlistRevision,
        profile: state.profileRevision,
        address: state.addressRevision
      };

      const serverRevs = res.revisions;

      // Suppress cart revision trigger if checkout is currently in progress or matches checkout revision transition
      const isCheckoutActive = state.isCheckoutInProgress || (state.lastCheckoutRevision !== null && serverRevs.cartRevision <= state.lastCheckoutRevision);
      if (isCheckoutActive && serverRevs.cartRevision > localRevs.cart) {
        useSyncStore.setState({ cartRevision: serverRevs.cartRevision });
      }

      const cartNeedsSync = !isCheckoutActive && serverRevs.cartRevision > localRevs.cart;

      if (
        cartNeedsSync ||
        serverRevs.wishlistRevision > localRevs.wishlist ||
        serverRevs.profileRevision > localRevs.profile ||
        serverRevs.addressRevision > localRevs.address
      ) {
        console.log('[SyncManager] Newer revisions detected on server. Bootstrapping...');
        await bootstrapSync();
      }
    }
  } catch (err: any) {
    console.warn('[SyncManager] Revision check warning:', err.message);
  }
}

export async function replayOfflineQueue() {
  const state = useSyncStore.getState();
  const queue = Array.isArray(state.offlineQueue) ? state.offlineQueue : [];
  if (!state.isOnline || isReplaying || queue.length === 0) return;

  isReplaying = true;
  state.setSyncingStatus(true);
  console.log(`[SyncManager] Replaying offline queue (${queue.length} operations)...`);

  const queueItems = [...queue];

  for (const op of queueItems) {
    let success = false;
    try {
      if (op.type === 'ADD_CART' || op.type === 'REMOVE_CART' || op.type === 'CLEAR_CART' || op.type === 'UPDATE_CART') {
        const res = await syncCartRemote(op.payload.items, state.cartRevision, op.operationId);
        if (res.success) {
          state.setCart(res.items, res.revision);
          success = true;
        }
      } else if (op.type === 'SYNC_WISHLIST') {
        const res = await syncWishlistRemote(op.payload.items, state.wishlistRevision, op.operationId);
        if (res.success) {
          state.setWishlist(res.items, res.revision);
          success = true;
        }
      } else if (op.type === 'UPDATE_PROFILE') {
        const res = await syncProfileRemote(
          op.payload.firstName,
          op.payload.lastName,
          op.payload.phone,
          state.profileRevision,
          op.operationId,
          op.createdAt
        );
        if (res.success) {
          state.updateProfile({ firstName: res.firstName, lastName: res.lastName, phone: res.phone }, res.revision);
          success = true;
        }
      } else if (op.type === 'UPDATE_ADDRESS') {
        const res = await syncAddressesRemote(op.payload.addresses, state.addressRevision, op.operationId);
        if (res.success) {
          state.setAddresses(res.addresses, res.revision);
          success = true;
        }
      }

      if (success) {
        state.removeOfflineOperation(op.operationId);
      } else {
        state.incrementRetryCount(op.operationId);
      }
    } catch (err: any) {
      console.error(`[SyncManager] Failed to replay operation ${op.operationId}:`, err.message);
      state.incrementRetryCount(op.operationId);
      if (!navigator.onLine) {
        state.setOnlineStatus(false);
        break;
      }
    }
  }

  isReplaying = false;
  state.setSyncingStatus(false);
}

let currentInterval = 30000;
let lastInteractionTime = Date.now();

export function updatePollingInterval(pageContext: 'checkout' | 'cart' | 'general') {
  if (pollingTimer) clearInterval(pollingTimer);

  if (pageContext === 'checkout') {
    currentInterval = 5000;
  } else if (pageContext === 'cart') {
    currentInterval = 15000;
  } else {
    currentInterval = 30000;
  }

  if (document.hidden) {
    currentInterval = 60000;
  }

  if (Date.now() - lastInteractionTime > 10 * 60 * 1000) {
    console.log('[SyncManager] Idle timeout (>10m). Stopping polling.');
    return;
  }

  pollingTimer = setInterval(async () => {
    await checkRevisions();
  }, currentInterval);
}

const debounceTimers: Record<string, any> = {};
function debounceSync(key: string, fn: () => void, delay = 1200) {
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(fn, delay);
}

export function initSyncManager() {
  if (typeof window === 'undefined') return;

  // Listen to store updates via event bus and queue debounced offline sync attempts
  syncBus.on('cart.changed', (items) => {
    debounceSync('cart', () => {
      console.log('[SyncManager] Event received: cart.changed. Queueing sync...');
      useSyncStore.getState().addOfflineOperation({
        type: 'UPDATE_CART',
        payload: { items }
      });
      replayOfflineQueue();
    }, 1500);
  });

  syncBus.on('wishlist.changed', (items) => {
    debounceSync('wishlist', () => {
      console.log('[SyncManager] Event received: wishlist.changed. Queueing sync...');
      useSyncStore.getState().addOfflineOperation({
        type: 'SYNC_WISHLIST',
        payload: { items }
      });
      replayOfflineQueue();
    }, 1500);
  });

  syncBus.on('profile.changed', (profile) => {
    debounceSync('profile', () => {
      console.log('[SyncManager] Event received: profile.changed. Queueing sync...');
      useSyncStore.getState().addOfflineOperation({
        type: 'UPDATE_PROFILE',
        payload: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone
        }
      });
      replayOfflineQueue();
    }, 2000);
  });

  syncBus.on('address.changed', (addresses) => {
    debounceSync('address', () => {
      console.log('[SyncManager] Event received: address.changed. Queueing sync...');
      useSyncStore.getState().addOfflineOperation({
        type: 'UPDATE_ADDRESS',
        payload: { addresses }
      });
      replayOfflineQueue();
    }, 2000);
  });

  window.addEventListener('online', () => {
    console.log('[SyncManager] Network connected. Syncing...');
    useSyncStore.getState().setOnlineStatus(true);
    replayOfflineQueue().then(() => bootstrapSync());
  });

  window.addEventListener('offline', () => {
    console.log('[SyncManager] Network disconnected.');
    useSyncStore.getState().setOnlineStatus(false);
  });

  const trackActivity = () => {
    lastInteractionTime = Date.now();
  };
  window.addEventListener('click', trackActivity);
  window.addEventListener('keypress', trackActivity);
  window.addEventListener('scroll', trackActivity);

  window.addEventListener('focus', () => {
    console.log('[SyncManager] Tab focused. Resuming polling and checking revisions...');
    lastInteractionTime = Date.now();
    updatePollingInterval('general');
    checkRevisions();
    replayOfflineQueue();
  });

  window.addEventListener('visibilitychange', () => {
    updatePollingInterval('general');
  });

  updatePollingInterval('general');
  if (navigator.onLine) {
    replayOfflineQueue().then(() => bootstrapSync());
  }

  window.addEventListener('hf_auth_expired', () => {
    alert('Your session has expired. Please log in again.');
    window.location.reload();
  });
}
