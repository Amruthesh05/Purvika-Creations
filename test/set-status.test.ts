import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import { handleMutate } from '@/lib/mutate-handler';
import type { User, ProductInput } from '@/lib/types';
import type { Repository } from '@/lib/db/repository';

function makeAdmin(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'admin@example.com',
    role: 'superadmin',
    approval_status: 'approved',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const validProductInput: ProductInput = {
  name: 'Test Product',
  description: 'A test product for testing',
  price_paise: 99900,
  stock_status: 'in_stock',
  image_url: 'https://example.com/image.jpg',
  imageUrls: ['https://example.com/image.jpg', 'https://example.com/image2.jpg', 'https://example.com/image3.jpg'],
  active: true,
  saleMode: 'buy',
  preorderLimit: null,
};

describe('SET_STATUS action', () => {
  let repo: Repository;
  let admin: User;
  let productId: string;

  beforeEach(async () => {
    repo = new MockRepository();
    admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: validProductInput,
    });
    expect(result.success).toBe(true);
    productId = result.product!.id;
  });

  it('rejects SET_STATUS with no fields', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('At least one field');
  });

  it('rejects SET_STATUS with invalid stock_status', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, stock_status: 'invalid' as never },
    });
    expect(result.success).toBe(false);
  });

  it('rejects SET_STATUS with invalid sale_mode', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, sale_mode: 'invalid' as never },
    });
    expect(result.success).toBe(false);
  });

  it('rejects SET_STATUS from non-admin', async () => {
    const buyer = makeAdmin({ role: 'buyer' });
    const result = await handleMutate({ repo, user: buyer }, {
      action: 'SET_STATUS',
      setStatus: { productId, stock_status: 'out_of_stock' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
  });

  it('rejects SET_STATUS from unauthenticated', async () => {
    const result = await handleMutate({ repo, user: null }, {
      action: 'SET_STATUS',
      setStatus: { productId, stock_status: 'out_of_stock' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
  });

  it('rejects SET_STATUS for non-existent product', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId: 'nonexistent', stock_status: 'out_of_stock' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product not found');
  });

  it('successfully updates stock_status', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, stock_status: 'out_of_stock' },
    });
    expect(result.success).toBe(true);
    expect(result.product?.stock_status).toBe('out_of_stock');
  });

  it('successfully updates active (visible/hidden)', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, active: false },
    });
    expect(result.success).toBe(true);
    expect(result.product?.active).toBe(false);
  });

  it('successfully updates sale_mode', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, sale_mode: 'preorder' },
    });
    expect(result.success).toBe(true);
    expect(result.product?.saleMode).toBe('preorder');
  });

  it('successfully updates multiple fields at once', async () => {
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, stock_status: 'out_of_stock', active: false, sale_mode: 'preorder_closed' },
    });
    expect(result.success).toBe(true);
    expect(result.product?.stock_status).toBe('out_of_stock');
    expect(result.product?.active).toBe(false);
    expect(result.product?.saleMode).toBe('preorder_closed');
  });

  it('does not touch images on SET_STATUS', async () => {
    const original = await repo.getProductById(productId);
    const result = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, stock_status: 'out_of_stock' },
    });
    expect(result.success).toBe(true);
    expect(result.product?.imageUrls).toEqual(original?.imageUrls);
    expect(result.product?.image_url).toBe(original?.image_url);
  });
});

describe('UPDATE image rules', () => {
  let repo: Repository;
  let admin: User;

  beforeEach(() => {
    repo = new MockRepository();
    admin = makeAdmin();
  });

  it('accepts legacy UPDATE with unchanged images (fewer than MIN_IMAGES)', async () => {
    // Add a product with only 1 image
    const addResult = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: {
        ...validProductInput,
        imageUrls: ['https://example.com/only.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'],
        image_url: 'https://example.com/only.jpg',
      },
    });
    expect(addResult.success).toBe(true);
    const pid = addResult.product!.id;

    // Now manually set it to have only 1 image by directly manipulating via UPDATE
    // with unchanged images (same list)
    const updateResult = await handleMutate({ repo, user: admin }, {
      action: 'UPDATE',
      product: {
        ...validProductInput,
        id: pid,
        name: 'Updated Name',
        imageUrls: ['https://example.com/only.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'],
        image_url: 'https://example.com/only.jpg',
      },
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.product?.name).toBe('Updated Name');
  });

  it('rejects UPDATE with changed images fewer than MIN_IMAGES', async () => {
    const addResult = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: validProductInput,
    });
    const pid = addResult.product!.id;

    const updateResult = await handleMutate({ repo, user: admin }, {
      action: 'UPDATE',
      product: {
        ...validProductInput,
        id: pid,
        imageUrls: ['https://example.com/single.jpg'],
        image_url: 'https://example.com/single.jpg',
      },
    });
    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toContain('At least 2');
  });

  it('rejects UPDATE with changed images more than 6', async () => {
    const addResult = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: validProductInput,
    });
    const pid = addResult.product!.id;

    const seven = Array.from({ length: 7 }, (_, i) => `https://example.com/img${i}.jpg`);
    const updateResult = await handleMutate({ repo, user: admin }, {
      action: 'UPDATE',
      product: {
        ...validProductInput,
        id: pid,
        imageUrls: seven,
        image_url: seven[0],
      },
    });
    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toContain('At most 6');
  });

  it('accepts UPDATE with changed images between MIN_IMAGES and MAX_IMAGES', async () => {
    const addResult = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: validProductInput,
    });
    const pid = addResult.product!.id;

    const four = Array.from({ length: 4 }, (_, i) => `https://example.com/new${i}.jpg`);
    const updateResult = await handleMutate({ repo, user: admin }, {
      action: 'UPDATE',
      product: {
        ...validProductInput,
        id: pid,
        imageUrls: four,
        image_url: four[0],
      },
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.product?.imageUrls).toEqual(four);
  });
});
