// GET /api/admin/products — all products for admin panel (dedicated route)
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const repo = getRepository(adaptEnv(context.env));
    const cookieHeader = context.request.headers.get('Cookie');
    const user = await getUserFromRequest(repo, cookieHeader);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isApprovedAdmin(user)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const products = await repo.getAllProducts();
    return new Response(JSON.stringify({ products }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin/products GET failed:', err);
    return new Response(JSON.stringify({ error: 'products_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
