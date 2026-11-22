import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '@/components/ProductCard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/States';
import { Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Product, User } from '@/lib/types';
import { classNames } from '@/lib/utils';

type SortMode = 'newest' | 'price_low' | 'price_high';

interface ProductsPageProps {
  user?: User | null;
}

export function ProductsPage({ user = null }: ProductsPageProps) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => {
    apiFetch('/api/catalog')
      .then((d) => setProducts(d as Product[]))
      .catch(() => setError('Failed to load products. Please try again.'));
  }, []);

  const filtered = useMemo(() => {
    if (!products) return [];
    let result = [...products];
    if (inStockOnly) result = result.filter((p) => p.stock_status === 'in_stock');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (sort === 'price_low') result.sort((a, b) => a.price_paise - b.price_paise);
    else if (sort === 'price_high') result.sort((a, b) => b.price_paise - a.price_paise);
    else result.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return result;
  }, [products, search, sort, inStockOnly]);

  return (
    <div className="flex min-h-screen flex-col bg-ink-page">
      <Header user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-text">All Products</h1>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-ink-border bg-ink-surface py-2.5 pl-10 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-flame-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 rounded border-ink-border bg-ink-surface text-flame-500 focus:ring-flame-500"
              />
              <span className="text-sm text-text-muted">In stock only</span>
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="rounded-lg border border-ink-border bg-ink-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-flame-500"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {error ? (
          <ErrorState message={error} />
        ) : products === null ? (
          <LoadingSpinner label="Loading products..." />
        ) : filtered.length === 0 ? (
          <EmptyState message={search || inStockOnly ? 'No products match your filters.' : 'No products available yet.'} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
