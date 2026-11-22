export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_CODES_PER_EMAIL_HOUR = 5;
export const MAX_CODES_PER_IP_HOUR = 20;

const HOUR_SECONDS = 3600;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Largest multiple of 1,000,000 below 2^32; larger draws are rejected so every code is equally likely.
const UNBIASED_LIMIT = 4294000000;

export function generateLoginCode(): string {
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= UNBIASED_LIMIT);
  return String(buf[0] % 1000000).padStart(6, '0');
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(new Uint8Array(signature));
}

export function hashLoginCode(code: string, pepper: string): Promise<string> {
  return hmacHex(pepper, code);
}

export function hashClientIp(ip: string, pepper: string): Promise<string> {
  return hmacHex(pepper, `ip:${ip}`);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isValidCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function codeExpiresAt(now: Date): string {
  return new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString();
}

export type RequestLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkCodeRequestLimits(input: {
  now: Date;
  lastSentAt: string | null;
  emailCodesLastHour: number;
  ipCodesLastHour: number;
}): RequestLimitResult {
  if (input.lastSentAt) {
    const elapsedSeconds = (input.now.getTime() - new Date(input.lastSentAt).getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      return { ok: false, retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds) };
    }
  }
  if (input.emailCodesLastHour >= MAX_CODES_PER_EMAIL_HOUR || input.ipCodesLastHour >= MAX_CODES_PER_IP_HOUR) {
    return { ok: false, retryAfterSeconds: HOUR_SECONDS };
  }
  return { ok: true };
}
