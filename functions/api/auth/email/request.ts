// POST /api/auth/email/request — send a one-time login code
import { getRepository } from '../../../../src/lib/db/index';
import { adaptEnv } from '../../../../src/lib/env';
import { normalizeEmail } from '../../../../src/lib/auth/otp';
import { requestLoginCode } from '../../../../src/lib/auth/email-login';
import { verifyTurnstileToken } from '../../../../src/lib/auth/turnstile';
import { sendLoginCodeEmail } from '../../../../src/lib/email/send';

type Env = {
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  DB?: unknown;
  KV?: unknown;
  OTP_PEPPER: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  TURNSTILE_SECRET?: string;
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json().catch(() => null)) as { email?: unknown; turnstileToken?: unknown } | null;
    const email = normalizeEmail(body?.email);
    if (!email) return json(400, { error: 'invalid_email' });

    const ip = context.request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (context.env.TURNSTILE_SECRET) {
      const token = body && typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
      if (!token || !(await verifyTurnstileToken(context.env.TURNSTILE_SECRET, token, ip))) {
        return json(403, { error: 'turnstile_failed' });
      }
    }

    const repo = getRepository(adaptEnv(context.env));
    const outcome = await requestLoginCode(
      { repo, pepper: context.env.OTP_PEPPER, sendCode: (to, code) => sendLoginCodeEmail(context.env, to, code) },
      { email, ip },
    );
    if (outcome.kind === 'rate_limited') {
      return json(
        429,
        { error: 'rate_limited', message: 'Too many requests. Please wait a few minutes and try again.' },
        { 'Retry-After': String(outcome.retryAfterSeconds) },
      );
    }
    if (outcome.kind === 'email_not_configured') return json(503, { error: 'email_not_configured' });
    if (outcome.kind === 'email_failed') return json(502, { error: 'email_failed' });
    return json(200, { ok: true });
  } catch {
    console.error('email login request failed');
    return json(500, { error: 'server_error' });
  }
};
