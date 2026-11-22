// Normalizes Cloudflare env bindings to the names getRepository expects
// (D1_DATABASE and CATALOG_KV). Older names DB and KV are still accepted.

interface RawEnv {
  DB?: unknown;
  KV?: unknown;
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
  [key: string]: unknown;
}

export function adaptEnv(env: RawEnv): { D1_DATABASE: unknown; CATALOG_KV: unknown } {
  return {
    D1_DATABASE: env.D1_DATABASE ?? env.DB,
    CATALOG_KV: env.CATALOG_KV ?? env.KV,
  };
}
