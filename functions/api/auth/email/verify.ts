// POST /api/auth/email/verify — check a one-time login code and start a session
import { getRepository } from '../../../../src/lib/db/index';
import { adaptEnv } from '../../../../src/lib/env';
import { normalizeEmail } from '../../../../src/lib/auth/otp';
import { verifyLoginCode } from '../../../../src/lib/auth/email-login';

type Env = {
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  DB?: unknown;
  KV?: unknown;
  OTP_PEPPER: string;
  SUPERADMIN_EMAIL: string;
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json().catch(() => null)) as { email?: unknown; code?: unknown } | null;
    const email = normalizeEmail(body?.email);
    const code = body && typeof body.code === 'string' ? body.code : '';
    if (!email) return json(401, { error: 'invalid_code' });

    const repo = getRepository(adaptEnv(context.env));
    const outcome = await verifyLoginCode(
      { repo, pepper: context.env.OTP_PEPPER, superadminEmail: context.env.SUPERADMIN_EMAIL },
      { email, code },
    );
    if (outcome.kind !== 'ok') return json(401, { error: 'invalid_code' });
    return json(200, { user: outcome.user }, { 'Set-Cookie': outcome.setCookie });
  } catch {
    console.error('email login verify failed');
    return json(500, { error: 'server_error' });
  }
};
