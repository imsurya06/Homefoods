import { fetchApi } from './apiClient';

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

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const token = getSavedToken();
  if (!token) return null;

  try {
    const res = await fetchApi<{ success: boolean; user: UserProfile; accountDeleted?: boolean }>('/auth/me');
    if (res && res.success && res.user) {
      localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
      return res.user;
    }
  } catch (err: any) {
    if (err && (err.accountDeleted || err.status === 401 || (err.message && err.message.toLowerCase().includes('deleted')))) {
      console.log('Account deleted from database. Wiping session...');
      logoutCustomer();
      alert('Your account has been deleted by admin. Please create a new account to continue.');
      window.location.href = '/';
      return null;
    }
  }
  return getSavedUserProfile();
}

export async function fetchCustomerOrders(): Promise<CustomerOrderHistoryItem[]> {
  const token = getSavedToken();
  if (!token) return [];

  try {
    const res = await fetchApi<{ success: boolean; data: CustomerOrderHistoryItem[] }>('/auth/my-orders');
    return res && res.success && Array.isArray(res.data) ? res.data : [];
  } catch (err: any) {
    console.warn('Fetch customer orders warning:', err);
    return [];
  }
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
