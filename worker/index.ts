// Cloudflare Worker entry point — routes /api/* to the same handler modules
// used previously by Pages Functions, and serves static assets for everything else.
// Static assets are served via the [assets] binding in wrangler.toml.

import { onRequestGet as catalogGet } from '../functions/api/catalog/index';
import { onRequestGet as authMeGet } from './api/auth/me';
import { onRequestPost as authGooglePost } from './api/auth/google';
import { onRequestPost as authLogoutPost } from './api/auth/logout';
import { onRequestPost as authRequestAdminPost } from './api/auth/request-admin';
import { onRequestPost as emailRequestPost } from './api/auth/email/request';
import { onRequestPost as emailVerifyPost } from './api/auth/email/verify';
import { onRequestGet as accountProfileGet, onRequestPost as accountProfilePost } from './api/account/profile';
import { onRequestGet as accountAddressesGet, onRequestPost as accountAddressesPost, onRequestDelete as accountAddressesDelete } from './api/account/addresses';
import { onRequestGet as adminProductsGet } from './api/admin/products';
import { onRequestGet as adminMutateGet, onRequestPost as adminMutatePost } from './api/admin/mutate';
import { onRequestPost as adminOrderStatusPost } from './api/admin/order-status';
import { onRequestGet as adminOrdersGet } from './api/admin/orders';
import { onRequestGet as adminPreordersGet } from './api/admin/preorders';
import { onRequestGet as adminUsersGet } from './api/admin/users';
import { onRequestPost as checkoutCreateOrderPost } from './api/checkout/create-order';
import { onRequestGet as ordersMineGet } from './api/orders/mine';
import { onRequestPost as ordersCancelPost } from './api/orders/cancel';
import { onRequestPost as ordersUpdateShippingPost } from './api/orders/update-shipping';
import { onRequestGet as preordersMineGet } from './api/preorders/mine';
import { onRequestPost as preordersRegisterPost } from './api/preorders/register';
import { onRequestPost as preordersCancelPost } from './api/preorders/cancel';

type Handler = (ctx: { request: Request; env: Record<string, unknown>; ctx: ExecutionContext }) => Promise<Response> | Response;

interface Route {
  pattern: RegExp;
  methods: { [method: string]: Handler };
}

const routes: Route[] = [
  { pattern: /^\/api\/catalog$/, methods: { GET: catalogGet } },
  { pattern: /^\/api\/auth\/me$/, methods: { GET: authMeGet } },
  { pattern: /^\/api\/auth\/google$/, methods: { POST: authGooglePost } },
  { pattern: /^\/api\/auth\/logout$/, methods: { POST: authLogoutPost } },
  { pattern: /^\/api\/auth\/request-admin$/, methods: { POST: authRequestAdminPost } },
  { pattern: /^\/api\/auth\/email\/request$/, methods: { POST: emailRequestPost } },
  { pattern: /^\/api\/auth\/email\/verify$/, methods: { POST: emailVerifyPost } },
  { pattern: /^\/api\/account\/profile$/, methods: { GET: accountProfileGet, POST: accountProfilePost } },
  { pattern: /^\/api\/account\/addresses$/, methods: { GET: accountAddressesGet, POST: accountAddressesPost, DELETE: accountAddressesDelete } },
  { pattern: /^\/api\/admin\/products$/, methods: { GET: adminProductsGet } },
  { pattern: /^\/api\/admin\/mutate$/, methods: { GET: adminMutateGet, POST: adminMutatePost } },
  { pattern: /^\/api\/admin\/order-status$/, methods: { POST: adminOrderStatusPost } },
  { pattern: /^\/api\/admin\/orders$/, methods: { GET: adminOrdersGet } },
  { pattern: /^\/api\/admin\/preorders$/, methods: { GET: adminPreordersGet } },
  { pattern: /^\/api\/admin\/users$/, methods: { GET: adminUsersGet } },
  { pattern: /^\/api\/checkout\/create-order$/, methods: { POST: checkoutCreateOrderPost } },
  { pattern: /^\/api\/orders\/mine$/, methods: { GET: ordersMineGet } },
  { pattern: /^\/api\/orders\/cancel$/, methods: { POST: ordersCancelPost } },
  { pattern: /^\/api\/orders\/update-shipping$/, methods: { POST: ordersUpdateShippingPost } },
  { pattern: /^\/api\/preorders\/mine$/, methods: { GET: preordersMineGet } },
  { pattern: /^\/api\/preorders\/register$/, methods: { POST: preordersRegisterPost } },
  { pattern: /^\/api\/preorders\/cancel$/, methods: { POST: preordersCancelPost } },
];

function jsonError(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    if (path.startsWith('/api/')) {
      for (const route of routes) {
        if (route.pattern.test(path)) {
          const handler = route.methods[method];
          if (!handler) return jsonError(405, 'method_not_allowed');
          try {
            return await handler({ request, env, ctx });
          } catch (err) {
            console.error(`API error ${method} ${path}:`, err);
            return jsonError(500, 'server_error');
          }
        }
      }
      return jsonError(404, 'not_found');
    }

    // Non-API requests fall through to the assets binding (static site).
    // If ASSETS is available, use it; otherwise return a 404.
    const assets = (env as { ASSETS?: { fetch: (req: Request) => Promise<Response> } }).ASSETS;
    if (assets) {
      return assets.fetch(request);
    }
    return jsonError(404, 'not_found');
  },
};
