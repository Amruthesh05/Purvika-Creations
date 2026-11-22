import { describe, it, expect } from 'vitest';
import { percentOff, savingsPaise, MRP_BELOW_PRICE_MESSAGE } from '@/lib/pricing';
import { productInputSchema } from '@/lib/validation';
import { MockRepository } from '@/lib/db/mock-repository';

const base = {
  name: 'Heavy Tee',
  description: 'Cotton tee',
  price_paise: 79900,
  stock_status: 'in_stock' as const,
  image_url: 'https://example.com/1.jpg',
  imageUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg'],
  active: true,
  saleMode: 'buy' as const,
  preorderLimit: null,
};

describe('percentOff', () => {
  it('rounds the discount down', () => {
    expect(percentOff(79900, 99900)).toBe(20);
    expect(percentOff(100, 300)).toBe(66);
  });

  it('is zero when there is no MRP or it is not above the price', () => {
    expect(percentOff(500, null)).toBe(0);
    expect(percentOff(500, undefined)).toBe(0);
    expect(percentOff(500, 500)).toBe(0);
    expect(percentOff(500, 400)).toBe(0);
  });
});

describe('savingsPaise', () => {
  it('multiplies the per-unit saving by quantity', () => {
    expect(savingsPaise(79900, 99900, 2)).toBe(40000);
    expect(savingsPaise(79900, null, 2)).toBe(0);
  });
});

describe('MRP validation', () => {
  it('rejects an MRP below the sale price', () => {
    const result = productInputSchema.safeParse({ ...base, mrpPaise: 50000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(MRP_BELOW_PRICE_MESSAGE);
      expect(result.error.issues[0].path).toEqual(['mrpPaise']);
    }
  });

  it('accepts an empty MRP', () => {
    const omitted = productInputSchema.safeParse(base);
    expect(omitted.success).toBe(true);
    if (omitted.success) expect(omitted.data.mrpPaise).toBeNull();

    const explicitNull = productInputSchema.safeParse({ ...base, mrpPaise: null });
    expect(explicitNull.success).toBe(true);
  });

  it('accepts an MRP equal to the sale price', () => {
    expect(productInputSchema.safeParse({ ...base, mrpPaise: 79900 }).success).toBe(true);
  });
});

describe('totals', () => {
  it('keep using the sale price when an MRP is set', async () => {
    const repo = new MockRepository();
    const product = await repo.addProduct({ ...base, mrpPaise: 99900 });
    expect(product.price_paise).toBe(79900);
    expect(product.mrpPaise).toBe(99900);
  });
});
