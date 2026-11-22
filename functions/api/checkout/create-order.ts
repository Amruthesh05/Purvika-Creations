// POST /api/checkout/create-order — create a provider order and persist it
import { z } from 'zod';
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { getPaymentProvider } from '../../../src/lib/payments/index';
import { COD_FEE_PAISE, COD_MAX_ORDER_PAISE, isCodAvailable } from '../../../src/lib/payments/config';
import { isDeliveryMode, getDeliveryFeePaise } from '../../../src/lib/delivery/config';
import type { RazorpayNotConfiguredError } from '../../../src/lib/payments/razorpay';
import type { Product } from '../../../src/lib/types';

interface Env {
  DB?: unknown;
  KV?: unknown;
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  PAYMENT_MODE?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  COD_ENABLED?: string;
  [key: string]: unknown;
}

const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1, 'Min 1 per item').max(10, 'Max 10 per item'),
  variantId: z.string().optional(),
});

const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Cart is empty'),
  shipping: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    phone: z.string().min(1, 'Phone is required').max(20),
    altPhone: z.string().max(20).optional(),
    address: z.string().min(1, 'Address is required').max(2000),
  }),
  paymentMethod: z.enum(['online', 'cod']).optional(),
  deliveryMode: z.string().optional(),
});

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

    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
    }

    const { items, shipping, paymentMethod } = parsed.data;
    const deliveryModeRaw = parsed.data.deliveryMode ?? 'courier';
    if (!isDeliveryMode(deliveryModeRaw)) {
      return sendJson(400, { error: 'invalid_delivery_mode' });
    }
    const deliveryMode = deliveryModeRaw;
    const deliveryFeePaise = getDeliveryFeePaise(deliveryMode);

    // Load products from D1 and validate every cart item
    const productMap = new Map<string, Product>();
    for (const item of items) {
      if (!productMap.has(item.productId)) {
        const p = await repo.getProductById(item.productId);
        if (!p) {
          return sendJson(400, { error: 'unknown_product', productId: item.productId });
        }
        productMap.set(item.productId, p);
      }
    }

    for (const item of items) {
      const p = productMap.get(item.productId)!;
      if (p.saleMode !== 'buy') {
        return sendJson(409, { error: 'not_for_sale', productId: item.productId });
      }
      if (!p.active) {
        return sendJson(400, { error: 'inactive_product', productId: item.productId });
      }
      // Variant validation
      if (p.variants && p.variants.length > 0) {
        if (!item.variantId) {
          return sendJson(400, { error: 'variant_required', productId: item.productId });
        }
        const variant = p.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return sendJson(400, { error: 'unknown_variant', productId: item.productId, variantId: item.variantId });
        }
        if (!variant.in_stock) {
          return sendJson(409, { error: 'variant_out_of_stock', productId: item.productId, variantId: item.variantId });
        }
      } else {
        // No variants — check product-level stock
        if (p.stock_status === 'out_of_stock') {
          return sendJson(409, { error: 'out_of_stock', productId: item.productId });
        }
      }
    }

    // Compute item total on the server from D1 prices (ignore any client fee/total)
    const itemTotalPaise = items.reduce((sum, i) => sum + productMap.get(i.productId)!.price_paise * i.quantity, 0);
    if (itemTotalPaise <= 0) {
      return sendJson(400, { error: 'invalid_total' });
    }

    const method = paymentMethod ?? 'online';
    const codEnabled = context.env.COD_ENABLED !== 'false';

    // Helper: build order items with variant snapshots
    const buildOrderItems = () => items.map((i) => {
      const p = productMap.get(i.productId)!;
      if (p.variants && p.variants.length > 0) {
        const v = p.variants.find((vv) => vv.id === i.variantId);
        return {
          productId: i.productId,
          nameSnapshot: p.name,
          pricePaiseSnapshot: p.price_paise,
          quantity: i.quantity,
          variantId: v?.id,
          variantLabel: p.variantLabel ?? 'Size',
          variantValue: v?.label,
          mrpPaiseSnapshot: p.mrpPaise ?? null,
        };
      }
      return {
        productId: i.productId,
        nameSnapshot: p.name,
        pricePaiseSnapshot: p.price_paise,
        quantity: i.quantity,
        mrpPaiseSnapshot: p.mrpPaise ?? null,
      };
    });

    if (method === 'cod') {
      if (!isCodAvailable(itemTotalPaise, codEnabled)) {
        return sendJson(409, { error: 'cod_not_available' });
      }
      const totalPaise = itemTotalPaise + deliveryFeePaise + COD_FEE_PAISE;
      const order = await repo.createOrder({
        userId: user.id,
        totalPaise,
        paymentMethod: 'cod',
        codFeePaise: COD_FEE_PAISE,
        deliveryMode,
        deliveryFeePaise,
        shippingName: shipping.name,
        shippingPhone: shipping.phone,
        shippingAltPhone: shipping.altPhone ?? undefined,
        shippingAddress: shipping.address,
        items: buildOrderItems(),
      });
      return sendJson(200, {
        orderId: order.id,
        paymentMethod: 'cod',
        amount: totalPaise,
        codFeePaise: COD_FEE_PAISE,
        deliveryMode,
        deliveryFeePaise,
      });
    }

    // Online payment
    const providerAmount = itemTotalPaise + deliveryFeePaise;
    const { provider, mode } = getPaymentProvider(context.env as { PAYMENT_MODE?: string; RAZORPAY_KEY_ID?: string; RAZORPAY_KEY_SECRET?: string });
    let providerOrderId: string;
    let keyId: string | undefined;
    try {
      const result = await provider.createOrder(providerAmount, `order_${user.id}_${Date.now()}`);
      providerOrderId = result.providerOrderId;
      keyId = result.publicConfig.keyId;
    } catch (err) {
      const e = err as RazorpayNotConfiguredError;
      if (e?.code === 'payments_not_configured') {
        console.error('checkout: payments not configured');
        return sendJson(503, { error: 'payments_not_configured' });
      }
      console.error('checkout: provider order failed:', err);
      return sendJson(502, { error: 'provider_order_failed' });
    }

    const order = await repo.createOrder({
      userId: user.id,
      totalPaise: providerAmount,
      paymentMethod: 'online',
      codFeePaise: 0,
      deliveryMode,
      deliveryFeePaise,
      providerOrderId,
      shippingName: shipping.name,
      shippingPhone: shipping.phone,
      shippingAltPhone: shipping.altPhone ?? undefined,
      shippingAddress: shipping.address,
      items: buildOrderItems(),
    });
    return sendJson(200, {
      orderId: order.id,
      provider: mode,
      providerOrderId,
      amount: providerAmount,
      currency: 'INR',
      keyId,
      deliveryMode,
      deliveryFeePaise,
    });
  } catch (err) {
    console.error('checkout/create-order failed:', err);
    return sendJson(500, { error: 'checkout_failed' });
  }
};

void COD_MAX_ORDER_PAISE;
