import { useState, type ReactNode } from 'react';
import { Package, Users, LogOut, LayoutGrid, ShoppingBag } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { classNames } from '@/lib/utils';
import type { User } from '@/lib/types';

interface AdminLayoutProps {
  children: ReactNode;
  currentUser: User;
}

const tabs = [
  { path: '/admlogin', label: 'Catalog', icon: Package },
  { path: '/admlogin/users', label: 'Authorization', icon: Users, superadminOnly: true },
  { path: '/admlogin/orders', label: 'Orders', icon: ShoppingBag },
] as const;

export function AdminLayout({ children, currentUser }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-sm font-semibold text-gray-900">Admin Panel</span>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-600 p-2" aria-label="Toggle menu">
            <LayoutGrid className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={classNames(
          'fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-200 bg-white transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}>
          <div className="flex h-full flex-col">
            <div className="border-b border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6 text-blue-600" />
                <span className="font-semibold text-gray-900">Admin Panel</span>
              </div>
              <p className="mt-2 truncate text-xs text-gray-500">{currentUser.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {currentUser.role}
              </span>
            </div>
            <nav className="flex-1 space-y-1 p-3">
              {tabs.filter((tab) => !tab.superadminOnly || currentUser.role === 'superadmin').map(({ path, label, icon: Icon }) => {
                const active = location.pathname === path;
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setSidebarOpen(false)}
                    className={classNames(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-gray-200 p-3">
              <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <LayoutGrid className="h-4 w-4" />
                View Store
              </Link>
              <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 lg:ml-0">
          <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
