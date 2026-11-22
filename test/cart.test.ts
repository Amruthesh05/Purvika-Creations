import { describe, it, expect } from 'vitest';
import type { Product, CartItem } from '@/lib/types';

const MIN_QTY = 1;
const MAX_QTY = 10;

function clampQty(qty: number): number {
  return Math.max(MIN_QTY, Math.min(MAX_QTY, Math.floor(qty)));
}

function enrichCart(items: CartItem[], products: Product[]) {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const validItems = items.filter((i) => productMap.has(i.productId));
  const enriched = validItems.map((i) => {
    const product = productMap.get(i.productId)!;
    return { ...i, product, outOfStock: product.stock_status === 'out_of_stock' };
  });
  const subtotalPaise = enriched.reduce(
    (sum, i) => sum + i.product.price_paise * i.quantity,
    0,
  );
  return { validItems, enriched, subtotalPaise };
}

const testProducts: Product[] = [
  { id: 'p1', name: 'Earbuds', description: 'Good', price_paise: 499900, stock_status: 'in_stock', image_url: 'https://example.com/1.jpg', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'p2', name: 'Watch', description: 'Good', price_paise: 249900, stock_status: 'in_stock', image_url: 'https://example.com/2.jpg', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'p3', name: 'Speaker', description: 'Good', price_paise: 199900, stock_status: 'out_of_stock', image_url: 'https://example.com/3.jpg', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

describe('cart totals', () => {
  it('calculates subtotal correctly', () => {
    const items: CartItem[] = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
    ];
    const { subtotalPaise } = enrichCart(items, testProducts);
    expect(subtotalPaise).toBe(499900 * 2 + 249900 * 1);
  });

  it('calculates subtotal with mixed stock items', () => {
    const items: CartItem[] = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p3', quantity: 3 },
    ];
    const { subtotalPaise } = enrichCart(items, testProducts);
    expect(subtotalPaise).toBe(499900 + 199900 * 3);
  });

  it('returns zero for empty cart', () => {
    const { subtotalPaise } = enrichCart([], testProducts);
    expect(subtotalPaise).toBe(0);
  });
});

describe('quantity limits', () => {
  it('clamps to minimum 1', () => {
    expect(clampQty(0)).toBe(1);
    expect(clampQty(-5)).toBe(1);
  });

  it('clamps to maximum 10', () => {
    expect(clampQty(11)).toBe(10);
    expect(clampQty(100)).toBe(10);
  });

  it('keeps valid quantities unchanged', () => {
    expect(clampQty(1)).toBe(1);
    expect(clampQty(5)).toBe(5);
    expect(clampQty(10)).toBe(10);
  });

  it('floors decimals', () => {
    expect(clampQty(3.7)).toBe(3);
    expect(clampQty(0.5)).toBe(1);
  });
});

describe('dropping unavailable items', () => {
  it('drops items whose product no longer exists in the catalog', () => {
    const items: CartItem[] = [
      { productId: 'p1', quantity: 1 },
      { productId: 'deleted-product', quantity: 2 },
    ];
    const { validItems, enriched } = enrichCart(items, testProducts);
    expect(validItems).toHaveLength(1);
    expect(validItems[0].productId).toBe('p1');
    expect(enriched).toHaveLength(1);
  });

  it('flags out-of-stock items', () => {
    const items: CartItem[] = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p3', quantity: 1 },
    ];
    const { enriched } = enrichCart(items, testProducts);
    expect(enriched[0].outOfStock).toBe(false);
    expect(enriched[1].outOfStock).toBe(true);
  });

  it('drops all items if catalog is empty', () => {
    const items: CartItem[] = [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 2 },
    ];
    const { validItems } = enrichCart(items, []);
    expect(validItems).toHaveLength(0);
  });
});
