import type { Repository } from './repository';
import { MockRepository } from './mock-repository';
import { D1KVRepository } from './d1kv-repository';

let mockInstance: MockRepository | null = null;

interface CloudflareEnv {
  D1_DATABASE?: unknown;
  CATALOG_KV?: unknown;
}

function hasD1Bindings(env: CloudflareEnv): boolean {
  return !!(env.D1_DATABASE && env.CATALOG_KV);
}

export function getRepository(env?: CloudflareEnv): Repository {
  if (env && hasD1Bindings(env)) {
    return new D1KVRepository(env.D1_DATABASE as never, env.CATALOG_KV as never);
  }
  if (!import.meta.env?.DEV) {
    throw new Error('No D1/KV bindings available and not in dev mode. Ensure D1 and KV bindings are configured in wrangler.toml.');
  }
  if (!mockInstance) {
    mockInstance = new MockRepository();
  }
  return mockInstance;
}

export function resetMockRepository(): void {
  mockInstance = null;
}

export type { Repository };
