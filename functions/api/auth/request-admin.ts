// POST /api/auth/request-admin — buyer requests admin access
import { getRepository } from '../../../src/lib/db/index';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { handleAdminAction } from '../../../src/lib/admin-action-handler';

interface Env {
  DB: unknown;
  KV: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const repo = getRepository(context.env);
  const cookieHeader = context.request.headers.get('Cookie');
  const user = await getUserFromRequest(repo, cookieHeader);

  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await handleAdminAction({ repo, user }, { action: 'request_admin' });
  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 403,
    headers: { 'Content-Type': 'application/json' },
  });
};
