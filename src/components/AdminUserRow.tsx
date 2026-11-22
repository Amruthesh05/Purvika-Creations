import type { User } from '@/lib/types';
import { formatDate, classNames } from '@/lib/utils';
import { ShieldCheck, ShieldX, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/Button';

interface AdminUserRowProps {
  user: User;
  currentUser: User;
  superadminCount: number;
  onApprove: (user: User) => void;
  onRevoke: (user: User) => void;
  onDelete: (user: User) => void;
}

export function AdminUserRow({
  user,
  currentUser,
  superadminCount,
  onApprove,
  onRevoke,
  onDelete,
}: AdminUserRowProps) {
  const isSelf = user.id === currentUser.id;
  const isLastSuperadmin = user.role === 'superadmin' && superadminCount <= 1;

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4 text-sm font-medium text-gray-900">{user.email}</td>
      <td className="py-3 px-4">
        <span className={classNames(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          user.role === 'superadmin' ? 'bg-blue-50 text-blue-700' : user.role === 'admin' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600',
        )}>
          {user.role}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className={classNames(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          user.approval_status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
        )}>
          {user.approval_status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">{formatDate(user.created_at)}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {user.approval_status === 'pending' && (
            <Button variant="secondary" onClick={() => onApprove(user)} className="px-3 py-1.5 text-xs" disabled={isSelf}>
              <UserCheck className="h-3.5 w-3.5" />
              Approve
            </Button>
          )}
          {user.role === 'admin' && (
            <Button variant="secondary" onClick={() => onRevoke(user)} className="px-3 py-1.5 text-xs" disabled={isSelf}>
              <ShieldX className="h-3.5 w-3.5" />
              Revoke
            </Button>
          )}
          {user.role === 'superadmin' && (
            <Button variant="secondary" onClick={() => onRevoke(user)} className="px-3 py-1.5 text-xs" disabled={isSelf || isLastSuperadmin}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Demote
            </Button>
          )}
          <Button variant="danger" onClick={() => onDelete(user)} className="px-3 py-1.5 text-xs" disabled={isSelf || isLastSuperadmin}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
