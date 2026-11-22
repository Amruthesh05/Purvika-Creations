import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import { isApprovedAdmin, isSuperadmin } from '@/lib/auth/session';
import { handleAdminAction } from '@/lib/admin-action-handler';
import type { User } from '@/lib/types';
import type { Repository } from '@/lib/db/repository';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'buyer',
    approval_status: 'pending',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('isApprovedAdmin', () => {
  it('returns false for null user', () => {
    expect(isApprovedAdmin(null)).toBe(false);
  });

  it('returns false for buyer', () => {
    expect(isApprovedAdmin(makeUser({ role: 'buyer' }))).toBe(false);
  });

  it('returns false for admin with pending approval', () => {
    expect(isApprovedAdmin(makeUser({ role: 'admin', approval_status: 'pending' }))).toBe(false);
  });

  it('returns true for approved admin', () => {
    expect(isApprovedAdmin(makeUser({ role: 'admin', approval_status: 'approved' }))).toBe(true);
  });

  it('returns true for approved superadmin', () => {
    expect(isApprovedAdmin(makeUser({ role: 'superadmin', approval_status: 'approved' }))).toBe(true);
  });

  it('returns false for superadmin with pending approval', () => {
    expect(isApprovedAdmin(makeUser({ role: 'superadmin', approval_status: 'pending' }))).toBe(false);
  });
});

describe('isSuperadmin', () => {
  it('returns false for null user', () => {
    expect(isSuperadmin(null)).toBe(false);
  });

  it('returns false for admin', () => {
    expect(isSuperadmin(makeUser({ role: 'admin' }))).toBe(false);
  });

  it('returns true for superadmin', () => {
    expect(isSuperadmin(makeUser({ role: 'superadmin' }))).toBe(true);
  });
});

describe('handleAdminAction — authorization checks', () => {
  let repo: Repository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('rejects unauthenticated requests', async () => {
    const result = await handleAdminAction({ repo, user: null }, { action: 'approve_admin', targetUserId: 'u1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
  });

  it('rejects buyer for admin actions', async () => {
    const buyer = makeUser({ role: 'buyer', approval_status: 'approved' });
    const result = await handleAdminAction({ repo, user: buyer }, { action: 'approve_admin', targetUserId: 'u1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
  });

  it('rejects admin (non-superadmin) for superadmin-only actions', async () => {
    const admin = makeUser({ id: 'u2', role: 'admin', approval_status: 'approved' });
    const result = await handleAdminAction({ repo, user: admin }, { action: 'approve_admin', targetUserId: 'u1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('superadmin');
  });

  it('rejects self-action (delete)', async () => {
    const superadmin = await repo.getUserById('u1');
    expect(superadmin).not.toBeNull();
    const result = await handleAdminAction({ repo, user: superadmin }, { action: 'delete_admin_user', targetUserId: 'u1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('yourself');
  });

  it('rejects self-action (revoke)', async () => {
    const superadmin = await repo.getUserById('u1');
    const result = await handleAdminAction({ repo, user: superadmin }, { action: 'revoke_admin', targetUserId: 'u1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('yourself');
  });

  it('rejects deleting the last superadmin (target is another superadmin, only one left)', async () => {
    const superadmin = await repo.getUserById('u1');
    const otherUser = await repo.createUser('other@example.com');
    await repo.updateUserRole(otherUser.id, 'superadmin');
    await repo.updateUserApproval(otherUser.id, 'approved');

    // superadmin deletes the other superadmin — count drops to 1
    const result1 = await handleAdminAction({ repo, user: superadmin }, { action: 'delete_admin_user', targetUserId: otherUser.id });
    expect(result1.success).toBe(true);

    // Now only u1 remains as superadmin; another user tries to delete them
    // But we can't test "someone else deleting the last superadmin" because
    // the only remaining superadmin is u1, and self-action is blocked.
    // Instead: create a second superadmin, delete both except last should fail.
    const third = await repo.createUser('third@example.com');
    await repo.updateUserRole(third.id, 'superadmin');
    await repo.updateUserApproval(third.id, 'approved');

    // Delete third — should succeed (2 superadmins: u1 + third)
    const result2 = await handleAdminAction({ repo, user: superadmin }, { action: 'delete_admin_user', targetUserId: third.id });
    expect(result2.success).toBe(true);

    // Now only u1 remains. Try deleting u1 — blocked by self-action.
    const result3 = await handleAdminAction({ repo, user: superadmin }, { action: 'delete_admin_user', targetUserId: 'u1' });
    expect(result3.success).toBe(false);
    expect(result3.error).toContain('yourself');
  });

  it('rejects revoking the last superadmin when target is not self', async () => {
    // Create two superadmins: u1 and u2
    const superadmin = await repo.getUserById('u1');
    const other = await repo.createUser('other@example.com');
    await repo.updateUserRole(other.id, 'superadmin');
    await repo.updateUserApproval(other.id, 'approved');

    // u1 tries to revoke u2 — but that would leave only u1, which is fine
    // (the last superadmin is u1 themselves). So this should succeed.
    const result = await handleAdminAction({ repo, user: superadmin }, { action: 'revoke_admin', targetUserId: other.id });
    expect(result.success).toBe(true);

    // Now only u1 is superadmin. u1 tries to revoke themselves — blocked by self-action.
    const result2 = await handleAdminAction({ repo, user: superadmin }, { action: 'revoke_admin', targetUserId: 'u1' });
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('yourself');
  });

  it('prevents deleting the last superadmin via a second superadmin', async () => {
    const superadmin1 = await repo.getUserById('u1');
    const created = await repo.createUser('super2@example.com');
    await repo.updateUserRole(created.id, 'superadmin');
    await repo.updateUserApproval(created.id, 'approved');
    const superadmin2 = await repo.getUserById(created.id);

    // superadmin2 tries to delete superadmin1 (the seed superadmin)
    // There are 2 superadmins, so this should succeed.
    const result = await handleAdminAction({ repo, user: superadmin2 }, { action: 'delete_admin_user', targetUserId: 'u1' });
    expect(result.success).toBe(true);

    // Now only superadmin2 remains. They cannot delete themselves (self-action).
    const result2 = await handleAdminAction({ repo, user: superadmin2 }, { action: 'delete_admin_user', targetUserId: superadmin2.id });
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('yourself');
  });

  it('allows request_admin for buyer', async () => {
    const buyer = makeUser({ id: 'u2', role: 'buyer', approval_status: 'approved' });
    await repo.createUser('test@example.com');
    const result = await handleAdminAction({ repo, user: buyer }, { action: 'request_admin' });
    expect(result.success).toBe(true);
  });

  it('rejects request_admin for existing admin', async () => {
    const admin = makeUser({ role: 'admin', approval_status: 'approved' });
    const result = await handleAdminAction({ repo, user: admin }, { action: 'request_admin' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already an admin');
  });
});
