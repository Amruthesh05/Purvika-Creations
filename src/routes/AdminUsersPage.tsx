import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminUserRow } from '@/components/AdminUserRow';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/Button';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import { useToasts, ToastContainer } from '@/components/Toast';
import { ShieldCheck, ShieldX, Trash2, UserCog } from 'lucide-react';

interface AdminUsersPageProps {
  currentUser: User;
}

interface AdminActionRequest {
  action: 'approve_admin' | 'revoke_admin' | 'delete_admin_user' | 'request_admin';
  targetUserId?: string;
}

export function AdminUsersPage({ currentUser }: AdminUsersPageProps) {
  const { toasts, addToast, dismissToast } = useToasts();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [superadminCount, setSuperadminCount] = useState(0);
  const [actionTarget, setActionTarget] = useState<{ user: User; action: AdminActionRequest['action'] } | null>(null);
  const [mutationLoading, setMutationLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users);
      setSuperadminCount(data.superadminCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const callAdminAction = async (req: AdminActionRequest) => {
    const res = await fetch('/api/admin/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(data.error || 'Action failed');
    }
    return res.json();
  };

  const handleConfirmAction = async () => {
    if (!actionTarget) return;
    setMutationLoading(true);
    try {
      await callAdminAction({ action: actionTarget.action, targetUserId: actionTarget.user.id });
      const labels: Record<string, string> = {
        approve_admin: 'Admin approved successfully',
        revoke_admin: 'Admin revoked successfully',
        delete_admin_user: 'User deleted successfully',
      };
      addToast(labels[actionTarget.action] || 'Action completed');
      setActionTarget(null);
      loadUsers();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setMutationLoading(false);
    }
  };

  const isSuperadmin = currentUser.role === 'superadmin';
  const pendingRequests = users.filter((u) => u.approval_status === 'pending' && u.role !== 'buyer');

  if (loading) {
    return (
      <AdminLayout currentUser={currentUser}>
        <LoadingSpinner label="Loading users..." />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout currentUser={currentUser}>
        <ErrorState message={error}>
          <Button onClick={loadUsers}>Try again</Button>
        </ErrorState>
      </AdminLayout>
    );
  }

  const confirmLabels: Record<string, { title: string; message: string; label: string }> = {
    approve_admin: { title: 'Approve Admin', message: `Grant admin privileges to ${actionTarget?.user.email}?`, label: 'Approve' },
    revoke_admin: { title: 'Revoke Admin', message: `Remove admin privileges from ${actionTarget?.user.email}?`, label: 'Revoke' },
    delete_admin_user: { title: 'Delete User', message: `Permanently delete ${actionTarget?.user.email}? This cannot be undone.`, label: 'Delete' },
  };

  const currentConfirm = actionTarget ? confirmLabels[actionTarget.action] : null;

  return (
    <AdminLayout currentUser={currentUser}>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Authorization Panel</h1>
        <p className="mt-1 text-sm text-gray-500">Manage admin access and user permissions</p>
      </div>

      {/* Pending requests section */}
      {pendingRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
            <UserCog className="h-4 w-4" />
            Pending Admin Requests ({pendingRequests.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/50">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-amber-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-amber-700">Email</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-amber-700">Requested</th>
                    <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-amber-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((u) => (
                    <tr key={u.id} className="border-b border-amber-100">
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{u.email}</td>
                      <td className="py-3 px-4 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 px-4">
                        {isSuperadmin && (
                          <Button variant="secondary" onClick={() => setActionTarget({ user: u, action: 'approve_admin' })} className="px-3 py-1.5 text-xs">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* All users table */}
      <h2 className="mb-3 text-sm font-semibold text-gray-700">All Users</h2>
      {users.length === 0 ? (
        <EmptyState message="No users found." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Joined</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <AdminUserRow
                    key={u.id}
                    user={u}
                    currentUser={currentUser}
                    superadminCount={superadminCount}
                    onApprove={(user) => setActionTarget({ user, action: 'approve_admin' })}
                    onRevoke={(user) => setActionTarget({ user, action: 'revoke_admin' })}
                    onDelete={(user) => setActionTarget({ user, action: 'delete_admin_user' })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isSuperadmin && (
        <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-500">
          Only superadmins can approve, revoke, or delete admin users.
        </p>
      )}

      {/* Confirmation dialog */}
      {currentConfirm && (
        <ConfirmDialog
          open={!!actionTarget}
          title={currentConfirm.title}
          message={currentConfirm.message}
          confirmLabel={currentConfirm.label}
          variant={actionTarget?.action === 'delete_admin_user' ? 'danger' : 'primary'}
          onConfirm={handleConfirmAction}
          onCancel={() => setActionTarget(null)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AdminLayout>
  );
}
