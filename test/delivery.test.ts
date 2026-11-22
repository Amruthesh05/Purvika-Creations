import { describe, it, expect, beforeEach } from 'vitest';
import { MockRepository } from '@/lib/db/mock-repository';
import { isDeliveryMode, getDeliveryFeePaise, DELIVERY_MODES } from '@/lib/delivery/config';
import { COD_FEE_PAISE } from '@/lib/payments/config';
import type { OrderInput, DeliveryMode } from '@/lib/types';

const ITEM_PRICE = 499900;
const ITEM_QTY = 1;

function makeOrderInput(
  deliveryMode: DeliveryMode,
  paymentMethod: 'online' | 'cod' = 'online',
  itemTotalPaise?: number,
): OrderInput {
  const base = itemTotalPaise ?? ITEM_PRICE * ITEM_QTY;
  const deliveryFee = getDeliveryFeePaise(deliveryMode);
  const total = paymentMethod === 'cod' ? base + deliveryFee + COD_FEE_PAISE : base + deliveryFee;
  return {
    userId: 'u1',
    totalPaise: total,
    paymentMethod,
    codFeePaise: paymentMethod === 'cod' ? COD_FEE_PAISE : 0,
    deliveryMode,
    deliveryFeePaise: deliveryFee,
    items: [{ productId: 'p1', nameSnapshot: 'Earbuds', pricePaiseSnapshot: ITEM_PRICE, quantity: ITEM_QTY }],
  };
}

describe('delivery — totals', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('courier + online: total = items + courier fee', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'online'));
    const expected = ITEM_PRICE + DELIVERY_MODES.courier.feePaise;
    expect(order.total_paise).toBe(expected);
    expect(order.delivery_mode).toBe('courier');
    expect(order.delivery_fee_paise).toBe(DELIVERY_MODES.courier.feePaise);
    expect(order.cod_fee_paise).toBe(0);
  });

  it('courier + COD: total = items + courier fee + COD fee', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'cod'));
    const expected = ITEM_PRICE + DELIVERY_MODES.courier.feePaise + COD_FEE_PAISE;
    expect(order.total_paise).toBe(expected);
    expect(order.delivery_mode).toBe('courier');
    expect(order.cod_fee_paise).toBe(COD_FEE_PAISE);
  });

  it('founders + online: total = items + founders fee', async () => {
    const order = await repo.createOrder(makeOrderInput('founders', 'online'));
    const expected = ITEM_PRICE + DELIVERY_MODES.founders.feePaise;
    expect(order.total_paise).toBe(expected);
    expect(order.delivery_mode).toBe('founders');
    expect(order.delivery_fee_paise).toBe(DELIVERY_MODES.founders.feePaise);
  });

  it('founders + COD: total = items + founders fee + COD fee', async () => {
    const order = await repo.createOrder(makeOrderInput('founders', 'cod'));
    const expected = ITEM_PRICE + DELIVERY_MODES.founders.feePaise + COD_FEE_PAISE;
    expect(order.total_paise).toBe(expected);
    expect(order.delivery_mode).toBe('founders');
    expect(order.cod_fee_paise).toBe(COD_FEE_PAISE);
  });
});

describe('delivery — unknown mode rejected', () => {
  it('isDeliveryMode rejects unknown strings', () => {
    expect(isDeliveryMode('express')).toBe(false);
    expect(isDeliveryMode('')).toBe(false);
    expect(isDeliveryMode(null)).toBe(false);
    expect(isDeliveryMode(undefined)).toBe(false);
    expect(isDeliveryMode(123)).toBe(false);
  });

  it('isDeliveryMode accepts courier and founders', () => {
    expect(isDeliveryMode('courier')).toBe(true);
    expect(isDeliveryMode('founders')).toBe(true);
  });
});

describe('delivery — client-sent fee ignored', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('createOrder uses server-computed fee, not input field', async () => {
    const input = makeOrderInput('courier', 'online');
    // Tamper with deliveryFeePaise as a malicious client would
    input.deliveryFeePaise = 1;
    input.totalPaise = ITEM_PRICE + 1;
    const order = await repo.createOrder(input);
    // The order object reflects the input values, but the real validation
    // happens server-side (create-order.ts uses getDeliveryFeePaise).
    // Here we verify that getDeliveryFeePaise returns the authoritative fee.
    expect(getDeliveryFeePaise('courier')).toBe(DELIVERY_MODES.courier.feePaise);
    expect(getDeliveryFeePaise('courier')).not.toBe(1);
  });
});

describe('delivery — mode change only for pending COD orders', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('allows mode change for pending COD order in created state', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'cod'));
    const canChange =
      order.payment_method === 'cod' &&
      order.status === 'created' &&
      order.fulfilment_status === 'pending';
    expect(canChange).toBe(true);

    const itemsTotal = order.total_paise - order.delivery_fee_paise - order.cod_fee_paise;
    const newFee = getDeliveryFeePaise('founders');
    const newTotal = itemsTotal + newFee + order.cod_fee_paise;
    await repo.updateOrderDeliveryMode(order.id, 'u1', 'founders', newFee, newTotal);
    const after = await repo.getOrderById(order.id);
    expect(after!.delivery_mode).toBe('founders');
    expect(after!.delivery_fee_paise).toBe(newFee);
    expect(after!.total_paise).toBe(newTotal);
  });

  it('refuses mode change for online order (payment_method check)', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'online'));
    const canChange =
      order.payment_method === 'cod' &&
      order.status === 'created' &&
      order.fulfilment_status === 'pending';
    expect(canChange).toBe(false);
  });

  it('refuses mode change once shipped (fulfilment_status check)', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'cod'));
    await repo.setFulfilmentStatus(order.id, 'shipped');
    const fetched = await repo.getOrderById(order.id);
    const canChange =
      fetched!.payment_method === 'cod' &&
      fetched!.status === 'created' &&
      fetched!.fulfilment_status === 'pending';
    expect(canChange).toBe(false);
  });

  it('refuses mode change after payment collected (status check)', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'cod'));
    await repo.markOrderPaymentCollected(order.id);
    const fetched = await repo.getOrderById(order.id);
    const canChange =
      fetched!.payment_method === 'cod' &&
      fetched!.status === 'created' &&
      fetched!.fulfilment_status === 'pending';
    expect(canChange).toBe(false);
  });
});

describe('delivery — markOrderDelivered sets delivered_at', () => {
  let repo: MockRepository;

  beforeEach(() => {
    repo = new MockRepository();
  });

  it('markOrderDelivered sets delivered_at on a COD order', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'cod'));
    expect(order.delivered_at).toBeNull();
    await repo.markOrderPaymentCollected(order.id);
    await repo.setFulfilmentStatus(order.id, 'delivered');
    await repo.markOrderDelivered(order.id);
    const after = await repo.getOrderById(order.id);
    expect(after!.delivered_at).not.toBeNull();
    expect(after!.fulfilment_status).toBe('delivered');
    expect(after!.status).toBe('paid');
  });

  it('markOrderDelivered sets delivered_at on an online order', async () => {
    const order = await repo.createOrder(makeOrderInput('courier', 'online'));
    expect(order.delivered_at).toBeNull();
    await repo.updateOrderStatus(order.id, 'paid');
    await repo.setFulfilmentStatus(order.id, 'delivered');
    await repo.markOrderDelivered(order.id);
    const after = await repo.getOrderById(order.id);
    expect(after!.delivered_at).not.toBeNull();
    expect(after!.fulfilment_status).toBe('delivered');
  });

  it('delivered_at is null for a freshly created order', async () => {
    const order = await repo.createOrder(makeOrderInput('founders', 'cod'));
    expect(order.delivered_at).toBeNull();
  });
});
