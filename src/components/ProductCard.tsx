import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react';
import type { Product } from '@/lib/types';
import { classNames } from '@/lib/utils';
import { useCart } from '@/lib/cart/context';
import { PLACEHOLDER_IMAGE } from '@/lib/products/config';
import { TiltCard } from '@/components/TiltCard';
import { PriceTag } from '@/components/PriceTag';

export function ProductCard({ product }: { product: Product }) {
  const inStock = product.stock_status === 'in_stock';
  const { addItem } = useCart();
  const [imgSrc, setImgSrc] = useState(product.imageUrls[0] ?? product.image_url);
  const preorder = product.saleMode !== 'buy';
  return (
    <TiltCard className="surface-card overflow-hidden">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl">
        <Link to={`/product/${product.id}`} className="relative aspect-square overflow-hidden bg-ink-surface">
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgSrc(PLACEHOLDER_IMAGE)}
          />
          <div className="absolute right-3 top-3">
            <span
              className={classNames(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur',
                preorder
                  ? 'bg-ink-page/80 text-text'
                  : inStock
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
              )}
            >
              {preorder
                ? product.saleMode === 'preorder'
                  ? 'Registrations open'
                  : 'Registrations closed'
                : inStock
                  ? (<><CheckCircle2 className="h-3 w-3" />In Stock</>)
                  : (<><XCircle className="h-3 w-3" />Out of Stock</>)}
            </span>
          </div>
        </Link>
        <div className="flex flex-1 flex-col p-4" style={{ transform: 'translateZ(40px)' }}>
          <Link to={`/product/${product.id}`}>
            <h3 className="line-clamp-2 text-sm font-semibold text-text hover:text-flame-300">{product.name}</h3>
          </Link>
          <p className="mt-1 line-clamp-2 flex-1 text-xs text-text-muted">{product.description}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <PriceTag pricePaise={product.price_paise} mrpPaise={product.mrpPaise} />
            {preorder ? (
              <Link
                to={`/product/${product.id}`}
                className="rounded-lg bg-flame-500 px-3 py-2 text-xs font-medium text-[#141416] shadow-[0_3px_0_#c63d06] transition-all hover:bg-flame-400 active:translate-y-0.5 active:shadow-[0_1px_0_#c63d06]"
              >
                {product.saleMode === 'preorder' ? 'Register for free' : 'Closed'}
              </Link>
            ) : product.variants && product.variants.length > 0 ? (
              <Link
                to={`/product/${product.id}`}
                className={classNames(
                  'rounded-lg px-3 py-2 text-xs font-medium transition-all',
                  product.variants.every((v) => !v.in_stock)
                    ? 'cursor-not-allowed bg-ink-surface text-text-muted'
                    : 'bg-flame-500 text-[#141416] shadow-[0_3px_0_#c63d06] hover:bg-flame-400 active:translate-y-0.5 active:shadow-[0_1px_0_#c63d06]',
                )}
              >
                {product.variants.every((v) => !v.in_stock) ? 'Sold out' : 'Choose size'}
              </Link>
            ) : (
              <button
                onClick={() => addItem(product.id)}
                disabled={!inStock}
                className={classNames(
                  'rounded-lg px-3 py-2 text-xs font-medium transition-all',
                  inStock
                    ? 'bg-flame-500 text-[#141416] shadow-[0_3px_0_#c63d06] hover:bg-flame-400 active:translate-y-0.5 active:shadow-[0_1px_0_#c63d06]'
                    : 'cursor-not-allowed bg-ink-surface text-text-muted',
                )}
              >
                Add to cart
              </button>
            )}
          </div>
        </div>
      </article>
    </TiltCard>
  );
}
