import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import { handleMutate } from '@/lib/mutate-handler';
import type { User } from '@/lib/types';
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

const validProductInput = {
  name: 'Test Product',
  description: 'A test product for testing',
  price_paise: 99900,
  stock_status: 'in_stock' as const,
  image_url: 'https://example.com/image.jpg',
  imageUrls: ['https://example.com/image.jpg', 'https://example.com/image2.jpg', 'https://example.com/image3.jpg'],
  active: true,
};

describe('handleMutate', () => {
  let repo: Repository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('rejects unauthenticated requests', async () => {
    const result = await handleMutate({ repo, user: null }, {
      action: 'ADD',
      product: validProductInput,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
  });

  it('rejects non-admin users', async () => {
    const buyer: User = makeAdmin({ role: 'buyer' });
    const result = await handleMutate({ repo, user: buyer }, {
      action: 'ADD',
      product: validProductInput,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
  });

  it('rejects admin with pending approval', async () => {
    const pendingAdmin: User = makeAdmin({ role: 'admin', approval_status: 'pending' });
    const result = await handleMutate({ repo, user: pendingAdmin }, {
      action: 'ADD',
      product: validProductInput,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Forbidden');
  });

  it('successfully adds a product as approved superadmin', async () => {
    const superadmin = makeAdmin();
    const result = await handleMutate({ repo, user: superadmin }, {
      action: 'ADD',
      product: validProductInput,
    });
    expect(result.success).toBe(true);
    expect(result.product).toBeDefined();
    expect(result.product?.name).toBe('Test Product');
    expect(result.product?.price_paise).toBe(99900);
  });

  it('allows regular admins to update stock status only', async () => {
    const superadmin = makeAdmin();
    const addResult = await handleMutate({ repo, user: superadmin }, {
      action: 'ADD',
      product: validProductInput,
    });
    const productId = addResult.product!.id;
    const admin = makeAdmin({ id: 'admin-1', role: 'admin' });

    const statusResult = await handleMutate({ repo, user: admin }, {
      action: 'SET_STATUS',
      setStatus: { productId, stock_status: 'out_of_stock' },
    });

    expect(statusResult.success).toBe(true);
    expect(statusResult.product?.stock_status).toBe('out_of_stock');
  });

  it('rejects regular-admin product changes beyond stock status', async () => {
    const admin = makeAdmin({ id: 'admin-1', role: 'admin' });
    const result = await handleMutate({ repo, user: admin }, {
      action: 'DELETE',
      productId: 'product-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('superadmin');
  });

  it('rejects ADD with invalid payload (missing name)', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: { ...validProductInput, name: '' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Name is required');
  });

  it('rejects ADD with invalid price (zero)', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: { ...validProductInput, price_paise: 0 },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Price must be positive');
  });

  it('rejects ADD with invalid image_url', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: { ...validProductInput, image_url: 'not-a-url' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('valid URL');
  });

  it('rejects ADD without product data', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product is required');
  });

  it('successfully updates a product', async () => {
    const admin = makeAdmin();
    // First add
    const addResult = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: validProductInput,
    });
    expect(addResult.success).toBe(true);
    const productId = addResult.product!.id;

    // Then update
    const updateResult = await handleMutate({ repo, user: admin }, {
      action: 'UPDATE',
      product: { ...validProductInput, id: productId, name: 'Updated Name' },
    });
    expect(updateResult.success).toBe(true);
    expect(updateResult.product?.name).toBe('Updated Name');
  });

  it('rejects UPDATE for non-existent product', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'UPDATE',
      product: { ...validProductInput, id: 'nonexistent' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product not found');
  });

  it('rejects UPDATE without product id', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'UPDATE',
      product: validProductInput,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product id is required');
  });

  it('successfully deletes a product', async () => {
    const admin = makeAdmin();
    // First add
    const addResult = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: validProductInput,
    });
    const productId = addResult.product!.id;

    // Then delete
    const deleteResult = await handleMutate({ repo, user: admin }, {
      action: 'DELETE',
      productId,
    });
    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    const found = await repo.getProductById(productId);
    expect(found).toBeNull();
  });

  it('rejects DELETE for non-existent product', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'DELETE',
      productId: 'nonexistent',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product not found');
  });

  it('rejects DELETE without productId', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'DELETE',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('productId is required');
  });

  it('rebuilds KV cache after mutation', async () => {
    const admin = makeAdmin();
    const result = await handleMutate({ repo, user: admin }, {
      action: 'ADD',
      product: validProductInput,
    });
    expect(result.success).toBe(true);

    // Verify catalog reflects the new product
    const catalog = await repo.getCatalog();
    expect(catalog.products.some((p) => p.name === 'Test Product')).toBe(true);
  });
});
