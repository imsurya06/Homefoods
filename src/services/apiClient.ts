import { useSyncStore } from '../store/useSyncStore';

// Centralized API Client for React Frontend with Automatic Cold-Start Retry Logic & JWT Refresh Interception
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retries = 2,
  delayMs = 1200
): Promise<T> {
  const getHeaders = (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const attemptRequest = async (token: string | null, _attemptNum: number): Promise<Response> => {
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: getHeaders(token),
    });
  };

  const startTime = performance.now();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let token = localStorage.getItem('hf_auth_token');
      let response = await attemptRequest(token, attempt);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const rawText = await response.text();
        console.warn(`Attempt ${attempt + 1}/${retries + 1}: Non-JSON response received for ${endpoint}.`, rawText);
        if (attempt < retries) {
          await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
          continue;
        }
        throw new Error(rawText && rawText.length < 150 ? rawText : 'Server temporary error. Please try again.');
      }

      const duration = Math.round(performance.now() - startTime);
      if (duration > 600) {
        console.warn(`[API Latency Warning] ${endpoint} took ${duration} ms`);
      }

      const data = await response.json();

      if (response.status === 401 && (data.code === 'ACCOUNT_DELETED' || data.code === 'USER_DELETED' || data.message?.includes('Customer account not found'))) {
        useSyncStore.getState().logout();
        window.dispatchEvent(new CustomEvent('hf_account_deleted'));
        const apiErr = new Error(data.message || 'Your session has ended. Please sign in to continue.') as any;
        apiErr.status = 401;
        apiErr.code = data.code || 'ACCOUNT_DELETED';
        apiErr.data = data;
        throw apiErr;
      }

      if (response.status === 401) {
        if (endpoint.includes('/auth/refresh') || endpoint.includes('/auth/login') || endpoint.includes('/auth/login-signup') || endpoint.includes('/auth/send-otp') || endpoint.includes('/auth/verify-otp')) {
          throw new Error(data.message || 'Authentication failed');
        }

        const storedRefreshToken = localStorage.getItem('hf_refresh_token');
        if (!storedRefreshToken) {
          localStorage.removeItem('hf_auth_token');
          localStorage.removeItem('hf_user_profile');
          const apiErr = new Error(data.message || 'Session expired') as any;
          apiErr.status = 401;
          throw apiErr;
        }

        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const devId = localStorage.getItem('hf_device_id') || '';
            const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                refreshToken: storedRefreshToken,
                deviceId: devId,
                deviceName: 'Web Browser'
              }),
            });

            if (!refreshRes.ok) {
              const refreshData = await refreshRes.json().catch(() => ({}));
              if (refreshRes.status === 401 && refreshData.code === 'ACCOUNT_DELETED') {
                const apiErr = new Error('Your account has been deleted by an administrator.') as any;
                apiErr.status = 401;
                apiErr.code = 'ACCOUNT_DELETED';
                throw apiErr;
              }
              if (refreshRes.status === 401) {
                localStorage.removeItem('hf_auth_token');
                localStorage.removeItem('hf_refresh_token');
                localStorage.removeItem('hf_user_profile');
                window.dispatchEvent(new CustomEvent('hf_auth_expired'));
                throw new Error('Your session has expired after 30 days. Please sign in again.');
              }
              throw new Error('Connecting to server... Please try again.');
            }

            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.accessToken) {
              localStorage.setItem('hf_auth_token', refreshData.accessToken);
              if (refreshData.refreshToken) {
                localStorage.setItem('hf_refresh_token', refreshData.refreshToken);
              }
              isRefreshing = false;
              onRefreshed(refreshData.accessToken);
            } else {
              throw new Error('Refresh failed');
            }
          } catch (refreshErr: any) {
            isRefreshing = false;
            if (refreshErr.code === 'ACCOUNT_DELETED') {
              localStorage.removeItem('hf_auth_token');
              localStorage.removeItem('hf_refresh_token');
              localStorage.removeItem('hf_user_profile');
              window.dispatchEvent(new CustomEvent('hf_account_deleted'));
              throw refreshErr;
            }
            if (refreshErr.message && refreshErr.message.includes('30 days')) {
              throw refreshErr;
            }
            throw new Error('Temporary connection issue while renewing session. Retrying...');
          }
        }

        const newAccessToken = await new Promise<string>((resolve, reject) => {
          subscribeTokenRefresh((newToken) => resolve(newToken));
          setTimeout(() => reject(new Error('Session refresh timed out')), 10000);
        });

        response = await attemptRequest(newAccessToken, attempt);
        const finalData = await response.json();
        if (!response.ok) {
          const apiErr = new Error(finalData.message || 'API request failed') as any;
          apiErr.status = response.status;
          apiErr.code = finalData.code;
          apiErr.data = finalData;
          throw apiErr;
        }
        return finalData;
      }

      if (!response.ok) {
        if (response.status === 401 && (data?.code === 'ACCOUNT_DELETED' || data?.code === 'ACCOUNT_NOT_FOUND')) {
          useSyncStore.getState().logout();
          window.dispatchEvent(new CustomEvent('hf_account_deleted'));
        }
        const apiErr = new Error(data.message || 'API request failed') as any;
        apiErr.status = response.status;
        apiErr.code = data.code;
        apiErr.data = data;
        throw apiErr;
      }

      return data;
    } catch (err: any) {
      if (attempt < retries && (err.message?.includes('Connecting to backend server') || err.message?.includes('Failed to fetch'))) {
        await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
        continue;
      }
      if (attempt === retries) {
        throw err;
      }
    }
  }

  throw new Error('Unable to reach server. Please check your network connection and try again.');
}
