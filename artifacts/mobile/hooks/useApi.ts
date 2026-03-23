import { useAuth } from "@/context/AuthContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function useApi() {
  const { token } = useAuth();

  function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}/api${path}`, { headers: getHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function del<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}/api${path}`, {
      method: "DELETE",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  return { get, post, put, patch, del };
}
