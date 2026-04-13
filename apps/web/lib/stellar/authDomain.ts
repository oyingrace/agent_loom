/**
 * Hostname used inside signed auth messages. Must match what the client signs.
 * Prefer `NEXT_PUBLIC_AUTH_DOMAIN` in production; otherwise derive from `NEXT_PUBLIC_APP_URL`.
 */
export function getAuthDomain(): string {
  const explicit = process.env.NEXT_PUBLIC_AUTH_DOMAIN?.trim();
  if (explicit) {
    return explicit.toLowerCase();
  }
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "localhost";
  }
}
