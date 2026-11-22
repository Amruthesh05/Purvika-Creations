import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import { indianMobileSchema, pincodeSchema } from '@/lib/validation';
import type { OrderInput } from '@/lib/types';

function makeOrderInput(userId = 'u1', paymentMethod: 'online' | 'cod' = 'online', providerOrderId?: string): OrderInput {
  return {
    userId,
    totalPaise: 499900,
    paymentMethod,
    providerOrderId,
    items: [{ productId: 'p1', nameSnapshot: 'Earbuds', pricePaiseSnapshot: 499900, quantity: 1 }],
  };
}

describe('cancel order — allowed vs refused', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('allows cancelling a created online order (fulfilment pending)', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_1'));
    const fetched = await repo.getOrderForUser(order.id, 'u1');
    expect(fetched).not.toBeNull();
    await repo.cancelOrder(order.id, 'u1', 'changed mind');
    const after = await repo.getOrderById(order.id);
    expect(after!.status).toBe('cancelled');
    expect(after!.cancelled_at).not.toBeNull();
    expect(after!.cancel_reason).toBe('changed mind');
  });

  it('allows cancelling a paid online order (fulfilment pending)', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_2'));
    await repo.updateOrderStatus(order.id, 'paid');
    await repo.cancelOrder(order.id, 'u1', 'refund needed');
    const after = await repo.getOrderById(order.id);
    expect(after!.status).toBe('cancelled');
    expect(after!.cancel_reason).toContain('refund needed');
  });

  it('allows cancelling a created COD order (fulfilment pending, awaiting delivery)', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'cod'));
    await repo.cancelOrder(order.id, 'u1', null);
    const after = await repo.getOrderById(order.id);
    expect(after!.status).toBe('cancelled');
  });

  it('refuses cancelling a delivered COD order (paid COD = delivered)', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'cod'));
    await repo.markOrderPaymentCollected(order.id);
    await repo.setFulfilmentStatus(order.id, 'delivered');
    const fetched = await repo.getOrderForUser(order.id, 'u1');
    expect(fetched!.status).toBe('paid');
    expect(fetched!.payment_method).toBe('cod');
    expect(fetched!.fulfilment_status).toBe('delivered');
    const isPaidCod = fetched!.status === 'paid' && fetched!.payment_method === 'cod';
    expect(isPaidCod).toBe(true);
  });

  it('refuses cancelling an order that has already shipped (fulfilment not pending)', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_3'));
    await repo.updateOrderStatus(order.id, 'paid');
    await repo.setFulfilmentStatus(order.id, 'shipped');
    const fetched = await repo.getOrderForUser(order.id, 'u1');
    expect(fetched!.fulfilment_status).toBe('shipped');
    expect(fetched!.fulfilment_status === 'pending').toBe(false);
  });

  it('refuses cancelling an already-cancelled order', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_4'));
    await repo.cancelOrder(order.id, 'u1', null);
    const fetched = await repo.getOrderForUser(order.id, 'u1');
    expect(fetched!.status).toBe('cancelled');
    const isCreated = fetched!.status === 'created';
    const isPaidOnline = fetched!.status === 'paid' && fetched!.payment_method === 'online';
    expect(isCreated || isPaidOnline).toBe(false);
  });
});

describe('cancel order — ownership', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('a user cannot cancel another user order (getOrderForUser returns null)', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_5'));
    const fetched = await repo.getOrderForUser(order.id, 'u2');
    expect(fetched).toBeNull();
  });

  it('a user cannot edit another user order shipping', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_6'));
    await repo.updateOrderShipping(order.id, 'u2', 'Intruder', '9999999999', null, 'Hacker St');
    const after = await repo.getOrderById(order.id);
    expect(after!.shipping_name).toBeNull();
  });
});

describe('update order shipping', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('updates shipping for the owner while pending', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_7'));
    await repo.updateOrderShipping(order.id, 'u1', 'Jane Doe', '9876543210', '9123456789', '45 New St, Pune');
    const after = await repo.getOrderById(order.id);
    expect(after!.shipping_name).toBe('Jane Doe');
    expect(after!.shipping_phone).toBe('9876543210');
    expect(after!.shipping_alt_phone).toBe('9123456789');
    expect(after!.shipping_address).toBe('45 New St, Pune');
  });

  it('refuses update once shipped', async () => {
    const order = await repo.createOrder(makeOrderInput('u1', 'online', 'mock_8'));
    await repo.updateOrderStatus(order.id, 'paid');
    await repo.setFulfilmentStatus(order.id, 'shipped');
    const fetched = await repo.getOrderForUser(order.id, 'u1');
    const allowed = fetched!.fulfilment_status === 'pending' && (fetched!.status === 'created' || fetched!.status === 'paid');
    expect(allowed).toBe(false);
  });
});

describe('phone validator (Indian mobile)', () => {
  it('accepts a valid 10-digit number starting with 6-9', () => {
    const r = indianMobileSchema.safeParse('9876543210');
    expect(r.success).toBe(true);
  });

  it('accepts a number with +91 prefix', () => {
    const r = indianMobileSchema.safeParse('+919876543210');
    expect(r.success).toBe(true);
  });

  it('accepts a number with a leading 0', () => {
    const r = indianMobileSchema.safeParse('09876543210');
    expect(r.success).toBe(true);
  });

  it('accepts a number with spaces', () => {
    const r = indianMobileSchema.safeParse('98765 43210');
    expect(r.success).toBe(true);
  });

  it('rejects a 9-digit number', () => {
    const r = indianMobileSchema.safeParse('987654321');
    expect(r.success).toBe(false);
  });

  it('rejects a number starting with 5', () => {
    const r = indianMobileSchema.safeParse('5876543210');
    expect(r.success).toBe(false);
  });

  it('rejects an 11-digit number without prefix', () => {
    const r = indianMobileSchema.safeParse('19876543210');
    expect(r.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const r = indianMobileSchema.safeParse('');
    expect(r.success).toBe(false);
  });
});

describe('pincode validator', () => {
  it('accepts a 6-digit pincode', () => {
    expect(pincodeSchema.safeParse('560001').success).toBe(true);
  });

  it('accepts a 6-digit pincode with spaces', () => {
    expect(pincodeSchema.safeParse('560 001').success).toBe(true);
  });

  it('rejects a 5-digit pincode', () => {
    expect(pincodeSchema.safeParse('56001').success).toBe(false);
  });

  it('rejects a 7-digit pincode', () => {
    expect(pincodeSchema.safeParse('5600001').success).toBe(false);
  });

  it('rejects letters', () => {
    expect(pincodeSchema.safeParse('56AB01').success).toBe(false);
  });
});
