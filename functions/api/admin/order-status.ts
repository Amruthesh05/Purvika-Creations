// POST /api/admin/order-status — admin order actions (mark_delivered, mark_shipped)
import { z } from 'zod';
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest, isApprovedAdmin } from '../../../src/lib/auth/session';

interface Env {
  DB?: unknown;
  KV?: unknown;
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  [key: string]: unknown;
}

const orderStatusSchema = z.object({
  orderId: z.string().min(1),
  action: z.enum(['mark_delivered', 'mark_shipped']),
});

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sendJson = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const repo = getRepository(adaptEnv(context.env));
    const cookieHeader = context.request.headers.get('Cookie');
    const user = await getUserFromRequest(repo, cookieHeader);

    if (!user) {
      return sendJson(401, { error: 'Not authenticated' });
    }
    if (!isApprovedAdmin(user)) {
      return sendJson(403, { error: 'Forbidden' });
    }

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return sendJson(400, { error: 'invalid_body' });
    }

    const parsed = orderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
    }

    const { orderId, action } = parsed.data;
    const order = await repo.getOrderById(orderId);
    if (!order) {
      return sendJson(404, { error: 'order_not_found' });
    }

    if (action === 'mark_shipped') {
      if (order.fulfilment_status !== 'pending') {
        return sendJson(409, { error: 'already_shipped' });
      }
      await repo.setFulfilmentStatus(orderId, 'shipped');
      return sendJson(200, { orderId, fulfilment_status: 'shipped' });
    }

    if (order.fulfilment_status === 'delivered') {
      return sendJson(409, { error: 'already_delivered' });
    }
    if (order.payment_method === 'cod' && order.status !== 'paid') {
      await repo.markOrderPaymentCollected(orderId);
    }
    await repo.setFulfilmentStatus(orderId, 'delivered');
    await repo.markOrderDelivered(orderId);
    return sendJson(200, { orderId, status: 'paid', fulfilment_status: 'delivered' });
  } catch (err) {
    console.error('admin/order-status POST failed:', err);
    return sendJson(500, { error: 'order_status_failed' });
  }
};
