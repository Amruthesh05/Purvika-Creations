// POST /api/orders/cancel — owner cancels a pending order
import { z } from 'zod';
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { cancelOrderSchema } from '../../../src/lib/validation';

interface Env {
  DB?: unknown;
  KV?: unknown;
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  [key: string]: unknown;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const sendJson = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const repo = getRepository(adaptEnv(context.env));
    const cookieHeader = context.request.headers.get('Cookie');
    const user = await getUserFromRequest(repo, cookieHeader);
    if (!user) {
      return sendJson(401, { error: 'not_authenticated' });
    }

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return sendJson(400, { error: 'invalid_body' });
    }

    const parsed = cancelOrderSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
    }

    const { orderId, reason } = parsed.data;
    const order = await repo.getOrderForUser(orderId, user.id);
    if (!order) {
      return sendJson(404, { error: 'order_not_found' });
    }

    // Can only cancel while fulfilment is pending
    if (order.fulfilment_status !== 'pending') {
      return sendJson(409, { error: 'already_shipped' });
    }

    const isCreated = order.status === 'created';
    const isPaidOnline = order.status === 'paid' && order.payment_method === 'online';
    const isPaidCod = order.status === 'paid' && order.payment_method === 'cod';

    if (isPaidCod) {
      // Paid COD = delivered; cannot cancel
      return sendJson(409, { error: 'already_delivered' });
    }

    if (!isCreated && !isPaidOnline) {
      return sendJson(409, { error: 'cannot_cancel_in_current_state' });
    }

    let finalReason = reason ?? null;
    if (isPaidOnline) {
      // TODO: trigger automatic refund via the payment provider once configured.
      finalReason = finalReason ? `${finalReason} (refund needed)` : 'refund needed';
    }

    await repo.cancelOrder(orderId, user.id, finalReason);
    return sendJson(200, { orderId, status: 'cancelled' });
  } catch (err) {
    console.error('orders/cancel POST failed:', err);
    return sendJson(500, { error: 'cancel_failed' });
  }
};

void z;
