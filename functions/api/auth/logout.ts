// POST /api/auth/logout — delete session and clear cookie
import { getRepository } from '../../../src/lib/db/index';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { buildDeleteCookieHeader, parseCookies, getSessionCookieName, hashSessionId } from '../../../src/lib/auth/cookie';

interface Env {
  DB: unknown;
  KV: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const repo = getRepository(context.env);
  const cookieHeader = context.request.headers.get('Cookie');

  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const sid = cookies[getSessionCookieName()];
    if (sid) {
      const sessionHash = await hashSessionId(sid);
      await repo.deleteSessionByHash(sessionHash);
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildDeleteCookieHeader(),
    },
  });
};
