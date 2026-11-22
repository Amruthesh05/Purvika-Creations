import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import type { OrderInput } from '@/lib/types';

describe('MockRepository — orders', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('createOrder stores order with items and returns them', async () => {
    const input: OrderInput = {
      userId: 'u1',
      totalPaise: 749800,
      items: [
        { productId: 'p1', nameSnapshot: 'Earbuds', pricePaiseSnapshot: 499900, quantity: 1 },
        { productId: 'p2', nameSnapshot: 'Watch', pricePaiseSnapshot: 249900, quantity: 1 },
      ],
    };

    const order = await repo.createOrder(input);
    expect(order.id).toBeTruthy();
    expect(order.user_id).toBe('u1');
    expect(order.status).toBe('created');
    expect(order.total_paise).toBe(749800);
    expect(order.razorpay_order_id).toBeNull();
    expect(order.items).toHaveLength(2);
    expect(order.items[0].product_id).toBe('p1');
    expect(order.items[0].name_snapshot).toBe('Earbuds');
    expect(order.items[0].quantity).toBe(1);
    expect(order.items[1].product_id).toBe('p2');
  });

  it('getOrderById retrieves a created order with items', async () => {
    const input: OrderInput = {
      userId: 'u1',
      totalPaise: 499900,
      items: [
        { productId: 'p1', nameSnapshot: 'Earbuds', pricePaiseSnapshot: 499900, quantity: 1 },
      ],
    };

    const created = await repo.createOrder(input);
    const fetched = await repo.getOrderById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.items).toHaveLength(1);
    expect(fetched!.items[0].name_snapshot).toBe('Earbuds');
  });

  it('getOrderById returns null for unknown id', async () => {
    const fetched = await repo.getOrderById('nonexistent');
    expect(fetched).toBeNull();
  });

  it('getOrdersByUser returns only orders for that user, newest first', async () => {
    const input1: OrderInput = {
      userId: 'u1',
      totalPaise: 100,
      items: [{ productId: 'p1', nameSnapshot: 'A', pricePaiseSnapshot: 100, quantity: 1 }],
    };
    const input2: OrderInput = {
      userId: 'u2',
      totalPaise: 200,
      items: [{ productId: 'p2', nameSnapshot: 'B', pricePaiseSnapshot: 200, quantity: 1 }],
    };
    const input3: OrderInput = {
      userId: 'u1',
      totalPaise: 300,
      items: [{ productId: 'p2', nameSnapshot: 'C', pricePaiseSnapshot: 300, quantity: 1 }],
    };

    const o1 = await repo.createOrder(input1);
    await new Promise((r) => setTimeout(r, 5));
    await repo.createOrder(input2);
    await new Promise((r) => setTimeout(r, 5));
    const o3 = await repo.createOrder(input3);

    const userOrders = await repo.getOrdersByUser('u1');
    expect(userOrders).toHaveLength(2);
    expect(userOrders[0].id).toBe(o3.id);
    expect(userOrders[1].id).toBe(o1.id);
  });

  it('getOrdersByUser returns empty array for user with no orders', async () => {
    const orders = await repo.getOrdersByUser('u-nobody');
    expect(orders).toEqual([]);
  });

  it('getAllOrders returns all orders regardless of user', async () => {
    await repo.createOrder({ userId: 'u1', totalPaise: 100, items: [{ productId: 'p1', nameSnapshot: 'A', pricePaiseSnapshot: 100, quantity: 1 }] });
    await repo.createOrder({ userId: 'u2', totalPaise: 200, items: [{ productId: 'p2', nameSnapshot: 'B', pricePaiseSnapshot: 200, quantity: 1 }] });

    const all = await repo.getAllOrders();
    expect(all).toHaveLength(2);
  });

  it('updateOrderStatus changes the status', async () => {
    const order = await repo.createOrder({
      userId: 'u1',
      totalPaise: 100,
      items: [{ productId: 'p1', nameSnapshot: 'A', pricePaiseSnapshot: 100, quantity: 1 }],
    });
    expect(order.status).toBe('created');

    await repo.updateOrderStatus(order.id, 'paid');
    const fetched = await repo.getOrderById(order.id);
    expect(fetched!.status).toBe('paid');
  });

  it('createOrder stores shipping fields', async () => {
    const order = await repo.createOrder({
      userId: 'u1',
      totalPaise: 100,
      shippingName: 'John Doe',
      shippingPhone: '9876543210',
      shippingAddress: '123 Main St, Mumbai',
      items: [{ productId: 'p1', nameSnapshot: 'A', pricePaiseSnapshot: 100, quantity: 1 }],
    });
    expect(order.shipping_name).toBe('John Doe');
    expect(order.shipping_phone).toBe('9876543210');
    expect(order.shipping_address).toBe('123 Main St, Mumbai');
  });
});
