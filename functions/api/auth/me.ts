// GET /api/auth/me — return current user from session cookie
import { getRepository } from '../../../src/lib/db/index';
import { getUserFromRequest } from '../../../src/lib/auth/session';

interface Env {
  DB: unknown;
  KV: unknown;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const repo = getRepository(context.env);
  const cookieHeader = context.request.headers.get('Cookie');
  const user = await getUserFromRequest(repo, cookieHeader);
  return new Response(JSON.stringify({ user }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
