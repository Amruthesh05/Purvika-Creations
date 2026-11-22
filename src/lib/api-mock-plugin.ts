import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { User, Product } from '@/lib/types';

const DEV_OTP_PEPPER = 'dev-only-otp-pepper';

// Lazy-loaded modules — these use the @/ alias which is only available
// once Vite's module resolution is active (i.e. during dev server request handling,
// not during config loading).
let loaded: {
  getRepository: typeof import('@/lib/db')['getRepository'];
  handleMutate: typeof import('@/lib/mutate-handler')['handleMutate'];
  handleAdminAction: typeof import('@/lib/admin-action-handler')['handleAdminAction'];
  getUserFromRequest: typeof import('@/lib/auth/session')['getUserFromRequest'];
  isApprovedAdmin: typeof import('@/lib/auth/session')['isApprovedAdmin'];
  findOrCreateUser: typeof import('@/lib/auth/session')['findOrCreateUser'];
  verifyGoogleToken: typeof import('@/lib/auth/google-token')['verifyGoogleToken'];
  generateSessionId: typeof import('@/lib/auth/cookie')['generateSessionId'];
  hashSessionId: typeof import('@/lib/auth/cookie')['hashSessionId'];
  getSessionExpiry: typeof import('@/lib/auth/cookie')['getSessionExpiry'];
  buildSessionCookieHeader: typeof import('@/lib/auth/cookie')['buildSessionCookieHeader'];
  buildDeleteCookieHeader: typeof import('@/lib/auth/cookie')['buildDeleteCookieHeader'];
  parseCookies: typeof import('@/lib/auth/cookie')['parseCookies'];
  getSessionCookieName: typeof import('@/lib/auth/cookie')['getSessionCookieName'];
  getPaymentProvider: typeof import('@/lib/payments/index')['getPaymentProvider'];
  resolvePaymentMode: typeof import('@/lib/payments/index')['resolvePaymentMode'];
  requestLoginCode: typeof import('@/lib/auth/email-login')['requestLoginCode'];
  verifyLoginCode: typeof import('@/lib/auth/email-login')['verifyLoginCode'];
  normalizeEmail: typeof import('@/lib/auth/otp')['normalizeEmail'];
} | null = null;

async function loadModules() {
  if (loaded) return loaded;
  const db = await import('@/lib/db');
  const mutate = await import('@/lib/mutate-handler');
  const adminAction = await import('@/lib/admin-action-handler');
  const session = await import('@/lib/auth/session');
  const googleToken = await import('@/lib/auth/google-token');
  const cookie = await import('@/lib/auth/cookie');
  const payments = await import('@/lib/payments/index');
  const emailLogin = await import('@/lib/auth/email-login');
  const otp = await import('@/lib/auth/otp');
  loaded = {
    getRepository: db.getRepository,
    handleMutate: mutate.handleMutate,
    handleAdminAction: adminAction.handleAdminAction,
    getUserFromRequest: session.getUserFromRequest,
    isApprovedAdmin: session.isApprovedAdmin,
    findOrCreateUser: session.findOrCreateUser,
    verifyGoogleToken: googleToken.verifyGoogleToken,
    generateSessionId: cookie.generateSessionId,
    hashSessionId: cookie.hashSessionId,
    getSessionExpiry: cookie.getSessionExpiry,
    buildSessionCookieHeader: cookie.buildSessionCookieHeader,
    buildDeleteCookieHeader: cookie.buildDeleteCookieHeader,
    parseCookies: cookie.parseCookies,
    getSessionCookieName: cookie.getSessionCookieName,
    getPaymentProvider: payments.getPaymentProvider,
    resolvePaymentMode: payments.resolvePaymentMode,
    requestLoginCode: emailLogin.requestLoginCode,
    verifyLoginCode: emailLogin.verifyLoginCode,
    normalizeEmail: otp.normalizeEmail,
  };
  return loaded;
}

async function handleApiRoute(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? '';
  const method = req.method ?? 'GET';

  if (!url.startsWith('/api/')) return false;

  const m = await loadModules();
  const cookieHeader = req.headers.cookie ?? null;
  const repo = m.getRepository();
  const user = await m.getUserFromRequest(repo, cookieHeader);

  const sendJson = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };

  const readBody = (): Promise<string> => {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
    });
  };

  // GET /api/catalog — returns plain product array (matches real Cloudflare function)
  if (url === '/api/catalog' && method === 'GET') {
    const data = await repo.getCatalog();
    sendJson(200, data.products ?? []);
    return true;
  }

  // GET /api/auth/me
  if (url === '/api/auth/me' && method === 'GET') {
    sendJson(200, { user });
    return true;
  }

  // POST /api/auth/google
  if (url === '/api/auth/google' && method === 'POST') {
    const body = JSON.parse(await readBody());
    const claims = await m.verifyGoogleToken(body.credential, 'preview-client-id');
    if (!claims) {
      sendJson(401, { error: 'Invalid ID token' });
      return true;
    }
    const superadminEmail = process.env.SUPERADMIN_EMAIL ?? 'admin@example.com';
    const dbUser = await m.findOrCreateUser(repo, claims.email, superadminEmail);
    const rawSessionId = m.generateSessionId();
    const sessionHash = await m.hashSessionId(rawSessionId);
    const expiresAt = m.getSessionExpiry();
    await repo.createSession(sessionHash, dbUser.id, expiresAt);
    sendJson(200, { user: dbUser }, { 'Set-Cookie': m.buildSessionCookieHeader(rawSessionId, new Date(expiresAt)) });
    return true;
  }

  // POST /api/auth/email/request (DEV: prints the code instead of emailing it)
  if (url === '/api/auth/email/request' && method === 'POST') {
    const body = JSON.parse(await readBody()) as { email?: unknown };
    const email = m.normalizeEmail(body.email);
    if (!email) {
      sendJson(400, { error: 'invalid_email' });
      return true;
    }
    const outcome = await m.requestLoginCode(
      {
        repo,
        pepper: DEV_OTP_PEPPER,
        sendCode: async (to, code) => {
          console.log(`[dev] Styvio login code for ${to}: ${code}`);
          return { ok: true };
        },
      },
      { email, ip: req.socket.remoteAddress ?? 'dev' },
    );
    if (outcome.kind === 'rate_limited') {
      sendJson(
        429,
        { error: 'rate_limited', message: 'Too many requests. Please wait a few minutes and try again.' },
        { 'Retry-After': String(outcome.retryAfterSeconds) },
      );
      return true;
    }
    if (outcome.kind !== 'sent') {
      sendJson(502, { error: 'email_failed' });
      return true;
    }
    sendJson(200, { ok: true });
    return true;
  }

  // POST /api/auth/email/verify
  if (url === '/api/auth/email/verify' && method === 'POST') {
    const body = JSON.parse(await readBody()) as { email?: unknown; code?: unknown };
    const email = m.normalizeEmail(body.email);
    const outcome = email && typeof body.code === 'string'
      ? await m.verifyLoginCode(
          { repo, pepper: DEV_OTP_PEPPER, superadminEmail: process.env.SUPERADMIN_EMAIL ?? 'admin@example.com' },
          { email, code: body.code },
        )
      : { kind: 'invalid' as const };
    if (outcome.kind !== 'ok') {
      sendJson(401, { error: 'invalid_code' });
      return true;
    }
    sendJson(200, { user: outcome.user }, { 'Set-Cookie': outcome.setCookie });
    return true;
  }

  // POST /api/auth/logout
  if (url === '/api/auth/logout' && method === 'POST') {
    if (cookieHeader) {
      const cookies = m.parseCookies(cookieHeader);
      const sid = cookies[m.getSessionCookieName()];
      if (sid) {
        const sessionHash = await m.hashSessionId(sid);
        await repo.deleteSessionByHash(sessionHash);
      }
    }
    sendJson(200, { success: true }, { 'Set-Cookie': m.buildDeleteCookieHeader() });
    return true;
  }

  // POST /api/auth/request-admin
  if (url === '/api/auth/request-admin' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'Not authenticated' });
      return true;
    }
    const result = await m.handleAdminAction({ repo, user }, { action: 'request_admin' });
    sendJson(result.success ? 200 : 403, result);
    return true;
  }

  // GET /api/admin/products
  if (url === '/api/admin/products' && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'Not authenticated' });
      return true;
    }
    if (!m.isApprovedAdmin(user)) {
      sendJson(403, { error: 'Forbidden' });
      return true;
    }
    const products = await repo.getAllProducts();
    sendJson(200, { products });
    return true;
  }

  // GET /api/admin/users
  if (url === '/api/admin/users' && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'Not authenticated' });
      return true;
    }
    if (!m.isApprovedAdmin(user)) {
      sendJson(403, { error: 'Forbidden' });
      return true;
    }
    const users = await repo.getAllUsers();
    const superadminCount = await repo.getSuperadminCount();
    sendJson(200, { users, superadminCount });
    return true;
  }

  // POST /api/admin/mutate
  if (url === '/api/admin/mutate' && method === 'POST') {
    const body = JSON.parse(await readBody());
    if (body.action && (body.action === 'ADD' || body.action === 'UPDATE' || body.action === 'DELETE' || body.action === 'SET_STATUS')) {
      const result = await m.handleMutate({ repo, user }, body);
      sendJson(result.success ? 200 : 400, result);
      return true;
    }
    if (body.action && (body.action === 'approve_admin' || body.action === 'revoke_admin' || body.action === 'delete_admin_user' || body.action === 'request_admin')) {
      const result = await m.handleAdminAction({ repo, user }, body);
      sendJson(result.success ? 200 : 403, result);
      return true;
    }
    sendJson(400, { success: false, error: 'Unknown action' });
    return true;
  }

  // POST /api/checkout/create-order
  if (url === '/api/checkout/create-order' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody());
    } catch {
      sendJson(400, { error: 'invalid_body' });
      return true;
    }
    try {
      const items = (body as { items?: { productId: string; quantity: number; variantId?: string }[] })?.items ?? [];
      const shipping = (body as { shipping?: { name: string; phone: string; altPhone?: string; address: string } })?.shipping;
      const paymentMethod = (body as { paymentMethod?: string })?.paymentMethod ?? 'online';
      const deliveryModeRaw = (body as { deliveryMode?: string })?.deliveryMode ?? 'courier';
      const { isDeliveryMode, getDeliveryFeePaise } = await import('@/lib/delivery/config');
      if (!isDeliveryMode(deliveryModeRaw)) {
        sendJson(400, { error: 'invalid_delivery_mode' });
        return true;
      }
      const deliveryMode = deliveryModeRaw;
      const deliveryFeePaise = getDeliveryFeePaise(deliveryMode);
      if (!items.length) {
        sendJson(400, { error: 'validation_failed', details: ['Cart is empty'] });
        return true;
      }
      if (!shipping?.name || !shipping?.phone || !shipping?.address) {
        sendJson(400, { error: 'validation_failed', details: ['Shipping details are required'] });
        return true;
      }
      if (paymentMethod !== 'online' && paymentMethod !== 'cod') {
        sendJson(400, { error: 'validation_failed', details: ['Invalid payment method'] });
        return true;
      }
      for (const item of items) {
        if (!item.productId || typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 10) {
          sendJson(400, { error: 'validation_failed', details: ['Invalid item quantity'] });
          return true;
        }
        const product = await repo.getProductById(item.productId);
        if (!product) {
          sendJson(400, { error: 'unknown_product', productId: item.productId });
          return true;
        }
        if (!product.active) {
          sendJson(400, { error: 'inactive_product', productId: item.productId });
          return true;
        }
        if (product.saleMode !== 'buy') {
          sendJson(409, { error: 'not_for_sale', productId: item.productId });
          return true;
        }
        if (product.variants && product.variants.length > 0) {
          if (!item.variantId) {
            sendJson(400, { error: 'variant_required', productId: item.productId });
            return true;
          }
          const variant = product.variants.find((v) => v.id === item.variantId);
          if (!variant) {
            sendJson(400, { error: 'unknown_variant', productId: item.productId, variantId: item.variantId });
            return true;
          }
          if (!variant.in_stock) {
            sendJson(409, { error: 'variant_out_of_stock', productId: item.productId, variantId: item.variantId });
            return true;
          }
        } else {
          if (product.stock_status === 'out_of_stock') {
            sendJson(409, { error: 'out_of_stock', productId: item.productId });
            return true;
          }
        }
      }
      const productMap = new Map<string, Product>();
      for (const item of items) {
        if (!productMap.has(item.productId)) {
          const p = await repo.getProductById(item.productId);
          if (p) productMap.set(item.productId, p);
        }
      }
      const itemTotalPaise = items.reduce((sum, i) => sum + (productMap.get(i.productId)?.price_paise ?? 0) * i.quantity, 0);

      if (paymentMethod === 'cod') {
        const codEnabled = process.env.COD_ENABLED !== 'false';
        const { COD_FEE_PAISE, isCodAvailable } = await import('@/lib/payments/config');
        if (!isCodAvailable(itemTotalPaise, codEnabled)) {
          sendJson(409, { error: 'cod_not_available' });
          return true;
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
          items: items.map((i) => {
            const p = productMap.get(i.productId)!;
            if (p.variants && p.variants.length > 0) {
              const v = p.variants.find((vv) => vv.id === i.variantId);
              return { productId: i.productId, nameSnapshot: p.name, pricePaiseSnapshot: p.price_paise, quantity: i.quantity, variantId: v?.id, variantLabel: p.variantLabel ?? 'Size', variantValue: v?.label, mrpPaiseSnapshot: p.mrpPaise ?? null };
            }
            return { productId: i.productId, nameSnapshot: p.name, pricePaiseSnapshot: p.price_paise, quantity: i.quantity, mrpPaiseSnapshot: p.mrpPaise ?? null };
          }),
        });
        sendJson(200, { orderId: order.id, paymentMethod: 'cod', amount: totalPaise, codFeePaise: COD_FEE_PAISE, deliveryMode, deliveryFeePaise });
        return true;
      }

      const { provider, mode } = m.getPaymentProvider({ PAYMENT_MODE: process.env.PAYMENT_MODE ?? 'mock' });
      let providerOrderId: string;
      let keyId: string | undefined;
      try {
        const result = await provider.createOrder(itemTotalPaise + deliveryFeePaise, `order_${user.id}_${Date.now()}`);
        providerOrderId = result.providerOrderId;
        keyId = result.publicConfig.keyId;
      } catch (err) {
        const e = err as { code?: string };
        if (e?.code === 'payments_not_configured') {
          sendJson(503, { error: 'payments_not_configured' });
          return true;
        }
        sendJson(502, { error: 'provider_order_failed' });
        return true;
      }
      const order = await repo.createOrder({
        userId: user.id,
        totalPaise: itemTotalPaise + deliveryFeePaise,
        paymentMethod: 'online',
        codFeePaise: 0,
        deliveryMode,
        deliveryFeePaise,
        providerOrderId,
        shippingName: shipping.name,
        shippingPhone: shipping.phone,
        shippingAltPhone: shipping.altPhone ?? undefined,
        shippingAddress: shipping.address,
        items: items.map((i) => {
          const p = productMap.get(i.productId)!;
          if (p.variants && p.variants.length > 0) {
            const v = p.variants.find((vv) => vv.id === i.variantId);
            return { productId: i.productId, nameSnapshot: p.name, pricePaiseSnapshot: p.price_paise, quantity: i.quantity, variantId: v?.id, variantLabel: p.variantLabel ?? 'Size', variantValue: v?.label, mrpPaiseSnapshot: p.mrpPaise ?? null };
          }
          return { productId: i.productId, nameSnapshot: p.name, pricePaiseSnapshot: p.price_paise, quantity: i.quantity, mrpPaiseSnapshot: p.mrpPaise ?? null };
        }),
      });
      sendJson(200, { orderId: order.id, provider: mode, providerOrderId, amount: itemTotalPaise + deliveryFeePaise, currency: 'INR', keyId, deliveryMode, deliveryFeePaise });
      return true;
    } catch (err) {
      console.error('mock checkout/create-order failed:', err);
      sendJson(500, { error: 'checkout_failed' });
      return true;
    }
  }

  // POST /api/preorders/register
  if (url === '/api/preorders/register' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const body = JSON.parse(await readBody());
    const product = await repo.getProductById(body?.productId);
    if (!product || !product.active) {
      sendJson(404, { error: 'product_not_found' });
      return true;
    }
    if (product.saleMode !== 'preorder') {
      sendJson(409, { error: 'registrations_closed' });
      return true;
    }
    if (!Number.isInteger(body?.quantity) || body.quantity < 1 || body.quantity > 5 || typeof body?.phone !== 'string') {
      sendJson(400, { error: 'validation_failed' });
      return true;
    }
    const phone = body.phone.replace(/\s/g, '').replace(/^\+91/, '').replace(/^0/, '');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      sendJson(400, { error: 'validation_failed' });
      return true;
    }
    const existing = (await repo.getPreordersForUser(user.id)).find((p) => p.product_id === product.id && p.status === 'registered');
    if (existing) {
      sendJson(409, { error: 'already_registered' });
      return true;
    }
    if (product.preorderLimit !== null && await repo.countActivePreorders(product.id) >= product.preorderLimit) {
      sendJson(409, { error: 'registration_limit_reached' });
      return true;
    }
    const preorder = await repo.createOrReactivatePreorder({ productId: product.id, userId: user.id, quantity: body.quantity, name: user.display_name || user.email, phone, altPhone: body.altPhone || null, note: body.note || null });
    sendJson(200, { preorder });
    return true;
  }

  // POST /api/preorders/cancel
  if (url === '/api/preorders/cancel' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const body = JSON.parse(await readBody());
    const owned = (await repo.getPreordersForUser(user.id)).find((p) => p.id === body?.preorderId);
    if (!owned) {
      sendJson(404, { error: 'registration_not_found' });
      return true;
    }
    await repo.cancelPreorder(owned.id, user.id);
    sendJson(200, { success: true });
    return true;
  }

  // GET /api/preorders/mine
  if (url === '/api/preorders/mine' && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    sendJson(200, { preorders: await repo.getPreordersForUser(user.id) });
    return true;
  }

  // GET /api/orders/mine
  if (url === '/api/orders/mine' && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const orders = await repo.getOrdersByUserWithItems(user.id);
    sendJson(200, { orders });
    return true;
  }

  // POST /api/orders/cancel
  if (url === '/api/orders/cancel' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const body = JSON.parse(await readBody());
    const orderId = body?.orderId;
    if (!orderId) {
      sendJson(400, { error: 'validation_failed', details: ['orderId is required'] });
      return true;
    }
    const order = await repo.getOrderForUser(orderId, user.id);
    if (!order) {
      sendJson(404, { error: 'order_not_found' });
      return true;
    }
    if (order.status === 'cancelled') {
      sendJson(409, { error: 'already_cancelled' });
      return true;
    }
    if (order.fulfilment_status !== 'pending' || !(order.status === 'created' || (order.payment_method === 'online' && order.status === 'paid'))) {
      sendJson(409, { error: 'cannot_cancel_in_current_state' });
      return true;
    }
    await repo.cancelOrder(orderId, user.id, body?.reason ?? null);
    sendJson(200, { orderId, status: 'cancelled' });
    return true;
  }

  // POST /api/orders/update-shipping
  if (url === '/api/orders/update-shipping' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const body = JSON.parse(await readBody());
    const { orderId, name, phone, altPhone, address } = body ?? {};
    if (!orderId || !name || !phone || !address) {
      sendJson(400, { error: 'validation_failed', details: ['Missing required fields'] });
      return true;
    }
    const order = await repo.getOrderForUser(orderId, user.id);
    if (!order) {
      sendJson(404, { error: 'order_not_found' });
      return true;
    }
    if (order.fulfilment_status !== 'pending' || !(order.status === 'created' || order.status === 'paid')) {
      sendJson(409, { error: 'cannot_update_in_current_state' });
      return true;
    }
    await repo.updateOrderShipping(orderId, user.id, name, phone, altPhone ?? null, address);
    const deliveryModeRaw = body?.deliveryMode;
    if (deliveryModeRaw !== undefined) {
      const { isDeliveryMode, getDeliveryFeePaise } = await import('@/lib/delivery/config');
      if (!isDeliveryMode(deliveryModeRaw)) {
        sendJson(400, { error: 'invalid_delivery_mode' });
        return true;
      }
      if (order.payment_method !== 'cod') {
        sendJson(409, { error: 'delivery_mode_locked_for_online' });
        return true;
      }
      if (order.status !== 'created') {
        sendJson(409, { error: 'delivery_mode_locked_after_payment' });
        return true;
      }
      const newFee = getDeliveryFeePaise(deliveryModeRaw);
      const itemsTotalPaise = order.total_paise - order.delivery_fee_paise - order.cod_fee_paise;
      const newTotal = itemsTotalPaise + newFee + order.cod_fee_paise;
      await repo.updateOrderDeliveryMode(orderId, user.id, deliveryModeRaw, newFee, newTotal);
    }
    sendJson(200, { orderId, updated: true });
    return true;
  }

  // GET /api/admin/preorders
  if (url.startsWith('/api/admin/preorders') && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'Not authenticated' });
      return true;
    }
    if (!m.isApprovedAdmin(user)) {
      sendJson(403, { error: 'Forbidden' });
      return true;
    }
    const productId = new URL(url, 'http://localhost').searchParams.get('productId') ?? undefined;
    sendJson(200, { preorders: await repo.getAllPreorders(productId) });
    return true;
  }

  // GET /api/admin/orders
  if (url === '/api/admin/orders' && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'Not authenticated' });
      return true;
    }
    if (!m.isApprovedAdmin(user)) {
      sendJson(403, { error: 'Forbidden' });
      return true;
    }
    const orders = await repo.getAllOrdersWithItems();
    sendJson(200, { orders });
    return true;
  }

  // POST /api/admin/order-status
  if (url === '/api/admin/order-status' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'Not authenticated' });
      return true;
    }
    if (!m.isApprovedAdmin(user)) {
      sendJson(403, { error: 'Forbidden' });
      return true;
    }
    const body = JSON.parse(await readBody());
    const { orderId, action } = body ?? {};
    if (!orderId || (action !== 'mark_shipped' && action !== 'mark_delivered')) {
      sendJson(400, { error: 'validation_failed', details: ['orderId and action are required'] });
      return true;
    }
    const order = await repo.getOrderById(orderId);
    if (!order) {
      sendJson(404, { error: 'order_not_found' });
      return true;
    }
    if (action === 'mark_shipped') {
      if (order.fulfilment_status !== 'pending') {
        sendJson(409, { error: 'already_shipped' });
        return true;
      }
      await repo.setFulfilmentStatus(orderId, 'shipped');
      sendJson(200, { orderId, fulfilment_status: 'shipped' });
      return true;
    }
    if (order.fulfilment_status === 'delivered') {
      sendJson(409, { error: 'already_delivered' });
      return true;
    }
    if (order.payment_method === 'cod' && order.status !== 'paid') {
      await repo.markOrderPaymentCollected(orderId);
    }
    await repo.setFulfilmentStatus(orderId, 'delivered');
    await repo.markOrderDelivered(orderId);
    sendJson(200, { orderId, status: 'paid', fulfilment_status: 'delivered' });
    return true;
  }

  // GET /api/account/profile
  if (url === '/api/account/profile' && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const profile = await repo.getProfile(user.id);
    sendJson(200, { user: profile ?? user });
    return true;
  }

  // POST /api/account/profile
  if (url === '/api/account/profile' && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const body = JSON.parse(await readBody());
    const { display_name, phone, alt_phone } = body ?? {};
    await repo.updateProfile(user.id, { display_name, phone, alt_phone });
    const updated = await repo.getProfile(user.id);
    sendJson(200, { user: updated });
    return true;
  }

  // GET /api/account/addresses
  if (url === '/api/account/addresses' && method === 'GET') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const addresses = await repo.listAddresses(user.id);
    sendJson(200, { addresses });
    return true;
  }

  // POST /api/account/addresses (create, edit via ?id=, set default via ?action=default)
  if (url.startsWith('/api/account/addresses') && method === 'POST') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const parsedUrl = new URL(url, 'http://localhost');
    const action = parsedUrl.searchParams.get('action');
    const editId = parsedUrl.searchParams.get('id');
    const body = JSON.parse(await readBody());

    if (action === 'default') {
      const { addressId } = body ?? {};
      if (!addressId) {
        sendJson(400, { error: 'validation_failed', details: ['addressId is required'] });
        return true;
      }
      const existing = (await repo.listAddresses(user.id)).find((a) => a.id === addressId);
      if (!existing) {
        sendJson(404, { error: 'address_not_found' });
        return true;
      }
      await repo.setDefaultAddress(addressId, user.id);
      sendJson(200, { updated: true });
      return true;
    }

    const { label, name, phone, alt_phone, address_line, city, state, pincode, is_default } = body ?? {};
    if (!label || !name || !phone || !address_line || !city || !state || !pincode) {
      sendJson(400, { error: 'validation_failed', details: ['Missing required fields'] });
      return true;
    }

    if (editId) {
      const existing = (await repo.listAddresses(user.id)).find((a) => a.id === editId);
      if (!existing) {
        sendJson(404, { error: 'address_not_found' });
        return true;
      }
      const updated = await repo.updateAddress(editId, user.id, { label, name, phone, alt_phone: alt_phone ?? null, address_line, city, state, pincode, is_default: is_default ?? existing.is_default });
      sendJson(200, { address: updated });
      return true;
    }

    const count = await repo.getAddressCount(user.id);
    if (count >= 5) {
      sendJson(409, { error: 'max_addresses_reached' });
      return true;
    }
    const makeDefault = count === 0 ? true : (is_default ?? false);
    const address = await repo.createAddress(user.id, { label, name, phone, alt_phone: alt_phone ?? null, address_line, city, state, pincode, is_default: makeDefault });
    sendJson(200, { address });
    return true;
  }

  // DELETE /api/account/addresses?id=xxx
  if (url.startsWith('/api/account/addresses?') && method === 'DELETE') {
    if (!user) {
      sendJson(401, { error: 'not_authenticated' });
      return true;
    }
    const parsedUrl = new URL(url, 'http://localhost');
    const addressId = parsedUrl.searchParams.get('id');
    if (!addressId) {
      sendJson(400, { error: 'validation_failed', details: ['Address id is required'] });
      return true;
    }
    const existing = (await repo.listAddresses(user.id)).find((a) => a.id === addressId);
    if (!existing) {
      sendJson(404, { error: 'address_not_found' });
      return true;
    }
    await repo.deleteAddress(addressId, user.id);
    sendJson(200, { deleted: true });
    return true;
  }

  sendJson(404, { error: 'Not found' });
  return true;
}

export function apiMockPlugin(): Plugin {
  return {
    name: 'api-mock-plugin',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handleApiRoute(req, res).catch(() => false);
        if (!handled) next();
      });
    },
  };
}
