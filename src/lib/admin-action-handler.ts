import type { Repository } from './db/repository';
import type { User } from './types';
import { adminActionRequestSchema } from './validation';
import { isApprovedAdmin, isSuperadmin } from './auth/session';

export interface AdminActionContext {
  repo: Repository;
  user: User | null;
}

export interface AdminActionResult {
  success: boolean;
  error?: string;
}

export async function handleAdminAction(ctx: AdminActionContext, body: unknown): Promise<AdminActionResult> {
  const { repo, user } = ctx;

  const parsed = adminActionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const { action, targetUserId } = parsed.data;

  // request_admin: any authenticated user can request — checked before admin gate
  if (action === 'request_admin') {
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.role !== 'buyer') return { success: false, error: 'Already an admin' };
    await repo.updateUserRole(user.id, 'admin');
    return { success: true };
  }

  // All other actions require approved admin/superadmin
  if (!isApprovedAdmin(user)) {
    return { success: false, error: 'Forbidden: admin access required' };
  }

  // All other actions require superadmin
  if (!isSuperadmin(user)) {
    return { success: false, error: 'Forbidden: superadmin access required' };
  }

  if (!targetUserId) {
    return { success: false, error: 'targetUserId is required' };
  }

  // Cannot act on self — user is guaranteed non-null by isSuperadmin check above
  if (targetUserId === user!.id) {
    return { success: false, error: 'Cannot perform this action on yourself' };
  }

  const target = await repo.getUserById(targetUserId);
  if (!target) {
    return { success: false, error: 'User not found' };
  }

  if (action === 'approve_admin') {
    await repo.updateUserApproval(targetUserId, 'approved');
    return { success: true };
  }

  if (action === 'revoke_admin') {
    // Cannot revoke from last superadmin
    if (target.role === 'superadmin') {
      const count = await repo.getSuperadminCount();
      if (count <= 1) {
        return { success: false, error: 'Cannot revoke the last superadmin' };
      }
    }
    await repo.updateUserRole(targetUserId, 'buyer');
    await repo.updateUserApproval(targetUserId, 'approved');
    return { success: true };
  }

  if (action === 'delete_admin_user') {
    if (target.role === 'superadmin') {
      const count = await repo.getSuperadminCount();
      if (count <= 1) {
        return { success: false, error: 'Cannot delete the last superadmin' };
      }
    }
    await repo.deleteUser(targetUserId);
    return { success: true };
  }

  return { success: false, error: 'Unknown action' };
}
