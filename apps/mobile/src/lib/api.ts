import { getToken } from './token-storage';

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || 'https://your-render-url.onrender.com').replace(/\/+$/, '');

export type ApiError = {
  status: number;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    cache: 'no-store',
    ...options,
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    const err: ApiError = {
      ...(typeof data === 'object' && data !== null ? data : {}),
      status: response.status,
    };
    throw err;
  }

  return data;
}
