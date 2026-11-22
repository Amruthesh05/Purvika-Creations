import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from '@/routes/HomePage';
import { CatalogPage } from '@/routes/CatalogPage';
import { ProductsPage } from '@/routes/ProductsPage';
import { LoginPage } from '@/routes/LoginPage';
import { CartPage } from '@/routes/CartPage';
import { CheckoutPage } from '@/routes/CheckoutPage';
import { MyOrdersPage } from '@/routes/MyOrdersPage';
import { AdminCatalogPage } from '@/routes/AdminCatalogPage';
import { AdminUsersPage } from '@/routes/AdminUsersPage';
import { AdminOrdersPage } from '@/routes/AdminOrdersPage';
import { AccountPage } from '@/routes/AccountPage';
import { ProductPage } from '@/routes/ProductPage';
import { LegalPage } from '@/routes/LegalPage';
import { ForbiddenPage } from '@/components/ForbiddenPage';
import { CartProvider } from '@/lib/cart/context';
import { apiFetch } from '@/lib/api';
import type { CatalogData, Product, User } from '@/lib/types';

function useCurrentUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((d) => setUser((d as { user: User | null }).user))
      .catch(() => setUser(null));
  }, []);
  return user;
}

function HomeRoute() {
  const user = useCurrentUser();
  return <HomePage user={user} />;
}

function CatalogWrapper() {
  const user = useCurrentUser();
  const [data, setData] = useState<CatalogData | { error: string } | null>(null);

  useEffect(() => {
    apiFetch('/api/catalog')
      .then((d) => {
        const products = d as Product[];
        setData({ products, source: 'd1' });
      })
      .catch(() => setData({ error: 'Failed to load products. Please try again.' }));
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex min-h-[200px] items-center justify-center">
            <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  return <CatalogPage data={data} user={user} />;
}

function CartWrapper() {
  const user = useCurrentUser();
  const [data, setData] = useState<CatalogData | { error: string } | null>(null);

  useEffect(() => {
    apiFetch('/api/catalog')
      .then((d) => {
        const products = d as Product[];
        setData({ products, source: 'd1' });
      })
      .catch(() => setData({ error: 'Failed to load catalog' }));
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return <CartPage data={data} user={user} />;
}

function MyOrdersRoute() {
  const user = useCurrentUser();
  return <MyOrdersPage user={user} />;
}

function AccountRoute() {
  const user = useCurrentUser();
  return <AccountPage user={user} />;
}

function ProductRoute() {
  const user = useCurrentUser();
  return <ProductPage user={user} />;
}

function ProductsRoute() {
  const user = useCurrentUser();
  return <ProductsPage user={user} />;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'allowed' | 'forbidden'>('loading');

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((d) => {
        const data = d as { user: User | null };
        if (data.user && (data.user.role === 'admin' || data.user.role === 'superadmin') && data.user.approval_status === 'approved') {
          setState('allowed');
        } else {
          setState('forbidden');
        }
      })
      .catch(() => setState('forbidden'));
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (state === 'forbidden') return <ForbiddenPage />;
  return <>{children}</>;
}

function AdminCatalogRoute() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/admin/products') as { products: Product[] };
      setProducts(data.products ?? []);
    } catch {
      setError('Failed to load products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((d) => setCurrentUser((d as { user: User | null }).user))
      .catch(() => setCurrentUser(null));
    loadProducts();
  }, [loadProducts]);

  if (!currentUser) return null;

  return (
    <AdminGuard>
      <AdminCatalogPage
        currentUser={currentUser}
        products={products}
        loading={loading}
        error={error}
        onRefresh={loadProducts}
      />
    </AdminGuard>
  );
}

function AdminUsersRoute() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((d) => setCurrentUser((d as { user: User | null }).user))
      .catch(() => setCurrentUser(null));
  }, []);

  if (!currentUser) return null;
  if (currentUser.role !== 'superadmin') return <Navigate to="/admlogin" replace />;

  return (
    <AdminGuard>
      <AdminUsersPage currentUser={currentUser} />
    </AdminGuard>
  );
}

function AdminOrdersRoute() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((d) => setCurrentUser((d as { user: User | null }).user))
      .catch(() => setCurrentUser(null));
  }, []);

  if (!currentUser) return null;

  return (
    <AdminGuard>
      <AdminOrdersPage currentUser={currentUser} />
    </AdminGuard>
  );
}

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/products" element={<ProductsRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cart" element={<CartWrapper />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/my-orders" element={<MyOrdersRoute />} />
          <Route path="/account" element={<AccountRoute />} />
          <Route path="/product/:id" element={<ProductRoute />} />
          <Route path="/:type(privacy|terms|refunds|brand)" element={<LegalPage />} />
          <Route path="/admlogin" element={<AdminCatalogRoute />} />
          <Route path="/admlogin/users" element={<AdminUsersRoute />} />
          <Route path="/admlogin/orders" element={<AdminOrdersRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}
