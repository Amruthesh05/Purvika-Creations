import type { Repository } from '../db/repository';
import type { User } from '../types';
import { parseCookies, getSessionCookieName, hashSessionId } from './cookie';

export function isApprovedAdmin(user: User | null): boolean {
  if (!user) return false;
  if (user.approval_status !== 'approved') return false;
  return user.role === 'admin' || user.role === 'superadmin';
}

export function isSuperadmin(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'superadmin';
}

export async function getUserFromRequest(
  repo: Repository,
  cookieHeader: string | null,
): Promise<User | null> {
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[getSessionCookieName()];
  if (!sessionId) return null;
  const sessionHash = await hashSessionId(sessionId);
  const session = await repo.getSessionByHash(sessionHash);
  if (!session) return null;
  const user = await repo.getUserById(session.user_id);
  if (!user) return null;
  // Re-check role/approval_status in D1 on every request
  return user;
}

export async function findOrCreateUser(
  repo: Repository,
  email: string,
  superadminEmail?: string,
): Promise<User> {
  const existing = await repo.getUserByEmail(email);
  if (existing) {
    // If email matches superadmin env var, ensure role is correct
    if (superadminEmail && email.toLowerCase() === superadminEmail.toLowerCase()) {
      if (existing.role !== 'superadmin' || existing.approval_status !== 'approved') {
        await repo.updateUserRole(existing.id, 'superadmin');
        await repo.updateUserApproval(existing.id, 'approved');
        return { ...existing, role: 'superadmin', approval_status: 'approved' };
      }
    }
    return existing;
  }
  const user = await repo.createUser(email);
  if (superadminEmail && email.toLowerCase() === superadminEmail.toLowerCase()) {
    await repo.updateUserRole(user.id, 'superadmin');
    await repo.updateUserApproval(user.id, 'approved');
    return { ...user, role: 'superadmin', approval_status: 'approved' };
  }
  return user;
}
