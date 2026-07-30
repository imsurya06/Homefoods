import { fetchApi } from './apiClient';

export interface CustomerUser {
  id: number;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  billing?: Record<string, any>;
  shipping?: Record<string, any>;
}

export async function registerCustomer(payload: {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<{ token: string; customer: CustomerUser }> {
  const res = await fetchApi<{ success: boolean; token: string; customer: CustomerUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (res.success && res.token) {
    localStorage.setItem('hf_auth_token', res.token);
    return { token: res.token, customer: res.customer };
  }

  throw new Error('Registration failed');
}

export async function loginCustomer(identifier: string, password: string): Promise<{ token: string; customer: CustomerUser }> {
  const res = await fetchApi<{ success: boolean; token: string; customer: CustomerUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });

  if (res.success && res.token) {
    localStorage.setItem('hf_auth_token', res.token);
    return { token: res.token, customer: res.customer };
  }

  throw new Error('Login failed');
}

export function logoutCustomer() {
  localStorage.removeItem('hf_auth_token');
}

export async function getCustomerProfile(): Promise<CustomerUser | null> {
  try {
    const res = await fetchApi<{ success: boolean; customer: CustomerUser }>('/auth/profile');
    if (res.success && res.customer) {
      return res.customer;
    }
  } catch {
    // Token expired or invalid
  }
  return null;
}

export async function getCustomerOrders(): Promise<any[]> {
  try {
    const res = await fetchApi<{ success: boolean; orders: any[] }>('/auth/orders');
    if (res.success && res.orders) {
      return res.orders;
    }
  } catch {
    // Auth error
  }
  return [];
}
