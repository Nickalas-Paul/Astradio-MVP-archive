import { create } from 'zustand';
import { api, API_BASE, type ApiError } from '../lib/api';
import { formatApiError } from '../lib/format-api-error';
import { clearToken, getToken, setToken } from '../lib/token-storage';

export type AuthUser = {
  id: string;
  displayName: string;
  handle?: string;
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ error: null });
    try {
      const response = await fetch(`${API_BASE}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        token?: string;
        user?: AuthUser;
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        const err: ApiError = {
          status: response.status,
          error: data.error,
          message: data.message,
        };
        const message = formatApiError(err, 'Invalid email or password');
        set({ error: message });
        throw err;
      }
      if (!data.token || !data.user?.id) {
        const err: ApiError = { status: 502, error: 'invalid_login_response' };
        const message = formatApiError(err, 'Sign-in failed');
        set({ error: message });
        throw err;
      }
      await setToken(data.token);
      set({ user: data.user, error: null });
    } catch (err) {
      if (!(err && typeof err === 'object' && 'status' in err)) {
        const message = formatApiError(err, 'Could not connect. Check your network and try again.');
        set({ error: message });
      }
      throw err;
    }
  },

  logout: async () => {
    await clearToken();
    set({ user: null, error: null });
  },

  restore: async () => {
    set({ isLoading: true });
    try {
      const token = await getToken();
      if (!token) {
        set({ user: null, isLoading: false });
        return;
      }
      const data = await api<{ user?: AuthUser }>('/api/profile');
      if (data.user?.id) {
        set({
          user: {
            id: data.user.id,
            displayName: data.user.displayName,
            handle: data.user.handle,
          },
          isLoading: false,
        });
        return;
      }
      await clearToken();
      set({ user: null, isLoading: false });
    } catch {
      await clearToken();
      set({ user: null, isLoading: false });
    }
  },
}));
