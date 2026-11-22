import type { CatalogData, User } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ErrorState, EmptyState } from '@/components/States';

interface CatalogPageProps {
  data: CatalogData | { error: string };
  user?: User | null;
}

export function CatalogPage({ data, user }: CatalogPageProps) {
  if ('error' in data) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <ErrorState message={data.error} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-page">
      <Header user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 hero-parallax">
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Our Catalog</h1>
          <p className="mt-1 text-sm text-text-muted">
            {data.products.length} {data.products.length === 1 ? 'product' : 'products'} available
          </p>
        </div>
        {data.products.length === 0 ? (
          <EmptyState message="No products are available right now. Please check back soon." />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.products.map((product, i) => (
              <div key={product.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
