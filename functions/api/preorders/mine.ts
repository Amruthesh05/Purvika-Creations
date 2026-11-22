import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
interface Env { D1_DATABASE?: unknown; CATALOG_KV?: unknown; [key: string]: unknown }
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const repo = getRepository(adaptEnv(context.env));
  const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
  if (!user) return new Response(JSON.stringify({ error: 'not_authenticated' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ preorders: await repo.getPreordersForUser(user.id) }), { headers: { 'Content-Type': 'application/json' } });
};
