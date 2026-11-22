import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import type { Product } from '@/lib/types';

const testProducts: Product[] = [
  { id: 'p1', name: 'Earbuds', description: 'Good', price_paise: 499900, stock_status: 'in_stock', image_url: 'https://example.com/1.jpg', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'p2', name: 'Watch', description: 'Good', price_paise: 249900, stock_status: 'in_stock', image_url: 'https://example.com/2.jpg', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'p3', name: 'Speaker', description: 'Good', price_paise: 199900, stock_status: 'out_of_stock', image_url: 'https://example.com/3.jpg', active: true, created_at: '2024-01-01', updated_at: '2024-01-01' },
  { id: 'p4', name: 'Inactive Item', description: 'Old', price_paise: 99900, stock_status: 'in_stock', image_url: 'https://example.com/4.jpg', active: false, created_at: '2024-01-01', updated_at: '2024-01-01' },
];

function computeTotal(items: { productId: string; quantity: number }[], products: Product[]): number {
  const map = new Map(products.map((p) => [p.id, p]));
  return items.reduce((sum, i) => {
    const p = map.get(i.productId);
    return sum + (p?.price_paise ?? 0) * i.quantity;
  }, 0);
}

function validateCartItems(items: { productId: string; quantity: number }[], products: Product[]): { ok: boolean; error?: string } {
  const map = new Map(products.map((p) => [p.id, p]));
  for (const item of items) {
    if (!item.productId) return { ok: false, error: 'unknown_product' };
    if (!map.has(item.productId)) return { ok: false, error: 'unknown_product' };
    if (item.quantity < 1) return { ok: false, error: 'invalid_quantity' };
    if (item.quantity > 10) return { ok: false, error: 'max_quantity_exceeded' };
  }
  for (const item of items) {
    const p = map.get(item.productId)!;
    if (!p.active) return { ok: false, error: 'inactive_product' };
    if (p.stock_status === 'out_of_stock') return { ok: false, error: 'out_of_stock' };
  }
  return { ok: true };
}

describe('checkout total calculation', () => {
  it('sums server-side prices correctly', () => {
    const items = [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
    ];
    expect(computeTotal(items, testProducts)).toBe(499900 * 2 + 249900);
  });

  it('handles single item', () => {
    expect(computeTotal([{ productId: 'p1', quantity: 1 }], testProducts)).toBe(499900);
  });

  it('returns 0 for empty cart', () => {
    expect(computeTotal([], testProducts)).toBe(0);
  });

  it('ignores unknown products in total (but validation catches them first)', () => {
    const items = [{ productId: 'nonexistent', quantity: 1 }];
    expect(computeTotal(items, testProducts)).toBe(0);
  });
});

describe('checkout validation rejections', () => {
  it('rejects unknown product', () => {
    const result = validateCartItems([{ productId: 'nonexistent', quantity: 1 }], testProducts);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('unknown_product');
  });

  it('rejects out-of-stock product', () => {
    const result = validateCartItems([{ productId: 'p3', quantity: 1 }], testProducts);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('out_of_stock');
  });

  it('rejects inactive product', () => {
    const result = validateCartItems([{ productId: 'p4', quantity: 1 }], testProducts);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('inactive_product');
  });

  it('rejects quantity below 1', () => {
    const result = validateCartItems([{ productId: 'p1', quantity: 0 }], testProducts);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_quantity');
  });

  it('rejects quantity above 10', () => {
    const result = validateCartItems([{ productId: 'p1', quantity: 11 }], testProducts);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('max_quantity_exceeded');
  });

  it('accepts valid in-stock items', () => {
    const result = validateCartItems([{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 3 }], testProducts);
    expect(result.ok).toBe(true);
  });
});

describe('payment mode resolution', () => {
  it('defaults to razorpay when PAYMENT_MODE is missing', async () => {
    const { resolvePaymentMode } = await import('@/lib/payments/index');
    expect(resolvePaymentMode({})).toBe('razorpay');
  });

  it('defaults to razorpay when PAYMENT_MODE is anything else', async () => {
    const { resolvePaymentMode } = await import('@/lib/payments/index');
    expect(resolvePaymentMode({ PAYMENT_MODE: 'something' })).toBe('razorpay');
  });
});

describe('razorpay provider', () => {
  it('throws payments_not_configured when keys are missing', async () => {
    const { RazorpayProvider, RazorpayNotConfiguredError } = await import('@/lib/payments/razorpay');
    const provider = new RazorpayProvider({});
    await expect(provider.createOrder(499900, 'r1')).rejects.toThrow(RazorpayNotConfiguredError);
    try {
      await provider.createOrder(100, 'r2');
    } catch (err) {
      expect((err as { code: string }).code).toBe('payments_not_configured');
    }
  });
});
