export const AUTH_TOKEN_KEY = "auth_token";
export const SESSION_CHANGED_EVENT = "hoviat:admin-session-changed";

/** Read expiry for UI/session cleanup only. The API still verifies the JWT. */
export function tokenExpiresAt(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const milliseconds = payload?.exp * 1000;
    return typeof payload?.exp === "number" && Number.isFinite(milliseconds) ? milliseconds : null;
  } catch {
    return null;
  }
}

export function tokenHasExpired(token: string, now = Date.now()): boolean {
  const expiry = tokenExpiresAt(token);
  return expiry !== null && expiry <= now;
}

/** A delayed rejection from an old request must not log out a newer session. */
export function endSession(expectedToken?: string): void {
  if (expectedToken !== undefined && localStorage.getItem(AUTH_TOKEN_KEY) !== expectedToken) return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

/** Shared by authenticated JSON requests and multipart uploads; bodies stay intact. */
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const token = headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const response = await fetch(input, init);
  // Permissions, network failures and server failures are not session expiry.
  if (response.status === 401 && token) endSession(token);
  return response;
}
