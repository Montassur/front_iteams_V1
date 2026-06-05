import { loadSession } from '../utils/session';

const BASE = import.meta.env.VITE_API_URL as string;

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler;
}

function shouldAttachAuth(path: string) {
  if (path === '/auth/complete-company') return true;
  return !path.startsWith('/auth/');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const session = loadSession();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(session?.token && shouldAttachAuth(path) ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (res.status === 401 && shouldAttachAuth(path)) {
    if (onUnauthorized) onUnauthorized();
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null) as { message?: string; error?: string; detail?: string } | null;
    throw new Error(errorBody?.detail || errorBody?.message || errorBody?.error || `${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
