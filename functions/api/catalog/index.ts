// GET /api/catalog — public catalog, reads KV first, falls back to D1 and rebuilds KV
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';

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
    const data = await repo.getCatalog();

    // If KV was empty/missing, rebuild it from D1
    if (data.source === 'd1') {
      await repo.rebuildKVCacheWithRetry();
    }

    const products = data.products ?? [];
    return new Response(JSON.stringify(products), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('catalog GET failed:', err);
    return new Response(JSON.stringify({ error: 'catalog_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
