// GET /api/orders/mine — current user's orders with items, newest first
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';

interface Env {
  DB?: unknown;
  KV?: unknown;
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  [key: string]: unknown;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const sendJson = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const repo = getRepository(adaptEnv(context.env));
    const cookieHeader = context.request.headers.get('Cookie');
    const user = await getUserFromRequest(repo, cookieHeader);
    if (!user) {
      return sendJson(401, { error: 'not_authenticated' });
    }

    const orders = await repo.getOrdersByUserWithItems(user.id);
    return sendJson(200, { orders });
  } catch (err) {
    console.error('orders/mine GET failed:', err);
    return sendJson(500, { error: 'orders_failed' });
  }
};
