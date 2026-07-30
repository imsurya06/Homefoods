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
  id: number;
  status: string;
  statusLabel: string;
  stage: number;
  total: string;
  currency: string;
  dateCreated: string;
  items: { name: string; quantity: number; total?: string }[];
  shippingAddress: string;
}

export function getSavedToken(): string | null {
  try {
    return localStorage.getItem('hf_auth_token');
  } catch {
    return null;
  }
}

export async function loginOrSignupCustomer(email: string, password: string): Promise<{ success: boolean; token: string; user: UserProfile }> {
  const res = await fetchApi<{ success: boolean; token: string; user: UserProfile }>('/auth/login-signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.success && res.token) {
    localStorage.setItem('hf_auth_token', res.token);
    localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
  }
  return res;
}

export async function loginCustomer(email: string, password: string): Promise<{ success: boolean; token: string; user: UserProfile }> {
  const res = await fetchApi<{ success: boolean; token: string; user: UserProfile }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (res.success && res.token) {
    localStorage.setItem('hf_auth_token', res.token);
    localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
  }
  return res;
}

export async function registerCustomer(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
  city?: string;
  pincode?: string;
}): Promise<{ success: boolean; token: string; user: UserProfile }> {
  const res = await fetchApi<{ success: boolean; token: string; user: UserProfile }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.success && res.token) {
    localStorage.setItem('hf_auth_token', res.token);
    localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
  }
  return res;
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const token = getSavedToken();
  if (!token) return null;
  try {
    const res = await fetchApi<{ success: boolean; user: UserProfile }>('/auth/me');
    if (res.success && res.user) {
      localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
      return res.user;
    }
    return null;
  } catch {
    logoutCustomer();
    return null;
  }
}

export async function fetchCustomerOrders(): Promise<CustomerOrderHistoryItem[]> {
  try {
    const res = await fetchApi<{ success: boolean; data: CustomerOrderHistoryItem[] }>('/auth/my-orders');
    return res.success && res.data ? res.data : [];
  } catch {
    return [];
  }
}

export function logoutCustomer() {
  try {
    localStorage.removeItem('hf_auth_token');
    localStorage.removeItem('hf_user_profile');
    sessionStorage.removeItem('hf_guest_cart');
  } catch (err) {
    console.error('Error logging out:', err);
  }
}
