import { describe, expect, it } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import type { ProductInput } from '@/lib/types';

const productInput = (saleMode: ProductInput['saleMode'], preorderLimit: number | null = null): ProductInput => ({
  name: 'Launch product',
  description: 'A product for registration',
  price_paise: 10000,
  stock_status: 'in_stock',
  image_url: 'https://example.com/cover.jpg',
  imageUrls: [
    'https://example.com/cover.jpg',
    'https://example.com/second.jpg',
    'https://example.com/third.jpg',
  ],
  active: true,
  saleMode,
  preorderLimit,
});

describe('preorder registrations', () => {
  it('only treats preorder products as registration products', async () => {
    const repo = new MockRepository();
    const buy = await repo.addProduct(productInput('buy'));
    const open = await repo.addProduct(productInput('preorder'));
    const closed = await repo.addProduct(productInput('preorder_closed'));

    expect(buy.saleMode).toBe('buy');
    expect(open.saleMode).toBe('preorder');
    expect(closed.saleMode).toBe('preorder_closed');
  });

  it('enforces a registration limit through active registrations', async () => {
    const repo = new MockRepository();
    const product = await repo.addProduct(productInput('preorder', 1));
    const first = await repo.createUser('first@example.com');
    const second = await repo.createUser('second@example.com');

    await repo.createOrReactivatePreorder({ productId: product.id, userId: first.id, quantity: 1, name: 'First', phone: '9876543210' });
    expect(await repo.countActivePreorders(product.id)).toBe(1);
    expect(product.preorderLimit).toBe(1);
    expect(await repo.countActivePreorders(product.id)).toBeGreaterThanOrEqual(1);
    expect(second.id).not.toBe(first.id);
  });

  it('keeps one active registration per user and product', async () => {
    const repo = new MockRepository();
    const product = await repo.addProduct(productInput('preorder'));
    const user = await repo.createUser('buyer@example.com');

    const first = await repo.createOrReactivatePreorder({ productId: product.id, userId: user.id, quantity: 1, name: 'Buyer', phone: '9876543210' });
    const updated = await repo.createOrReactivatePreorder({ productId: product.id, userId: user.id, quantity: 3, name: 'Buyer', phone: '9876543210' });

    expect(updated.id).toBe(first.id);
    expect(await repo.getPreordersForUser(user.id)).toHaveLength(1);
    expect(updated.quantity).toBe(3);
  });

  it('cancels and reactivates a registration', async () => {
    const repo = new MockRepository();
    const product = await repo.addProduct(productInput('preorder'));
    const user = await repo.createUser('buyer@example.com');
    const registration = await repo.createOrReactivatePreorder({ productId: product.id, userId: user.id, quantity: 1, name: 'Buyer', phone: '9876543210' });

    await repo.cancelPreorder(registration.id, user.id);
    expect((await repo.getPreordersForUser(user.id))[0].status).toBe('cancelled');
    const reactivated = await repo.createOrReactivatePreorder({ productId: product.id, userId: user.id, quantity: 2, name: 'Buyer', phone: '9876543210' });
    expect(reactivated.id).toBe(registration.id);
    expect(reactivated.status).toBe('registered');
  });

  it('returns only the requesting user registrations', async () => {
    const repo = new MockRepository();
    const product = await repo.addProduct(productInput('preorder'));
    const first = await repo.createUser('first@example.com');
    const second = await repo.createUser('second@example.com');
    await repo.createOrReactivatePreorder({ productId: product.id, userId: first.id, quantity: 1, name: 'First', phone: '9876543210' });
    await repo.createOrReactivatePreorder({ productId: product.id, userId: second.id, quantity: 1, name: 'Second', phone: '9876543211' });

    const visible = await repo.getPreordersForUser(first.id);
    expect(visible).toHaveLength(1);
    expect(visible[0].user_id).toBe(first.id);
  });

  it('keeps closed and buy products out of registration and checkout modes', async () => {
    const repo = new MockRepository();
    const buy = await repo.addProduct(productInput('buy'));
    const closed = await repo.addProduct(productInput('preorder_closed'));

    expect(buy.saleMode).not.toBe('preorder');
    expect(closed.saleMode).not.toBe('preorder');
  });
});
