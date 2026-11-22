import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, AlertTriangle } from 'lucide-react';
import type { CatalogData, User } from '@/lib/types';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ErrorState, EmptyState } from '@/components/States';
import { formatINR, classNames } from '@/lib/utils';
import { savingsPaise } from '@/lib/pricing';
import { PriceTag } from '@/components/PriceTag';
import { CustomPrintNotice } from '@/components/CustomPrintNotice';
import { useCartWithCatalog } from '@/lib/cart/context';

interface CartPageProps {
  data: CatalogData | { error: string };
  user?: User | null;
}

export function CartPage({ data, user }: CartPageProps) {
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

  const { enriched, subtotalPaise, setQuantity, removeItem } = useCartWithCatalog(data.products);
  const totalSavingsPaise = enriched.reduce(
    (sum, { product, quantity }) => sum + savingsPaise(product.price_paise, product.mrpPaise, quantity),
    0,
  );
  const hasBlockingIssue = enriched.some((i) => i.outOfStock || i.variantMissing || i.variantGone);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">Your Cart</h1>

        {enriched.length === 0 ? (
          <EmptyState message="Your cart is empty. Browse the catalog to add items." />
        ) : (
          <div className="space-y-4">
            {enriched.map(({ product, quantity, outOfStock, variant, needsVariant, variantMissing, variantGone, variantId }) => (
              <div
                key={variantId ? `${product.id}-${variantId}` : product.id}
                className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                  className="h-20 w-20 flex-shrink-0 rounded-xl object-cover"
                />
                <div className="flex flex-1 flex-col">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{product.name}</h3>
                      {needsVariant && variant && (
                        <p className="mt-0.5 text-xs text-gray-500">{product.variantLabel || 'Size'}: {variant.label}</p>
                      )}
                      <div className="mt-0.5"><PriceTag pricePaise={product.price_paise} mrpPaise={product.mrpPaise} /></div>
                      {variantMissing && (
                        <Link to={`/product/${product.id}`} className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> Choose a {product.variantLabel || 'size'}
                        </Link>
                      )}
                      {variantGone && (
                        <Link to={`/product/${product.id}`} className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" /> This size is no longer available — choose another
                        </Link>
                      )}
                      {outOfStock && !variantMissing && !variantGone && (
                        <span className="mt-1 inline-block rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          Out of stock — cannot checkout
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(product.id, variantId)}
                      className="text-gray-400 transition-colors hover:text-red-600"
                      aria-label={`Remove ${product.name} from cart`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(product.id, quantity - 1, variantId)}
                      disabled={quantity <= 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-gray-900">{quantity}</span>
                    <button
                      onClick={() => setQuantity(product.id, quantity + 1, variantId)}
                      disabled={quantity >= 10}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {totalSavingsPaise > 0 && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <span className="text-sm font-medium text-emerald-700">You save</span>
                <span className="text-sm font-bold text-emerald-700">{formatINR(totalSavingsPaise)}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <span className="text-sm font-medium text-gray-700">Subtotal</span>
              <span className="text-xl font-bold text-gray-900">{formatINR(subtotalPaise)}</span>
            </div>

            <CustomPrintNotice />

            {hasBlockingIssue && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Some items need your attention before you can checkout.
              </div>
            )}
            <Link
              to="/checkout"
              className={classNames(
                'flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors',
                hasBlockingIssue
                  ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700',
              )}
              onClick={(e) => hasBlockingIssue && e.preventDefault()}
            >
              <ShoppingBag className="h-4 w-4" />
              Proceed to checkout
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
