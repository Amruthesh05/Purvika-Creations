// GET /api/admin/products — all products for admin panel (also here for backward compat)
// POST /api/admin/mutate — product mutations + admin actions
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest, isApprovedAdmin } from '../../../src/lib/auth/session';
import { handleMutate } from '../../../src/lib/mutate-handler';
import { handleAdminAction } from '../../../src/lib/admin-action-handler';

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
    console.error('admin/mutate GET failed:', err);
    return new Response(JSON.stringify({ error: 'products_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

    const body = await context.request.json();

    if (body.action === 'ADD' || body.action === 'UPDATE' || body.action === 'DELETE' || body.action === 'SET_STATUS') {
      const result = await handleMutate({ repo, user }, body);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await handleAdminAction({ repo, user }, body);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 403,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin/mutate POST failed:', err);
    return new Response(JSON.stringify({ error: 'mutation_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
