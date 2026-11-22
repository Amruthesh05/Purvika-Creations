// POST /api/auth/google — verify Google ID token, create session
import { getRepository } from '../../../src/lib/db/index';
import { verifyGoogleToken } from '../../../src/lib/auth/google-token';
import { findOrCreateUser } from '../../../src/lib/auth/session';
import { generateSessionId, hashSessionId, getSessionExpiry, buildSessionCookieHeader, parseCookies, getSessionCookieName } from '../../../src/lib/auth/cookie';

interface Env {
  DB: unknown;
  KV: unknown;
  SUPERADMIN_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const repo = getRepository(context.env);
  const body = await context.request.json() as { credential?: string };

  if (!body.credential) {
    return new Response(JSON.stringify({ error: 'Missing credential' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const claims = await verifyGoogleToken(body.credential, context.env.GOOGLE_CLIENT_ID);
  if (!claims) {
    return new Response(JSON.stringify({ error: 'Invalid ID token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await findOrCreateUser(repo, claims.email, context.env.SUPERADMIN_EMAIL);

  const rawSessionId = generateSessionId();
  const sessionHash = await hashSessionId(rawSessionId);
  const expiresAt = getSessionExpiry();
  await repo.createSession(sessionHash, user.id, expiresAt);

  return new Response(JSON.stringify({ user }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSessionCookieHeader(rawSessionId, new Date(expiresAt)),
    },
  });
};
