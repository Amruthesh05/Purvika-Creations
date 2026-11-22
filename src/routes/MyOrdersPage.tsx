import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { EmptyState, ErrorState } from '@/components/States';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatINR, formatDate, classNames } from '@/lib/utils';
import { DELIVERY_MODES } from '@/lib/delivery/config';
import { apiFetch, apiPost, ApiError } from '@/lib/api';
import type { OrderWithItems, User, PaymentMethod, DeliveryMode, Preorder } from '@/lib/types';

interface MyOrdersPageProps {
  user: User | null | undefined;
}

function statusLabel(order: OrderWithItems): { text: string; className: string } {
  if (order.status === 'cancelled') return { text: 'Cancelled', className: 'bg-gray-100 text-gray-700' };
  if (order.payment_method === 'cod') {
    if (order.status === 'paid') return { text: 'Delivered - cash collected', className: 'bg-green-50 text-green-700' };
    return { text: 'Placed - pay on delivery', className: 'bg-amber-50 text-amber-700' };
  }
  if (order.status === 'paid') return { text: 'Paid', className: 'bg-green-50 text-green-700' };
  if (order.status === 'failed') return { text: 'Payment failed', className: 'bg-red-50 text-red-700' };
  return { text: 'Awaiting payment', className: 'bg-amber-50 text-amber-700' };
}

function canCancel(order: OrderWithItems): boolean {
  if (order.status === 'cancelled') return false;
  if (order.fulfilment_status !== 'pending') return false;
  if (order.payment_method === 'online' && order.status === 'paid') return true;
  return order.status === 'created';
}

function canEditShipping(order: OrderWithItems): boolean {
  if (order.status === 'cancelled') return false;
  if (order.fulfilment_status !== 'pending') return false;
  return order.status === 'created' || (order.payment_method === 'online' && order.status === 'paid');
}

export function MyOrdersPage({ user }: MyOrdersPageProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderWithItems | null>(null);
  const [editTarget, setEditTarget] = useState<OrderWithItems | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', altPhone: '', address: '', deliveryMode: 'courier' as DeliveryMode });
  const [editError, setEditError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [d, p] = await Promise.all([apiFetch('/api/orders/mine') as Promise<{ orders: OrderWithItems[] }>, apiFetch('/api/preorders/mine') as Promise<{ preorders: Preorder[] }>]);
      setOrders(d.orders ?? []);
      setPreorders(p.preorders ?? []);
    } catch {
      setError('Failed to load your orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setActioningId(cancelTarget.id);
    setError(null);
    try {
      await apiPost('/api/orders/cancel', { orderId: cancelTarget.id });
      await loadOrders();
      setCancelTarget(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.code === 'already_cancelled' || err.code === 'cannot_cancel_in_current_state')) {
        setError('This order can no longer be cancelled.');
      } else {
        setError('Could not cancel this order. Please try again.');
      }
    } finally {
      setActioningId(null);
    }
  };

  const openEdit = (order: OrderWithItems) => {
    setEditTarget(order);
    setEditForm({
      name: order.shipping_name ?? '',
      phone: order.shipping_phone ?? '',
      altPhone: order.shipping_alt_phone ?? '',
      address: order.shipping_address ?? '',
      deliveryMode: (order.delivery_mode as DeliveryMode) ?? 'courier',
    });
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setActioningId(editTarget.id);
    setEditError(null);
    try {
      await apiPost('/api/orders/update-shipping', {
        orderId: editTarget.id,
        name: editForm.name,
        phone: editForm.phone,
        altPhone: editForm.altPhone || undefined,
        address: editForm.address,
        deliveryMode: editTarget.payment_method === 'online' ? undefined : editForm.deliveryMode,
      });
      await loadOrders();
      setEditTarget(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'delivery_mode_locked_for_online') {
          setEditError('Delivery mode cannot be changed for online orders. Please cancel and reorder.');
        } else if (err.code === 'delivery_mode_locked_after_payment') {
          setEditError('Delivery mode cannot be changed after payment is collected.');
        } else if (err.status === 409 || err.code === 'cannot_update_in_current_state') {
          setEditError('This order can no longer be edited.');
        } else {
          setEditError('Could not update the order. Please check your details.');
        }
      } else {
        setEditError('Could not update the order.');
      }
    } finally {
      setActioningId(null);
    }
  };

  if (user === undefined) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex min-h-[200px] items-center justify-center">
            <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="mb-2 text-xl font-bold text-gray-900">Sign in to view your orders</h1>
            <p className="mb-6 text-sm text-gray-500">You need to be signed in to see your order history.</p>
            <Link to="/login?return=/my-orders" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
              Go to sign in
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">My Orders</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {preorders.length > 0 && <section className="mb-8"><h2 className="mb-3 text-lg font-bold text-gray-900">My pre-registrations</h2><div className="space-y-3">{preorders.map((p) => <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"><div><p className="font-medium text-gray-900">{p.product_name ?? p.product_id}</p><p className="text-xs text-gray-500">Quantity {p.quantity} · {formatDate(p.created_at)}</p></div><div className="flex items-center gap-3"><span className={classNames('rounded-full px-2 py-1 text-xs font-medium', p.status === 'registered' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600')}>{p.status}</span>{p.status === 'registered' && <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={async () => { await apiPost('/api/preorders/cancel', { preorderId: p.id }); await loadOrders(); }}>Cancel registration</Button>}</div></div>)}</div></section>}

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState message="You have not placed any orders yet." />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const badge = statusLabel(order);
              const methodLabel: Record<PaymentMethod, string> = { online: 'Online payment', cod: 'Cash on delivery' };
              const isPaidCod = order.status === 'paid' && order.payment_method === 'cod';
              const showCancel = canCancel(order) && !isPaidCod;
              const showEdit = canEditShipping(order);
              return (
                <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-gray-400">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                    </div>
                    <span className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', badge.className)}>
                      {badge.text}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.name_snapshot} {item.variant_value && <span className="text-gray-500">· {item.variant_label || 'Size'}: {item.variant_value}</span>} <span className="text-gray-400">× {item.quantity}</span></span>
                        <span className="text-gray-600">{formatINR(item.price_paise_snapshot * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                      <span>{methodLabel[order.payment_method]}</span>
                      <span>{DELIVERY_MODES[order.delivery_mode as DeliveryMode]?.label ?? order.delivery_mode} · {formatINR(order.delivery_fee_paise ?? 0)}</span>
                      {order.cod_fee_paise > 0 && (
                        <span>COD handling: {formatINR(order.cod_fee_paise)}</span>
                      )}
                    </div>
                    {order.shipping_name && (
                      <p className="text-xs text-gray-400">
                        Ship to: {order.shipping_name}, {order.shipping_phone}
                        {order.shipping_alt_phone ? `, alt {order.shipping_alt_phone}` : ''} — {order.shipping_address}
                      </p>
                    )}
                    {order.cancelled_at && (
                      <p className="text-xs text-gray-400">Cancelled on {formatDate(order.cancelled_at)}{order.cancel_reason ? ` — ${order.cancel_reason}` : ''}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total</span>
                      <span className="text-lg font-bold text-gray-900">{formatINR(order.total_paise)}</span>
                    </div>
                    {(showCancel || showEdit) && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {showEdit && (
                          <Button variant="secondary" onClick={() => openEdit(order)} disabled={actioningId === order.id} className="px-3 py-1.5 text-xs">
                            Change address
                          </Button>
                        )}
                        {showCancel && (
                          <Button variant="danger" onClick={() => setCancelTarget(order)} disabled={actioningId === order.id} className="px-3 py-1.5 text-xs">
                            Cancel order
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel this order?"
        message={
          cancelTarget
            ? cancelTarget.payment_method === 'online' && cancelTarget.status === 'paid'
              ? 'A refund will be initiated for your online payment. This cannot be undone.'
              : 'This will cancel your order. This cannot be undone.'
            : ''
        }
        confirmLabel="Cancel order"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Update order details</h2>
            {editError && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{editError}</p>}
            <div className="space-y-3">
              <Field label="Full name" name="name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
              <Field label="Phone number" name="phone" type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required />
              <Field label="Alternate phone (optional)" name="altPhone" type="tel" value={editForm.altPhone} onChange={(e) => setEditForm({ ...editForm, altPhone: e.target.value })} />
              <Field label="Shipping address" name="address" type="textarea" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} required />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Delivery method</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  value={editForm.deliveryMode}
                  onChange={(e) => setEditForm({ ...editForm, deliveryMode: e.target.value as DeliveryMode })}
                  disabled={editTarget.payment_method === 'online'}
                >
                  <option value="courier">Courier (Rs 20)</option>
                  <option value="founders">Delivery by the founders (Rs 200)</option>
                </select>
                {editTarget.payment_method === 'online' && (
                  <p className="mt-1 text-xs text-gray-400">Delivery mode is locked for online orders.</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditTarget(null)} disabled={actioningId === editTarget.id}>Cancel</Button>
              <Button onClick={handleSaveEdit} loading={actioningId === editTarget.id}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

void Package;
