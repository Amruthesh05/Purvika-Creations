// GET/POST/PUT/DELETE /api/account/addresses — saved addresses
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { addressInputSchema } from '../../../src/lib/validation';

interface Env {
  DB?: unknown;
  KV?: unknown;
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  [key: string]: unknown;
}

const sendJson = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function getOwnedAddress(repo: ReturnType<typeof getRepository>, addressId: string, userId: string) {
  const list = await repo.listAddresses(userId);
  return list.find((a) => a.id === addressId) ?? null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const repo = getRepository(adaptEnv(context.env));
    const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
    if (!user) return sendJson(401, { error: 'not_authenticated' });
    const addresses = await repo.listAddresses(user.id);
    return sendJson(200, { addresses });
  } catch (err) {
    console.error('account/addresses GET failed:', err);
    return sendJson(500, { error: 'addresses_fetch_failed' });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const repo = getRepository(adaptEnv(context.env));
    const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
    if (!user) return sendJson(401, { error: 'not_authenticated' });
    const count = await repo.getAddressCount(user.id);
    const url = new URL(context.request.url);
    const action = url.searchParams.get('action');

    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return sendJson(400, { error: 'invalid_body' });
    }

    // Set default action: POST /api/account/addresses?action=default
    if (action === 'default') {
      const addressId = (body as { addressId?: string })?.addressId;
      if (!addressId) return sendJson(400, { error: 'validation_failed', details: ['addressId is required'] });
      const existing = await getOwnedAddress(repo, addressId, user.id);
      if (!existing) return sendJson(404, { error: 'address_not_found' });
      await repo.setDefaultAddress(addressId, user.id);
      return sendJson(200, { updated: true });
    }

    // Edit existing: POST /api/account/addresses?id=xxx
    const editId = url.searchParams.get('id');
    if (editId) {
      const parsed = addressInputSchema.safeParse(body);
      if (!parsed.success) return sendJson(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
      const existing = await getOwnedAddress(repo, editId, user.id);
      if (!existing) return sendJson(404, { error: 'address_not_found' });
      const address = await repo.updateAddress(editId, user.id, parsed.data);
      return sendJson(200, { address });
    }

    // Create new
    if (count >= 5) return sendJson(409, { error: 'max_addresses_reached' });
    const parsed = addressInputSchema.safeParse(body);
    if (!parsed.success) return sendJson(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
    // First address becomes default automatically
    if (count === 0 && parsed.data.is_default === undefined) {
      parsed.data.is_default = true;
    }
    const address = await repo.createAddress(user.id, parsed.data);
    return sendJson(200, { address });
  } catch (err) {
    console.error('account/addresses POST failed:', err);
    return sendJson(500, { error: 'address_save_failed' });
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  try {
    const repo = getRepository(adaptEnv(context.env));
    const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
    if (!user) return sendJson(401, { error: 'not_authenticated' });
    const url = new URL(context.request.url);
    const addressId = url.searchParams.get('id');
    if (!addressId) return sendJson(400, { error: 'validation_failed', details: ['Address id is required'] });
    const existing = await getOwnedAddress(repo, addressId, user.id);
    if (!existing) return sendJson(404, { error: 'address_not_found' });
    await repo.deleteAddress(addressId, user.id);
    return sendJson(200, { deleted: true });
  } catch (err) {
    console.error('account/addresses DELETE failed:', err);
    return sendJson(500, { error: 'address_delete_failed' });
  }
};
