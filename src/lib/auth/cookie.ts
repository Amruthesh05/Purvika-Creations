const SESSION_COOKIE = 'sid';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashSessionId(id: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(id);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getSessionExpiry(): string {
  return new Date(Date.now() + SESSION_DURATION_MS).toISOString();
}

export function buildSessionCookieHeader(value: string, expires: Date): string {
  return [
    `${SESSION_COOKIE}=${value}`,
    `Expires=${expires.toUTCString()}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
  ].join('; ');
}

export function buildDeleteCookieHeader(): string {
  return `${SESSION_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax; Path=/`;
}

export function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) {
      result[key] = decodeURIComponent(rest.join('='));
    }
  }
  return result;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}
