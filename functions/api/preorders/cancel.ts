import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { preorderCancelSchema } from '../../../src/lib/validation';
interface Env { D1_DATABASE?: unknown; CATALOG_KV?: unknown; [key: string]: unknown }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const repo = getRepository(adaptEnv(context.env));
  const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
  if (!user) return json(401, { error: 'not_authenticated' });
  const parsed = preorderCancelSchema.safeParse(await context.request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'validation_failed' });
  const owned = (await repo.getPreordersForUser(user.id)).find((p) => p.id === parsed.data.preorderId);
  if (!owned) return json(404, { error: 'registration_not_found' });
  await repo.cancelPreorder(owned.id, user.id);
  return json(200, { success: true });
};
