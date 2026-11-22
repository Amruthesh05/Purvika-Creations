import { describe, it, expect } from 'vitest';
import { HERO_HEADLINE, HERO_SUBLINE, HISTORY, EXCELLENCE, RETURN_WINDOW_DAYS } from '@/lib/brand';
import { DELIVERY_MODES } from '@/lib/delivery/config';
import { COD_FEE_PAISE } from '@/lib/payments/config';
import { formatINR } from '@/lib/utils';
import type { Product } from '@/lib/types';

// Product sort/filter helpers (mirrors ProductsPage logic)
function sortProducts(products: Product[], sort: 'newest' | 'price_low' | 'price_high'): Product[] {
  const result = [...products];
  if (sort === 'price_low') result.sort((a, b) => a.price_paise - b.price_paise);
  else if (sort === 'price_high') result.sort((a, b) => b.price_paise - a.price_paise);
  else result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return result;
}

function filterProducts(products: Product[], opts: { search?: string; inStockOnly?: boolean }): Product[] {
  let result = [...products];
  if (opts.inStockOnly) result = result.filter((p) => p.stock_status === 'in_stock');
  if (opts.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    result = result.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  return result;
}

// Scroll progress clamp helper (mirrors useScrollProgress logic)
function clampProgress(passed: number, total: number): number {
  return Math.max(0, Math.min(1, passed / total));
}

describe('brand.ts', () => {
  it('HERO_HEADLINE is not empty', () => {
    expect(HERO_HEADLINE.length).toBeGreaterThan(0);
  });

  it('HERO_SUBLINE is not empty', () => {
    expect(HERO_SUBLINE.length).toBeGreaterThan(0);
  });

  it('HISTORY has 3-4 items, all non-empty', () => {
    expect(HISTORY.length).toBeGreaterThanOrEqual(3);
    expect(HISTORY.length).toBeLessThanOrEqual(4);
    for (const item of HISTORY) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.text.length).toBeGreaterThan(0);
    }
  });

  it('EXCELLENCE has exactly 3 items, all non-empty', () => {
    expect(EXCELLENCE.length).toBe(3);
    for (const item of EXCELLENCE) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.text.length).toBeGreaterThan(0);
    }
  });

  it('RETURN_WINDOW_DAYS is a positive number', () => {
    expect(RETURN_WINDOW_DAYS).toBeGreaterThan(0);
  });
});

describe('scroll progress clamp', () => {
  it('clamps --p between 0 and 1', () => {
    expect(clampProgress(-100, 500)).toBe(0);
    expect(clampProgress(0, 500)).toBe(0);
    expect(clampProgress(250, 500)).toBe(0.5);
    expect(clampProgress(500, 500)).toBe(1);
    expect(clampProgress(600, 500)).toBe(1);
  });
});

describe('product sort and filter helpers', () => {
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 86400000).toISOString();
  const products: Product[] = [
    { id: 'a', name: 'Alpha', description: 'first', price_paise: 50000, stock_status: 'in_stock', image_url: 'https://x.com/a.jpg', imageUrls: [], active: true, saleMode: 'buy', preorderLimit: null, created_at: now, updated_at: now },
    { id: 'b', name: 'Beta', description: 'second', price_paise: 30000, stock_status: 'out_of_stock', image_url: 'https://x.com/b.jpg', imageUrls: [], active: true, saleMode: 'buy', preorderLimit: null, created_at: earlier, updated_at: earlier },
    { id: 'c', name: 'Gamma', description: 'third', price_paise: 70000, stock_status: 'in_stock', image_url: 'https://x.com/c.jpg', imageUrls: [], active: true, saleMode: 'buy', preorderLimit: null, created_at: now, updated_at: now },
  ];

  it('sorts newest first', () => {
    const sorted = sortProducts(products, 'newest');
    expect(sorted[0].id).toBe('a'); // 'a' and 'c' same time, 'a' first by stable sort
  });

  it('sorts price low to high', () => {
    const sorted = sortProducts(products, 'price_low');
    expect(sorted[0].price_paise).toBe(30000);
    expect(sorted[2].price_paise).toBe(70000);
  });

  it('sorts price high to low', () => {
    const sorted = sortProducts(products, 'price_high');
    expect(sorted[0].price_paise).toBe(70000);
    expect(sorted[2].price_paise).toBe(30000);
  });

  it('filters in stock only', () => {
    const filtered = filterProducts(products, { inStockOnly: true });
    expect(filtered.length).toBe(2);
    expect(filtered.every((p) => p.stock_status === 'in_stock')).toBe(true);
  });

  it('filters by search term', () => {
    const filtered = filterProducts(products, { search: 'alpha' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('a');
  });

  it('combines search and stock filter', () => {
    const filtered = filterProducts(products, { search: 'a', inStockOnly: true });
    expect(filtered.length).toBe(2); // 'Alpha' and 'Gamma' both contain 'a'
  });
});

describe('policy values format correctly', () => {
  it('delivery fees format as INR', () => {
    expect(formatINR(DELIVERY_MODES.courier.feePaise)).toContain('₹');
    expect(formatINR(DELIVERY_MODES.founders.feePaise)).toContain('₹');
  });

  it('COD fee formats as INR', () => {
    expect(formatINR(COD_FEE_PAISE)).toContain('₹');
  });
});
