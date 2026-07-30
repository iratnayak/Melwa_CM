const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export { API_BASE };

async function refreshTokens(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  return true;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { _retried?: boolean },
): Promise<T> {
  const { _retried, ...rest } = init ?? {};
  const accessToken =
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const headers = new Headers(rest.headers ?? undefined);
  if (
    rest.body &&
    typeof rest.body === "string" &&
    !headers.has("Content-Type") &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });

  if (res.status === 401 && !_retried && path !== "/auth/refresh") {
    const ok = await refreshTokens();
    if (ok) return apiFetch<T>(path, { ...rest, _retried: true });
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "/";
    }
    throw new ApiError("Session expired", 401);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
    const msg = body?.message;
    const message = Array.isArray(msg)
      ? msg.join(", ")
      : String(msg ?? `Request failed (${res.status})`);
    throw new ApiError(message, res.status);
  }

  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}
