import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Product, CartItem, Variant } from '../types';

const STORAGE_KEY = 'storefront_cart';
const MIN_QTY = 1;
const MAX_QTY = 10;

interface CartContextValue {
  items: CartItem[];
  addItem: (productId: string, variantId?: string, quantity?: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  setQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clear: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function lineKey(productId: string, variantId?: string): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

function readStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        typeof item?.productId === 'string' && typeof item?.quantity === 'number',
    );
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore write errors
  }
}

function clampQty(qty: number): number {
  return Math.max(MIN_QTY, Math.min(MAX_QTY, Math.floor(qty)));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readStorage());
  }, []);

  const addItem = useCallback(
    (productId: string, variantId?: string, quantity = 1) => {
      setItems((prev) => {
        const key = lineKey(productId, variantId);
        const existing = prev.find((i) => lineKey(i.productId, i.variantId) === key);
        let next: CartItem[];
        if (existing) {
          next = prev.map((i) =>
            lineKey(i.productId, i.variantId) === key ? { ...i, quantity: clampQty(i.quantity + quantity) } : i,
          );
        } else {
          next = [...prev, { productId, variantId, quantity: clampQty(quantity) }];
        }
        writeStorage(next);
        return next;
      });
    },
    [],
  );

  const removeItem = useCallback((productId: string, variantId?: string) => {
    const key = lineKey(productId, variantId);
    setItems((prev) => {
      const next = prev.filter((i) => lineKey(i.productId, i.variantId) !== key);
      writeStorage(next);
      return next;
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    const key = lineKey(productId, variantId);
    setItems((prev) => {
      const next = prev.map((i) =>
        lineKey(i.productId, i.variantId) === key ? { ...i, quantity: clampQty(quantity) } : i,
      );
      writeStorage(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    writeStorage([]);
  }, []);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, setQuantity, clear, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export interface EnrichedCartItem extends CartItem {
  product: Product;
  variant?: Variant;
  outOfStock: boolean;
  needsVariant: boolean;
  variantMissing: boolean;
  variantGone: boolean;
}

export function useCartWithCatalog(products: Product[]) {
  const { items, ...rest } = useCart();

  const productMap = new Map(products.map((p) => [p.id, p]));
  const validItems = items.filter((i) => productMap.has(i.productId));
  const enriched: EnrichedCartItem[] = validItems.map((i) => {
    const product = productMap.get(i.productId)!;
    const hasVariants = product.variants && product.variants.length > 0;
    const variant = hasVariants && i.variantId ? product.variants.find((v) => v.id === i.variantId) : undefined;
    const variantMissing = hasVariants && !i.variantId;
    const variantGone = hasVariants && !!i.variantId && !variant;
    const outOfStock = !hasVariants
      ? product.stock_status === 'out_of_stock'
      : variant
        ? !variant.in_stock
        : false;
    return {
      ...i,
      product,
      variant,
      outOfStock,
      needsVariant: hasVariants,
      variantMissing,
      variantGone,
    };
  });

  const subtotalPaise = enriched.reduce(
    (sum, i) => sum + i.product.price_paise * i.quantity,
    0,
  );

  return { ...rest, items: validItems, enriched, subtotalPaise };
}
