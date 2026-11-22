// POST /api/orders/update-shipping — owner updates shipping address while pending
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { updateShippingSchema } from '../../../src/lib/validation';
import { isDeliveryMode, getDeliveryFeePaise } from '../../../src/lib/delivery/config';
import { COD_FEE_PAISE } from '../../../src/lib/payments/config';

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

    const parsed = updateShippingSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
    }

    const { orderId, name, phone, altPhone, address } = parsed.data;
    const deliveryModeRaw = (body as { deliveryMode?: string })?.deliveryMode;
    const order = await repo.getOrderForUser(orderId, user.id);
    if (!order) {
      return sendJson(404, { error: 'order_not_found' });
    }

    if (order.fulfilment_status !== 'pending' || (order.status !== 'created' && order.status !== 'paid')) {
      return sendJson(409, { error: 'cannot_update_in_current_state' });
    }

    await repo.updateOrderShipping(orderId, user.id, name, phone, altPhone ?? null, address);

    if (deliveryModeRaw !== undefined) {
      if (!isDeliveryMode(deliveryModeRaw)) {
        return sendJson(400, { error: 'invalid_delivery_mode' });
      }
      const deliveryMode = deliveryModeRaw;
      if (order.payment_method === 'online') {
        return sendJson(409, { error: 'delivery_mode_locked_for_online', hint: 'Cancel and reorder to change delivery mode for online orders.' });
      }
      if (order.status !== 'created') {
        return sendJson(409, { error: 'delivery_mode_locked_after_payment' });
      }
      const newFee = getDeliveryFeePaise(deliveryMode);
      const itemsTotalPaise = order.total_paise - order.delivery_fee_paise - order.cod_fee_paise;
      const newTotal = itemsTotalPaise + newFee + order.cod_fee_paise;
      await repo.updateOrderDeliveryMode(orderId, user.id, deliveryMode, newFee, newTotal);
    }

    return sendJson(200, { orderId, updated: true });
  } catch (err) {
    console.error('orders/update-shipping POST failed:', err);
    return sendJson(500, { error: 'update_shipping_failed' });
  }
};

void COD_FEE_PAISE;
