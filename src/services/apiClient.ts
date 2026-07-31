// Centralized API Client for React Frontend with Automatic Cold-Start Retry Logic
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
  retries = 2,
  delayMs = 1200
): Promise<T> {
  const token = localStorage.getItem('hf_auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const rawText = await response.text();
        console.warn(`Attempt ${attempt + 1}/${retries + 1}: Non-JSON response received from ${endpoint}. Waking up serverless backend...`, rawText);

        if (attempt < retries) {
          await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
          continue;
        }
        throw new Error('Connecting to backend server... Please try again in a moment.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (err: any) {
      if (attempt < retries && err.message?.includes('Connecting to backend server')) {
        await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
        continue;
      }
      if (attempt === retries) {
        throw err;
      }
    }
  }

  throw new Error('Connecting to backend server... Please try again in a moment.');
}
