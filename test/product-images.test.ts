import { describe, it, expect } from 'vitest';
import { productInputSchema, imageUrlsSchema } from '@/lib/validation';
import { normalizeImageUrls, MIN_IMAGES, MAX_IMAGES } from '@/lib/products/config';

const validUrls = [
  'https://example.com/a.jpg',
  'https://example.com/b.jpg',
  'https://example.com/c.jpg',
];

const validBase = {
  id: undefined,
  name: 'Test Product',
  description: 'A test product',
  price_paise: 99900,
  stock_status: 'in_stock' as const,
  image_url: 'https://example.com/a.jpg',
  imageUrls: [...validUrls],
  active: true,
};

describe('imageUrls validation', () => {
  it('rejects fewer than MIN_IMAGES', () => {
    const result = imageUrlsSchema.safeParse(['https://example.com/a.jpg']);
    expect(result.success).toBe(false);
  });

  it('rejects more than MAX_IMAGES', () => {
    const urls = Array.from({ length: MAX_IMAGES + 1 }, (_, i) => `https://example.com/${i}.jpg`);
    const result = imageUrlsSchema.safeParse(urls);
    expect(result.success).toBe(false);
  });

  it('accepts exactly MIN_IMAGES', () => {
    const result = imageUrlsSchema.safeParse(validUrls.slice(0, MIN_IMAGES));
    expect(result.success).toBe(true);
  });

  it('accepts exactly MAX_IMAGES', () => {
    const urls = Array.from({ length: MAX_IMAGES }, (_, i) => `https://example.com/${i}.jpg`);
    const result = imageUrlsSchema.safeParse(urls);
    expect(result.success).toBe(true);
  });

  it('requires https URLs only', () => {
    const result = imageUrlsSchema.safeParse(['http://example.com/a.jpg', ...validUrls.slice(1)]);
    expect(result.success).toBe(false);
  });

  it('rejects duplicates', () => {
    const result = imageUrlsSchema.safeParse([validUrls[0], validUrls[0], validUrls[1]]);
    expect(result.success).toBe(false);
  });
});

describe('productInputSchema with imageUrls', () => {
  it('rejects product with fewer than MIN_IMAGES images', () => {
    const result = productInputSchema.safeParse({ ...validBase, imageUrls: [validUrls[0]] });
    expect(result.success).toBe(false);
  });

  it('accepts a valid product with MIN_IMAGES images', () => {
    const result = productInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it('accepts a valid product with 6 images', () => {
    const urls = Array.from({ length: MAX_IMAGES }, (_, i) => `https://example.com/${i}.jpg`);
    const result = productInputSchema.safeParse({ ...validBase, imageUrls: urls, image_url: urls[0] });
    expect(result.success).toBe(true);
  });
});

describe('normalizeImageUrls (legacy fallback)', () => {
  it('returns the array when valid', () => {
    expect(normalizeImageUrls(validUrls, 'https://example.com/fallback.jpg')).toEqual(validUrls);
  });

  it('falls back to [image_url] for legacy single-image products', () => {
    expect(normalizeImageUrls([], 'https://example.com/legacy.jpg')).toEqual(['https://example.com/legacy.jpg']);
    expect(normalizeImageUrls(null, 'https://example.com/legacy.jpg')).toEqual(['https://example.com/legacy.jpg']);
    expect(normalizeImageUrls(undefined, 'https://example.com/legacy.jpg')).toEqual(['https://example.com/legacy.jpg']);
  });

  it('returns empty array when no images and no fallback', () => {
    expect(normalizeImageUrls([], null)).toEqual([]);
    expect(normalizeImageUrls(null, undefined)).toEqual([]);
  });

  it('first image is the cover', () => {
    const urls = ['https://example.com/first.jpg', 'https://example.com/second.jpg'];
    const normalized = normalizeImageUrls(urls, null);
    expect(normalized[0]).toBe('https://example.com/first.jpg');
  });
});

describe('image count constants', () => {
  it('MIN_IMAGES is 2', () => {
    expect(MIN_IMAGES).toBe(2);
  });

  it('MAX_IMAGES is 6', () => {
    expect(MAX_IMAGES).toBe(6);
  });
});
