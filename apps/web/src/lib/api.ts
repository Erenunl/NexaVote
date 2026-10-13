const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');
export const apiUrl = API_URL;

type ApiError = { error?: { code?: string; message?: string; details?: string[] } };

export async function api<T>(path: string, options: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({})) as T & ApiError;
  if (!response.ok) throw new Error(payload.error?.message || `Request failed (${response.status})`);
  return payload;
}

export const juryToken = {
  get: () => sessionStorage.getItem('nexavision.juryToken'),
  set: (token: string) => sessionStorage.setItem('nexavision.juryToken', token),
  clear: () => sessionStorage.removeItem('nexavision.juryToken'),
};

export const adminToken = {
  get: () => sessionStorage.getItem('nexavision.adminToken'),
  set: (token: string) => sessionStorage.setItem('nexavision.adminToken', token),
  clear: () => sessionStorage.removeItem('nexavision.adminToken'),
};

