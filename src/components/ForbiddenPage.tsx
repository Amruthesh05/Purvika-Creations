import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-gray-900">Access Denied</h1>
        <p className="mt-2 text-sm text-gray-600">
          You do not have permission to access this page. If you believe this is an error, please contact an administrator.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline transition-colors">
          Return to store
        </Link>
      </div>
    </div>
  );
}
