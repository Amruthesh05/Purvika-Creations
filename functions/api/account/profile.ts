// GET/POST /api/account/profile — user profile
import { getRepository } from '../../../src/lib/db/index';
import { adaptEnv } from '../../../src/lib/env';
import { getUserFromRequest } from '../../../src/lib/auth/session';
import { profileInputSchema } from '../../../src/lib/validation';

interface Env {
  DB?: unknown;
  KV?: unknown;
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  [key: string]: unknown;
}

const sendJson = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const repo = getRepository(adaptEnv(context.env));
    const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
    if (!user) return sendJson(401, { error: 'not_authenticated' });
    const profile = await repo.getProfile(user.id);
    if (!profile) return sendJson(404, { error: 'profile_not_found' });
    return sendJson(200, { user: profile });
  } catch (err) {
    console.error('account/profile GET failed:', err);
    return sendJson(500, { error: 'profile_fetch_failed' });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const repo = getRepository(adaptEnv(context.env));
    const user = await getUserFromRequest(repo, context.request.headers.get('Cookie'));
    if (!user) return sendJson(401, { error: 'not_authenticated' });
    let body: unknown;
    try {
      body = await context.request.json();
    } catch {
      return sendJson(400, { error: 'invalid_body' });
    }
    const parsed = profileInputSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(400, { error: 'validation_failed', details: parsed.error.issues.map((i) => i.message) });
    }
    await repo.updateProfile(user.id, parsed.data);
    const updated = await repo.getProfile(user.id);
    return sendJson(200, { user: updated });
  } catch (err) {
    console.error('account/profile POST failed:', err);
    return sendJson(500, { error: 'profile_update_failed' });
  }
};
