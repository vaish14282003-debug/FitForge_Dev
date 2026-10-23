export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

// Single-flight: many requests can 401 at once when the access token expires,
// but the refresh token is single-use, so only one refresh call may go out.
function refreshSession() {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Options = { method?: string; body?: unknown };

async function send(path: string, { method = "GET", body }: Options) {
  return fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let res = await send(path, options);

  // A failed login is also a 401; refreshing there would be pointless.
  const canRefresh = !path.startsWith("/auth/") || path === "/auth/me";
  if (res.status === 401 && canRefresh && (await refreshSession())) {
    res = await send(path, options);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? "Something went wrong", data?.details);
  }
  return data as T;
}
