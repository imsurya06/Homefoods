import { create } from 'zustand';
import type { CartItem } from '../data/bestsellers';
import type { UserProfile } from '../services/authService';
import { syncBus } from '../services/eventBus';

export interface Address {
  id: string; // uuid
  label: string; // "Home", "Office"
  firstName: string;
  lastName?: string;
  address1: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  updatedAt: string; // ISO String
}

export interface OfflineOperation {
  operationId: string;
  type: 'ADD_CART' | 'REMOVE_CART' | 'CLEAR_CART' | 'UPDATE_CART' | 'SYNC_WISHLIST' | 'UPDATE_ADDRESS' | 'UPDATE_PROFILE';
  payload: any;
  createdAt: string;
  retryCount: number;
}

export interface ActiveCheckoutSession {
  wcOrderId: number;
  orderRefCode: string;
  status: 'pending_payment' | 'processing' | 'cancelled' | 'expired';
  reservationExpiresAt: number;
  razorpayOrderId: string;
  amountInPaise: number;
  keyId: string;
  cartSnapshot: CartItem[];
  customerEmail?: string;
  customerName?: string;
  phone?: string;
  shippingAddress?: string;
}

interface SyncState {
  // Auth state
  user: UserProfile | null;
  accessToken: string | null;
  isLoggedIn: boolean;

  // Business state
  cartItems: CartItem[];
  cartRevision: number;

  activeCheckoutSession: ActiveCheckoutSession | null;
  isCheckoutInProgress: boolean;
  lastCheckoutRevision: number | null;

  wishlistItems: number[];
  wishlistRevision: number;

  addresses: Address[];
  addressRevision: number;

  profileRevision: number;

  // Preferences
  preferences: Record<string, any>;

  // Offline operation queue
  offlineQueue: OfflineOperation[];

  // Network state
  isOnline: boolean;
  isSyncing: boolean;

  // Actions
  login: (user: UserProfile, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setCart: (items: CartItem[], revision?: number) => void;
  clearCart: (revision?: number) => void;
  setActiveCheckoutSession: (session: ActiveCheckoutSession | null) => void;
  setCheckoutInProgress: (inProgress: boolean) => void;
  setLastCheckoutRevision: (rev: number | null) => void;
  setWishlist: (items: number[], revision?: number) => void;
  setAddresses: (addresses: Address[], revision?: number) => void;
  updateProfile: (profile: Partial<UserProfile>, revision?: number) => void;
  setRevisions: (revisions: { cartRevision: number; wishlistRevision: number; profileRevision: number; addressRevision: number }) => void;
  setPreferences: (prefs: Record<string, any>) => void;
  addOfflineOperation: (op: Omit<OfflineOperation, 'operationId' | 'createdAt' | 'retryCount'>) => void;
  removeOfflineOperation: (opId: string) => void;
  incrementRetryCount: (opId: string) => void;
  setOnlineStatus: (status: boolean) => void;
  setSyncingStatus: (status: boolean) => void;
}

const getInitialAuth = () => {
  try {
    const token = localStorage.getItem('hf_auth_token');
    const profile = localStorage.getItem('hf_user_profile');
    if (token && profile) {
      return { user: JSON.parse(profile), accessToken: token, isLoggedIn: true };
    }
  } catch {}
  return { user: null, accessToken: null, isLoggedIn: false };
};

const getInitialActiveSession = (): ActiveCheckoutSession | null => {
  try {
    const saved = localStorage.getItem('hf_active_checkout_session');
    if (saved) {
      const session: ActiveCheckoutSession = JSON.parse(saved);
      if (session && session.reservationExpiresAt > Date.now()) {
        return session;
      } else {
        localStorage.removeItem('hf_active_checkout_session');
      }
    }
  } catch {}
  return null;
};

const getInitialCart = () => {
  try {
    const saved = localStorage.getItem('hf_user_cart') || sessionStorage.getItem('hf_guest_cart');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

const getInitialWishlist = () => {
  try {
    const saved = localStorage.getItem('hf_wishlist');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

const getInitialQueue = () => {
  try {
    const saved = localStorage.getItem('hf_offline_queue');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
};

export const useSyncStore = create<SyncState>((set) => ({
  ...getInitialAuth(),
  cartItems: getInitialCart(),
  cartRevision: 0,
  activeCheckoutSession: getInitialActiveSession(),
  isCheckoutInProgress: false,
  lastCheckoutRevision: null,
  wishlistItems: getInitialWishlist(),
  wishlistRevision: 0,
  addresses: [],
  addressRevision: 0,
  profileRevision: 0,
  preferences: {},
  offlineQueue: getInitialQueue(),
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('hf_auth_token', accessToken);
    localStorage.setItem('hf_refresh_token', refreshToken);
    localStorage.setItem('hf_user_profile', JSON.stringify(user));
    localStorage.removeItem('hf_active_checkout_session');
    localStorage.removeItem('hf_checkout_idempotency_key');
    localStorage.removeItem('hf_pending_order');
    localStorage.removeItem('hf_local_orders');
    localStorage.removeItem('hf_applied_coupon');
    localStorage.removeItem('hf_coupon_discount');
    sessionStorage.removeItem('hf_guest_orders');
    set({ user, accessToken, isLoggedIn: true, activeCheckoutSession: null, isCheckoutInProgress: false });
  },

  logout: () => {
    localStorage.removeItem('hf_auth_token');
    localStorage.removeItem('hf_refresh_token');
    localStorage.removeItem('hf_user_profile');
    localStorage.removeItem('hf_user_cart');
    localStorage.removeItem('hf_wishlist');
    localStorage.removeItem('hf_offline_queue');
    localStorage.removeItem('hf_active_checkout_session');
    localStorage.removeItem('hf_checkout_idempotency_key');
    localStorage.removeItem('hf_pending_order');
    localStorage.removeItem('hf_local_orders');
    localStorage.removeItem('hf_applied_coupon');
    localStorage.removeItem('hf_coupon_discount');
    sessionStorage.removeItem('hf_guest_cart');
    sessionStorage.removeItem('hf_guest_orders');
    set({
      user: null,
      accessToken: null,
      isLoggedIn: false,
      cartItems: [],
      cartRevision: 0,
      activeCheckoutSession: null,
      isCheckoutInProgress: false,
      lastCheckoutRevision: null,
      wishlistItems: [],
      wishlistRevision: 0,
      addresses: [],
      addressRevision: 0,
      profileRevision: 0,
      preferences: {},
      offlineQueue: [],
    });
  },

  setActiveCheckoutSession: (session) => {
    if (session) {
      localStorage.setItem('hf_active_checkout_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('hf_active_checkout_session');
    }
    set({ activeCheckoutSession: session });
  },

  setCheckoutInProgress: (isCheckoutInProgress) => set({ isCheckoutInProgress }),
  setLastCheckoutRevision: (lastCheckoutRevision) => set({ lastCheckoutRevision }),

  setCart: (items, revision) => {
    set((state) => {
      const safeItems = Array.isArray(items) ? items : [];
      if (revision !== undefined) {
        if (revision < state.cartRevision) {
          console.warn(`[Sync Store] Discarding stale server cart revision ${revision} (local: ${state.cartRevision})`);
          return {};
        }
        const hasPendingCartOps = state.offlineQueue.some(
          (op) => op.type === 'ADD_CART' || op.type === 'REMOVE_CART' || op.type === 'UPDATE_CART' || op.type === 'CLEAR_CART'
        );
        if (hasPendingCartOps) {
          console.log('[Sync Store] Postponing server cart hydration: local modifications are pending upload.');
          return {};
        }
      }

      const nextRev = revision !== undefined ? revision : state.cartRevision + 1;
      const key = state.isLoggedIn ? 'hf_user_cart' : 'hf_guest_cart';
      if (state.isLoggedIn) {
        localStorage.setItem(key, JSON.stringify(safeItems));
      } else {
        sessionStorage.setItem(key, JSON.stringify(safeItems));
      }
      if (revision === undefined && state.isLoggedIn) {
        syncBus.emit('cart.changed', safeItems);
      }
      return { cartItems: safeItems, cartRevision: nextRev };
    });
  },

  clearCart: (revision) => {
    set((state) => {
      const nextRev = revision !== undefined ? Math.max(revision, state.cartRevision + 1) : state.cartRevision + 1;
      try {
        localStorage.removeItem('hf_cart');
        localStorage.removeItem('hf_user_cart');
        sessionStorage.removeItem('hf_guest_cart');
        localStorage.removeItem('hf_checkout_session');
        localStorage.removeItem('hf_pending_order');
      } catch (e) {
        console.warn('Error clearing cart storage:', e);
      }
      return { cartItems: [], cartRevision: nextRev, offlineQueue: [] };
    });
  },

  setWishlist: (items, revision) => {
    set((state) => {
      const safeItems = Array.isArray(items) ? items : [];
      if (revision !== undefined) {
        if (revision < state.wishlistRevision) {
          console.warn(`[Sync Store] Discarding stale server wishlist revision ${revision} (local: ${state.wishlistRevision})`);
          return {};
        }
        const hasPendingWishlistOps = state.offlineQueue.some((op) => op.type === 'SYNC_WISHLIST');
        if (hasPendingWishlistOps) {
          console.log('[Sync Store] Postponing server wishlist hydration: local modifications are pending upload.');
          return {};
        }
      }

      const nextRev = revision !== undefined ? revision : state.wishlistRevision + 1;
      localStorage.setItem('hf_wishlist', JSON.stringify(safeItems));
      if (revision === undefined && state.isLoggedIn) {
        syncBus.emit('wishlist.changed', safeItems);
      }
      return { wishlistItems: safeItems, wishlistRevision: nextRev };
    });
  },

  setAddresses: (addresses, revision) => {
    set((state) => {
      const safeAddresses = Array.isArray(addresses) ? addresses : [];
      if (revision !== undefined) {
        if (revision < state.addressRevision) {
          console.warn(`[Sync Store] Discarding stale server address revision ${revision} (local: ${state.addressRevision})`);
          return {};
        }
        const hasPendingAddressOps = state.offlineQueue.some((op) => op.type === 'UPDATE_ADDRESS');
        if (hasPendingAddressOps) {
          console.log('[Sync Store] Postponing server addresses hydration: local modifications are pending upload.');
          return {};
        }
      }

      const nextRev = revision !== undefined ? revision : state.addressRevision + 1;
      if (revision === undefined && state.isLoggedIn) {
        syncBus.emit('address.changed', safeAddresses);
      }
      return { addresses: safeAddresses, addressRevision: nextRev };
    });
  },

  updateProfile: (profile, revision) => {
    set((state) => {
      if (!state.user) return {};
      if (revision !== undefined) {
        if (revision < state.profileRevision) {
          console.warn(`[Sync Store] Discarding stale server profile revision ${revision} (local: ${state.profileRevision})`);
          return {};
        }
        const hasPendingProfileOps = state.offlineQueue.some((op) => op.type === 'UPDATE_PROFILE');
        if (hasPendingProfileOps) {
          console.log('[Sync Store] Postponing server profile hydration: local modifications are pending upload.');
          return {};
        }
      }

      const nextUser = { ...state.user, ...profile };
      localStorage.setItem('hf_user_profile', JSON.stringify(nextUser));
      const nextRev = revision !== undefined ? revision : state.profileRevision + 1;
      if (revision === undefined && state.isLoggedIn) {
        syncBus.emit('profile.changed', nextUser);
      }
      return { user: nextUser, profileRevision: nextRev };
    });
  },

  setRevisions: (revisions) => {
    set((state) => ({
      cartRevision: Math.max(state.cartRevision, revisions.cartRevision),
      wishlistRevision: Math.max(state.wishlistRevision, revisions.wishlistRevision),
      profileRevision: Math.max(state.profileRevision, revisions.profileRevision),
      addressRevision: Math.max(state.addressRevision, revisions.addressRevision),
    }));
  },

  setPreferences: (preferences) => {
    set({ preferences });
  },

  addOfflineOperation: (op) => {
    set((state) => {
      const fullOp: OfflineOperation = {
        ...op,
        operationId: 'op_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36),
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };
      const nextQueue = [...state.offlineQueue, fullOp];
      localStorage.setItem('hf_offline_queue', JSON.stringify(nextQueue));
      return { offlineQueue: nextQueue };
    });
  },

  removeOfflineOperation: (opId) => {
    set((state) => {
      const nextQueue = state.offlineQueue.filter((o) => o.operationId !== opId);
      localStorage.setItem('hf_offline_queue', JSON.stringify(nextQueue));
      return { offlineQueue: nextQueue };
    });
  },

  incrementRetryCount: (opId) => {
    set((state) => {
      const nextQueue = state.offlineQueue.map((o) =>
        o.operationId === opId ? { ...o, retryCount: o.retryCount + 1 } : o
      );
      localStorage.setItem('hf_offline_queue', JSON.stringify(nextQueue));
      return { offlineQueue: nextQueue };
    });
  },

  setOnlineStatus: (isOnline) => set({ isOnline }),
  setSyncingStatus: (isSyncing) => set({ isSyncing }),
}));
