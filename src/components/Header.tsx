import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, X, ChevronDown, LogOut, Package, User as UserIcon } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { classNames } from '@/lib/utils';
import { useCart } from '@/lib/cart/context';
import type { User } from '@/lib/types';

interface HeaderProps {
  isAdmin?: boolean;
  user?: User | null;
}

export function Header({ isAdmin = false, user = null }: HeaderProps) {
  const { itemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountMenuOpen]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    navigate('/');
    window.location.reload();
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    classNames(
      'text-sm font-medium transition-colors',
      isActive(path) ? 'text-flame-400' : 'text-text-muted hover:text-flame-300',
    );

  return (
    <header className="sticky top-0 z-40 bg-ink-page/95 backdrop-blur border-b border-ink-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-text">
            <Logo height={30} tone="light" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/" className={navLinkClass('/')}>Home</Link>
            <Link to="/products" className={navLinkClass('/products')}>Products</Link>
            <Link to="/cart" className={classNames('relative transition-colors', isActive('/cart') ? 'text-flame-400' : 'text-text-muted hover:text-flame-300')}>
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-flame-500 px-1 text-xs font-semibold text-[#1B2A4A]">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <div ref={accountRef} className="relative">
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-flame-300 transition-colors"
                >
                  <span className="max-w-[140px] truncate">{user.display_name || user.email}</span>
                  <ChevronDown className={classNames('h-4 w-4 transition-transform', accountMenuOpen && 'rotate-180')} />
                </button>
                {accountMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-ink-border bg-ink-raised shadow-xl py-1">
                    <Link to="/account" className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted hover:text-flame-300 hover:bg-ink-surface transition-colors">
                      <UserIcon className="h-4 w-4" />
                      Account
                    </Link>
                    <Link to="/my-orders" className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted hover:text-flame-300 hover:bg-ink-surface transition-colors">
                      <Package className="h-4 w-4" />
                      My orders
                    </Link>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text-muted hover:text-flame-300 hover:bg-ink-surface transition-colors">
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className={navLinkClass('/login')}>Login</Link>
            )}

            {isAdmin && (
              <span className="rounded-full bg-flame-500 px-3 py-1 text-xs font-medium text-[#1B2A4A]">
                Admin
              </span>
            )}
          </nav>

          {/* Mobile: cart + hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            <Link to="/cart" className={classNames('relative transition-colors', isActive('/cart') ? 'text-flame-400' : 'text-text-muted')}>
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-flame-500 px-1 text-xs font-semibold text-[#1B2A4A]">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="text-text-muted p-1" aria-label="Toggle menu">
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile slide-down panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-ink-border bg-ink-surface">
          <nav className="mx-auto max-w-7xl px-4 py-4 space-y-3">
            <Link to="/" className={classNames('block text-sm font-medium py-2', isActive('/') ? 'text-flame-400' : 'text-text-muted')}>Home</Link>
            <Link to="/products" className={classNames('block text-sm font-medium py-2', isActive('/products') ? 'text-flame-400' : 'text-text-muted')}>Products</Link>
            {user ? (
              <>
                <Link to="/account" className={classNames('block text-sm font-medium py-2', isActive('/account') ? 'text-flame-400' : 'text-text-muted')}>Account</Link>
                <Link to="/my-orders" className={classNames('block text-sm font-medium py-2', isActive('/my-orders') ? 'text-flame-400' : 'text-text-muted')}>My orders</Link>
                <button onClick={handleLogout} className="block w-full text-left text-sm font-medium py-2 text-text-muted">Log out</button>
              </>
            ) : (
              <Link to="/login" className={classNames('block text-sm font-medium py-2', isActive('/login') ? 'text-flame-400' : 'text-text-muted')}>Login</Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
