import { getErrorMessage } from "./api-errors";

export async function smartApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function smartApiError(error: unknown, fallback: string): string {
  return getErrorMessage(error, fallback);
}
