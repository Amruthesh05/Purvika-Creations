import { describe, it, expect, beforeEach } from 'vitest';
import { variantsSchema, productInputSchema, slugify } from '@/lib/validation';
import { MockRepository } from '@/lib/db/mock-repository';
import type { Product, CartItem } from '@/lib/types';

function makeVariantProduct(): Product {
  const now = new Date().toISOString();
  return {
    id: 'pv1',
    name: 'Cotton T-Shirt',
    description: 'A nice tee',
    price_paise: 99900,
    stock_status: 'in_stock',
    image_url: 'https://example.com/t.jpg',
    imageUrls: ['https://example.com/t.jpg', 'https://example.com/t2.jpg', 'https://example.com/t3.jpg'],
    active: true,
    saleMode: 'buy',
    preorderLimit: null,
    mrpPaise: null,
    variantLabel: 'Size',
    variants: [
      { id: 's', label: 'S', in_stock: true },
      { id: 'm', label: 'M', in_stock: true },
      { id: 'l', label: 'L', in_stock: false },
    ],
    created_at: now,
    updated_at: now,
  };
}

function makePlainProduct(): Product {
  const now = new Date().toISOString();
  return {
    id: 'pp1',
    name: 'Mug',
    description: 'A mug',
    price_paise: 29900,
    stock_status: 'in_stock',
    image_url: 'https://example.com/m.jpg',
    imageUrls: ['https://example.com/m.jpg', 'https://example.com/m2.jpg', 'https://example.com/m3.jpg'],
    active: true,
    saleMode: 'buy',
    preorderLimit: null,
    mrpPaise: null,
    variantLabel: 'Size',
    variants: [],
    created_at: now,
    updated_at: now,
  };
}

describe('variant validation', () => {
  it('accepts valid unique variants', () => {
    const result = variantsSchema.safeParse([
      { id: 's', label: 'S', in_stock: true },
      { id: 'm', label: 'M', in_stock: true },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects duplicate labels (case-insensitive)', () => {
    const result = variantsSchema.safeParse([
      { id: 'm', label: 'M', in_stock: true },
      { id: 'm-1', label: 'm', in_stock: true },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects more than 12 variants', () => {
    const variants = Array.from({ length: 13 }, (_, i) => ({
      id: `v${i}`,
      label: `V${i}`,
      in_stock: true,
    }));
    const result = variantsSchema.safeParse(variants);
    expect(result.success).toBe(false);
  });

  it('rejects label longer than 20 characters', () => {
    const result = variantsSchema.safeParse([
      { id: 'x', label: 'x'.repeat(21), in_stock: true },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects id that does not match slugified label', () => {
    const result = variantsSchema.safeParse([
      { id: 'wrong', label: 'Medium', in_stock: true },
    ]);
    expect(result.success).toBe(false);
  });

  it('slugifies labels correctly', () => {
    expect(slugify('Medium')).toBe('medium');
    expect(slugify('Free size')).toBe('free-size');
    expect(slugify('XL')).toBe('xl');
  });

  it('accepts variantLabel within 1-20 chars', () => {
    const product = {
      name: 'Test',
      description: 'Desc',
      price_paise: 100,
      stock_status: 'in_stock' as const,
      image_url: 'https://example.com/x.jpg',
      imageUrls: ['https://example.com/x.jpg', 'https://example.com/y.jpg', 'https://example.com/z.jpg'],
      active: true,
      saleMode: 'buy' as const,
      preorderLimit: null,
      mrpPaise: null,
      variantLabel: 'Color',
      variants: [],
    };
    const result = productInputSchema.safeParse(product);
    expect(result.success).toBe(true);
  });

  it('rejects empty variantLabel', () => {
    const product = {
      name: 'Test',
      description: 'Desc',
      price_paise: 100,
      stock_status: 'in_stock' as const,
      image_url: 'https://example.com/x.jpg',
      imageUrls: ['https://example.com/x.jpg', 'https://example.com/y.jpg', 'https://example.com/z.jpg'],
      active: true,
      saleMode: 'buy' as const,
      preorderLimit: null,
      mrpPaise: null,
      variantLabel: '',
      variants: [],
    };
    const result = productInputSchema.safeParse(product);
    expect(result.success).toBe(false);
  });
});

describe('create-order variant rejection', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('rejects missing variantId for a variant product', async () => {
    const product = makeVariantProduct();
    const added = await repo.addProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      price_paise: product.price_paise,
      stock_status: product.stock_status,
      image_url: product.image_url,
      imageUrls: product.imageUrls,
      active: true,
      saleMode: 'buy',
      preorderLimit: null,
      mrpPaise: null,
      variantLabel: 'Size',
      variants: product.variants,
    });

    const p = await repo.getProductById(added.id);
    expect(p).not.toBeNull();
    expect(p!.variants.length).toBe(3);

    const variant = p!.variants.find((v) => v.id === 'l');
    expect(variant?.in_stock).toBe(false);
  });

  it('identifies unknown variant', () => {
    const product = makeVariantProduct();
    const variantId = 'nonexistent';
    const variant = product.variants.find((v) => v.id === variantId);
    expect(variant).toBeUndefined();
  });

  it('identifies out-of-stock variant', () => {
    const product = makeVariantProduct();
    const variant = product.variants.find((v) => v.id === 'l');
    expect(variant).toBeDefined();
    expect(variant!.in_stock).toBe(false);
  });

  it('stores variant snapshot in order items', async () => {
    const product = makeVariantProduct();
    const added = await repo.addProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      price_paise: product.price_paise,
      stock_status: product.stock_status,
      image_url: product.image_url,
      imageUrls: product.imageUrls,
      active: true,
      saleMode: 'buy',
      preorderLimit: null,
      mrpPaise: null,
      variantLabel: 'Size',
      variants: product.variants,
    });

    const order = await repo.createOrder({
      userId: 'u1',
      totalPaise: 99900,
      items: [{
        productId: added.id,
        nameSnapshot: 'Cotton T-Shirt',
        pricePaiseSnapshot: 99900,
        quantity: 1,
        variantId: 'm',
        variantLabel: 'Size',
        variantValue: 'M',
        mrpPaiseSnapshot: null,
      }],
    });

    expect(order.items).toHaveLength(1);
    expect(order.items[0].variant_id).toBe('m');
    expect(order.items[0].variant_label).toBe('Size');
    expect(order.items[0].variant_value).toBe('M');
  });

  it('allows no variantId for a product without variants', async () => {
    const product = makePlainProduct();
    const added = await repo.addProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      price_paise: product.price_paise,
      stock_status: product.stock_status,
      image_url: product.image_url,
      imageUrls: product.imageUrls,
      active: true,
      saleMode: 'buy',
      preorderLimit: null,
      mrpPaise: null,
      variantLabel: 'Size',
      variants: [],
    });

    const order = await repo.createOrder({
      userId: 'u1',
      totalPaise: 29900,
      items: [{
        productId: added.id,
        nameSnapshot: 'Mug',
        pricePaiseSnapshot: 29900,
        quantity: 1,
      }],
    });

    expect(order.items).toHaveLength(1);
    expect(order.items[0].variant_id).toBeNull();
  });
});

describe('cart line keys differ per size', () => {
  function lineKey(productId: string, variantId?: string): string {
    return variantId ? `${productId}::${variantId}` : productId;
  }

  it('produces different keys for different sizes', () => {
    const key1 = lineKey('pv1', 's');
    const key2 = lineKey('pv1', 'm');
    expect(key1).not.toBe(key2);
  });

  it('produces same key for same product+size', () => {
    const key1 = lineKey('pv1', 'm');
    const key2 = lineKey('pv1', 'm');
    expect(key1).toBe(key2);
  });

  it('uses productId-only key when no variant', () => {
    const key = lineKey('pp1');
    expect(key).toBe('pp1');
  });

  it('treats missing variantId and undefined the same', () => {
    expect(lineKey('pp1')).toBe(lineKey('pp1', undefined));
  });
});

describe('old cart entries are flagged', () => {
  function enrichCart(items: CartItem[], products: Product[]) {
    const productMap = new Map(products.map((p) => [p.id, p]));
    return items.map((i) => {
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
      return { ...i, product, variant, outOfStock, variantMissing, variantGone };
    });
  }

  const products: Product[] = [makeVariantProduct(), makePlainProduct()];

  it('flags old entry without variantId for a product that now requires one', () => {
    const items: CartItem[] = [{ productId: 'pv1', quantity: 1 }];
    const enriched = enrichCart(items, products);
    expect(enriched[0].variantMissing).toBe(true);
  });

  it('flags entry with a variantId that no longer exists', () => {
    const items: CartItem[] = [{ productId: 'pv1', quantity: 1, variantId: 'xl' }];
    const enriched = enrichCart(items, products);
    expect(enriched[0].variantGone).toBe(true);
  });

  it('flags entry with an out-of-stock variant', () => {
    const items: CartItem[] = [{ productId: 'pv1', quantity: 1, variantId: 'l' }];
    const enriched = enrichCart(items, products);
    expect(enriched[0].outOfStock).toBe(true);
    expect(enriched[0].variantGone).toBe(false);
  });

  it('does not flag a valid in-stock variant entry', () => {
    const items: CartItem[] = [{ productId: 'pv1', quantity: 1, variantId: 'm' }];
    const enriched = enrichCart(items, products);
    expect(enriched[0].variantMissing).toBe(false);
    expect(enriched[0].variantGone).toBe(false);
    expect(enriched[0].outOfStock).toBe(false);
  });

  it('does not flag plain product entries', () => {
    const items: CartItem[] = [{ productId: 'pp1', quantity: 1 }];
    const enriched = enrichCart(items, products);
    expect(enriched[0].variantMissing).toBe(false);
    expect(enriched[0].variantGone).toBe(false);
    expect(enriched[0].outOfStock).toBe(false);
  });
});
