import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import { getUserFromRequest } from '@/lib/auth/session';
import { generateSessionId, hashSessionId, getSessionExpiry, buildSessionCookieHeader, parseCookies, getSessionCookieName } from '@/lib/auth/cookie';
import type { Repository } from '@/lib/db/repository';

describe('session lookup via cookie', () => {
  let repo: Repository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('returns the user for a valid session cookie', async () => {
    const user = await repo.getUserById('u1');
    expect(user).not.toBeNull();

    const rawId = generateSessionId();
    const sessionHash = await hashSessionId(rawId);
    const expiresAt = getSessionExpiry();
    await repo.createSession(sessionHash, user!.id, expiresAt);

    const cookieHeader = buildSessionCookieHeader(rawId, new Date(expiresAt));
    const fetched = await getUserFromRequest(repo, cookieHeader);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe('u1');
    expect(fetched!.email).toBe(user!.email);
  });

  it('returns null when no cookie header is provided', async () => {
    const result = await getUserFromRequest(repo, null);
    expect(result).toBeNull();
  });

  it('returns null when the session cookie is missing', async () => {
    const result = await getUserFromRequest(repo, 'other_cookie=value');
    expect(result).toBeNull();
  });

  it('returns null for an unknown session hash', async () => {
    const rawId = generateSessionId();
    const cookieHeader = buildSessionCookieHeader(rawId, new Date(Date.now() + 3600000));
    const result = await getUserFromRequest(repo, cookieHeader);
    expect(result).toBeNull();
  });

  it('returns null for an expired session', async () => {
    const user = await repo.getUserById('u1');
    const rawId = generateSessionId();
    const sessionHash = await hashSessionId(rawId);
    // Create a session that expired 1 second ago
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    await repo.createSession(sessionHash, user!.id, pastExpiry);

    const cookieHeader = buildSessionCookieHeader(rawId, new Date(pastExpiry));
    const result = await getUserFromRequest(repo, cookieHeader);
    expect(result).toBeNull();
  });

  it('returns null when the user has been deleted', async () => {
    const user = await repo.createUser('temp@example.com');
    const rawId = generateSessionId();
    const sessionHash = await hashSessionId(rawId);
    await repo.createSession(sessionHash, user.id, getSessionExpiry());

    await repo.deleteUser(user.id);

    const cookieHeader = buildSessionCookieHeader(rawId, new Date(Date.now() + 3600000));
    const result = await getUserFromRequest(repo, cookieHeader);
    expect(result).toBeNull();
  });

  it('parseCookies extracts the sid cookie correctly', () => {
    const cookies = parseCookies('foo=bar; sid=abc123; baz=qux');
    expect(cookies['sid']).toBe('abc123');
    expect(cookies['foo']).toBe('bar');
  });

  it('getSessionCookieName returns "sid"', () => {
    expect(getSessionCookieName()).toBe('sid');
  });

  it('hashSessionId produces a deterministic 64-char hex string', async () => {
    const id = 'test-session-id';
    const hash1 = await hashSessionId(id);
    const hash2 = await hashSessionId(id);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateSessionId produces a 64-char hex string', () => {
    const id = generateSessionId();
    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });
});
