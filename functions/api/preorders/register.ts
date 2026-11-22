import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { indianMobileSchema, preorderRegisterSchema } from '../../../src/lib/validation';

interface Env { D1_DATABASE?: unknown; CATALOG_KV?: unknown; [key: string]: unknown }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const repo = getRepository(adaptEnv(context.env));
  const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
  if (!user) return json(401, { error: 'not_authenticated' });
  const parsed = preorderRegisterSchema.safeParse(await context.request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
  const product = await repo.getProductById(parsed.data.productId);
  if (!product || !product.active) return json(404, { error: 'product_not_found' });
  if (product.saleMode !== 'preorder') return json(409, { error: 'registrations_closed' });
  const existing = (await repo.getPreordersForUser(user.id)).find((p) => p.product_id === product.id && p.status === 'registered');
  if (existing) return json(409, { error: 'already_registered' });
  const activeCount = await repo.countActivePreorders(product.id);
  if (product.preorderLimit !== null && activeCount >= product.preorderLimit) return json(409, { error: 'registration_limit_reached' });
  const phone = indianMobileSchema.parse(parsed.data.phone).replace(/^\+91|^0/, '');
  const preorder = await repo.createOrReactivatePreorder({ productId: product.id, userId: user.id, quantity: parsed.data.quantity, name: user.display_name || user.email, phone, altPhone: parsed.data.altPhone || null, note: parsed.data.note || null });
  return json(200, { preorder });
};
