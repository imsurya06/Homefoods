import { fetchApi } from './apiClient';
import { useSyncStore } from '../store/useSyncStore';

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    state: string;
    postcode: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    city: string;
    state: string;
    postcode: string;
  };
}

export interface CustomerOrderHistoryItem {
  id: number | string;
  orderRefCode?: string;
  status: string;
  statusLabel: string;
  stage: number;
  total: string;
  currency: string;
  dateCreated: string;
  items: { name: string; quantity: number }[];
  shippingAddress: string;
}

export function getDeviceId(): string {
  let id = localStorage.getItem('hf_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem('hf_device_id', id);
  }
  return id;
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android Device';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'iOS Device';
  if (/Macintosh/i.test(ua)) return 'macOS Device';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Web Browser';
}

export function getSavedToken(): string | null {
  try {
    return localStorage.getItem('hf_auth_token');
  } catch {
    return null;
  }
}

export async function sendForgotPasswordOtp(email: string): Promise<{ success: boolean; message: string; testOtp?: string }> {
  return fetchApi<{ success: boolean; message: string; testOtp?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordWithOtp(email: string, otp: string, newPassword: string): Promise<{ success: boolean; accessToken: string; refreshToken: string; user: UserProfile }> {
  const res = await fetchApi<{ success: boolean; accessToken: string; refreshToken: string; user: UserProfile }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  });
  if (res.success && res.accessToken) {
    localStorage.setItem('hf_auth_token', res.accessToken);
    localStorage.setItem('hf_refresh_token', res.refreshToken);
    localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
  }
  return res;
}

export async function loginOrSignupCustomer(email: string, password: string): Promise<{ success: boolean; accessToken: string; refreshToken: string; user: UserProfile; isNewUser?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const res = await fetchApi<{ success: boolean; accessToken: string; refreshToken: string; user: UserProfile; isNewUser?: boolean }>('/auth/login-signup', {
    method: 'POST',
    body: JSON.stringify({
      email: cleanEmail,
      password,
      deviceId: getDeviceId(),
      deviceName: getDeviceName()
    }),
  });

  if (res.success && res.accessToken) {
    localStorage.setItem('hf_auth_token', res.accessToken);
    localStorage.setItem('hf_refresh_token', res.refreshToken);
    localStorage.setItem('hf_user_profile', JSON.stringify(res.user));

    if (res.isNewUser) {
      localStorage.removeItem('hf_local_orders');
    }
  }
  return res;
}

export async function loginCustomer(email: string, password: string): Promise<{ success: boolean; accessToken: string; refreshToken: string; user: UserProfile }> {
  const res = await fetchApi<{ success: boolean; accessToken: string; refreshToken: string; user: UserProfile }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      deviceId: getDeviceId(),
      deviceName: getDeviceName()
    }),
  });
  if (res.success && res.accessToken) {
    localStorage.setItem('hf_auth_token', res.accessToken);
    localStorage.setItem('hf_refresh_token', res.refreshToken);
    localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
  }
  return res;
}

export function getSavedUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem('hf_user_profile');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export async function validateSession(): Promise<{ valid: boolean; user: UserProfile | null }> {
  const token = getSavedToken();
  const refreshToken = localStorage.getItem('hf_refresh_token');

  if (!token && !refreshToken) {
    return { valid: false, user: null };
  }

  try {
    const res = await fetchApi<{ valid?: boolean; success: boolean; user: UserProfile }>('/auth/session');
    if (res && (res.valid || res.success) && res.user) {
      localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
      return { valid: true, user: res.user };
    }
  } catch (err: any) {
    if (err && (err.status === 401 || err.code === 'USER_DELETED' || err.code === 'ACCOUNT_DELETED' || err.accountDeleted)) {
      console.warn('[Session Validation] Customer deleted from WooCommerce database. Executing immediate hard logout.');
      logoutCustomer();
      useSyncStore.getState().logout();
      window.dispatchEvent(new CustomEvent('hf_account_deleted'));
      return { valid: false, user: null };
    }
  }

  return { valid: false, user: null };
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const sessionRes = await validateSession();
  return sessionRes.user;
}

export function getCachedCustomerOrders(): CustomerOrderHistoryItem[] {
  try {
    const saved = localStorage.getItem('hf_cached_customer_orders');
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

export async function fetchCustomerOrders(): Promise<CustomerOrderHistoryItem[]> {
  const token = getSavedToken();
  if (!token) return [];

  // Retrieve order IDs confirmed via payment in the active session
  let confirmedIds: string[] = [];
  try {
    confirmedIds = JSON.parse(sessionStorage.getItem('hf_confirmed_order_ids') || '[]');
  } catch {}

  const mapConfirmed = (orders: CustomerOrderHistoryItem[]) => {
    if (confirmedIds.length === 0 || !Array.isArray(orders)) return orders;
    return orders.map((ord) => {
      const isConfirmed = confirmedIds.some(
        (cid) => String(cid) === String(ord.id) || String(cid) === String((ord as any).wcOrderId)
      );
      if (isConfirmed) {
        return {
          ...ord,
          status: 'processing',
          paymentState: 'confirmed',
          statusText: 'Order Confirmed (Kitchen Processing)'
        };
      }
      return ord;
    });
  };

  try {
    const res = await fetchApi<{ success: boolean; data: CustomerOrderHistoryItem[] }>('/orders/me');
    if (res && res.success && Array.isArray(res.data)) {
      const sanitized = mapConfirmed(res.data);
      try {
        localStorage.setItem('hf_cached_customer_orders', JSON.stringify(sanitized));
      } catch {}
      return sanitized;
    }
  } catch (err: any) {
    console.warn('Fetch customer orders warning:', err);
  }
  return mapConfirmed(getCachedCustomerOrders());
}

export function logoutCustomer() {
  try {
    const refreshToken = localStorage.getItem('hf_refresh_token');
    if (refreshToken) {
      fetchApi('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      }).catch(() => {});
    }

    localStorage.removeItem('hf_auth_token');
    localStorage.removeItem('hf_refresh_token');
    localStorage.removeItem('hf_user_profile');
    localStorage.removeItem('hf_local_orders');
    sessionStorage.clear();
    window.dispatchEvent(new CustomEvent('hf_account_deleted'));
  } catch (err) {
    console.error('Error logging out:', err);
  }
}

export async function logoutAllDevices() {
  try {
    await fetchApi('/auth/logout-all', { method: 'POST' });
    localStorage.removeItem('hf_auth_token');
    localStorage.removeItem('hf_refresh_token');
    localStorage.removeItem('hf_user_profile');
    localStorage.removeItem('hf_local_orders');
    sessionStorage.clear();
    window.dispatchEvent(new CustomEvent('hf_account_deleted'));
  } catch (err) {
    console.error('Error logging out of all devices:', err);
  }
}

export async function sendEmailOtp(
  email: string,
  purpose: 'login' | 'checkout' | 'email_change'
): Promise<{ success: boolean; message: string; isExistingUser?: boolean; testOtp?: string }> {
  return fetchApi<{ success: boolean; message: string; isExistingUser?: boolean; testOtp?: string }>('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), purpose })
  });
}

export async function verifyEmailOtp(
  email: string,
  otp: string,
  purpose: 'login' | 'checkout' | 'email_change',
  name?: string,
  phone?: string
): Promise<{ success: boolean; message?: string; accessToken?: string; refreshToken?: string; user?: UserProfile; isNewUser?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const res = await fetchApi<{
    success: boolean;
    message?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: UserProfile;
    isNewUser?: boolean;
  }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({
      email: cleanEmail,
      otp: otp.trim(),
      purpose,
      name,
      phone,
      deviceId: getDeviceId(),
      deviceName: getDeviceName()
    })
  });

  if (res.success && res.accessToken && res.user) {
    localStorage.setItem('hf_auth_token', res.accessToken);
    localStorage.setItem('hf_refresh_token', res.refreshToken || '');
    localStorage.setItem('hf_user_profile', JSON.stringify(res.user));

    if (res.isNewUser) {
      localStorage.removeItem('hf_local_orders');
    }
  }

  return res;
}
