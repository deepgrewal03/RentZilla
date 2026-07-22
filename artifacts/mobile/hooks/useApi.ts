import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/constants/apiUrl";

const BASE_URL = API_BASE_URL;

function netErr(): Error {
  return new Error("Cannot reach server. Check your internet connection and try again.");
}

function serverErr(status: number, body: Record<string, any>): Error {
  const msg = body?.error || body?.message || `Server error (${status})`;
  return new Error(msg);
}

async function safeJson(res: Response): Promise<Record<string, any>> {
  try { return await res.json(); } catch { return {}; }
}

function logApiError(method: string, path: string, err: unknown) {
  console.warn(`[API] ${method} ${path} →`, err instanceof Error ? err.message : err);
}

export function useApi() {
  const { token } = useAuth();

  function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api${path}`, { headers: getHeaders() });
    } catch (err) {
      logApiError("GET", path, err);
      throw netErr();
    }
    if (!res.ok) {
      const body = await safeJson(res);
      const err = serverErr(res.status, body);
      logApiError("GET", path, `${res.status} ${JSON.stringify(body)}`);
      throw err;
    }
    return res.json();
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api${path}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      logApiError("POST", path, err);
      throw netErr();
    }
    if (!res.ok) {
      const b = await safeJson(res);
      const err = serverErr(res.status, b);
      logApiError("POST", path, `${res.status} ${JSON.stringify(b)}`);
      throw err;
    }
    return res.json();
  }

  async function put<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api${path}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      logApiError("PUT", path, err);
      throw netErr();
    }
    if (!res.ok) {
      const b = await safeJson(res);
      const err = serverErr(res.status, b);
      logApiError("PUT", path, `${res.status} ${JSON.stringify(b)}`);
      throw err;
    }
    return res.json();
  }

  async function patch<T>(path: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api${path}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      logApiError("PATCH", path, err);
      throw netErr();
    }
    if (!res.ok) {
      const b = await safeJson(res);
      const err = serverErr(res.status, b);
      logApiError("PATCH", path, `${res.status} ${JSON.stringify(b)}`);
      throw err;
    }
    return res.json();
  }

  async function del<T>(path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/api${path}`, {
        method: "DELETE",
        headers: getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      logApiError("DELETE", path, err);
      throw netErr();
    }
    if (!res.ok) {
      const b = await safeJson(res);
      const err = serverErr(res.status, b);
      logApiError("DELETE", path, `${res.status} ${JSON.stringify(b)}`);
      throw err;
    }
    return res.json();
  }

  return { get, post, put, patch, del };
}
