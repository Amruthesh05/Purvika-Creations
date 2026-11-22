import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CircleCheck as CheckCircle2, Circle as XCircle, Plus, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import type { Product, User } from '@/lib/types';
import { classNames } from '@/lib/utils';
import { useCart } from '@/lib/cart/context';
import { Header } from '@/components/Header';
import { PLACEHOLDER_IMAGE } from '@/lib/products/config';
import { apiFetch } from '@/lib/api';
import { PreorderForm } from '@/components/PreorderForm';
import { PriceTag } from '@/components/PriceTag';
import { CustomPrintNotice } from '@/components/CustomPrintNotice';

interface ProductPageProps {
  user: User | null | undefined;
}

export function ProductPage({ user }: ProductPageProps) {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgSrc, setImgSrc] = useState('');
  const { addItem } = useCart();
  const touchStartX = useRef<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  useEffect(() => {
    setProduct(undefined);
    setCurrentIndex(0);
    setSelectedVariantId(null);
    apiFetch('/api/catalog')
      .then((data) => {
        const products = data as Product[];
        const found = products.find((p) => p.id === id) ?? null;
        setProduct(found);
        if (found) {
          const imgs = found.imageUrls.length > 0 ? found.imageUrls : [found.image_url];
          setImgSrc(imgs[0]);
        }
      })
      .catch(() => setProduct(null));
  }, [id]);

  const images = product
    ? product.imageUrls.length > 0
      ? product.imageUrls
      : [product.image_url]
    : [];

  const goTo = useCallback(
    (index: number) => {
      if (images.length === 0) return;
      const next = ((index % images.length) + images.length) % images.length;
      setCurrentIndex(next);
      setImgSrc(images[next]);
    },
    [images],
  );

  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);

  useEffect(() => {
    if (!product) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [product, goPrev, goNext]);

  if (product === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header user={user} />
        <div className="flex flex-1 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header user={user} />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
            <p className="mt-2 text-sm text-gray-500">This product may have been removed or is no longer available.</p>
            <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inStock = product.stock_status === 'in_stock';
  const isPreorder = product.saleMode !== 'buy';
  const hasVariants = product.variants && product.variants.length > 0;
  const allVariantsSoldOut = hasVariants && product.variants.every((v) => !v.in_stock);
  const selectedVariant = hasVariants ? product.variants.find((v) => v.id === selectedVariantId) ?? null : null;
  const canAddToCart = hasVariants ? !!selectedVariant && selectedVariant.in_stock : inStock;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header user={user} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Gallery */}
          <div className="space-y-4">
            <div
              className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-white"
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                if (Math.abs(dx) > 40) {
                  if (dx > 0) goPrev();
                  else goNext();
                }
                touchStartX.current = null;
              }}
            >
              <img
                src={imgSrc}
                alt={product.name}
                className="h-full w-full object-cover"
                onError={() => setImgSrc(PLACEHOLDER_IMAGE)}
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md hover:bg-white transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                  </button>
                  <button
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow-md hover:bg-white transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-700" />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={classNames(
                      'h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-all',
                      i === currentIndex ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300',
                    )}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={url} alt={`${product.name} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{product.name}</h1>
              <div className="mt-3"><PriceTag pricePaise={product.price_paise} mrpPaise={product.mrpPaise} size="lg" /></div>
            </div>

            <div>
              <span
                className={classNames(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
                  inStock ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
                )}
              >
                {inStock ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            <CustomPrintNotice />

            <div>
              <h2 className="text-sm font-semibold text-gray-900">Description</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{product.description}</p>
            </div>

            {isPreorder ? <PreorderForm product={product} user={user} /> : <>
              {hasVariants && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{product.variantLabel || 'Size'}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.variants.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => v.in_stock && setSelectedVariantId(v.id)}
                        disabled={!v.in_stock}
                        className={classNames(
                          'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                          selectedVariantId === v.id
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : v.in_stock
                              ? 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                              : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 line-through',
                        )}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => addItem(product.id, selectedVariantId ?? undefined)}
                disabled={!canAddToCart}
                className={classNames(
                  'flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors',
                  canAddToCart
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed bg-gray-100 text-gray-400',
                )}
              >
                <Plus className="h-5 w-5" />
                {allVariantsSoldOut ? 'Sold out' : hasVariants && !selectedVariant ? `Select a ${product.variantLabel || 'size'}` : 'Add to cart'}
              </button>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
