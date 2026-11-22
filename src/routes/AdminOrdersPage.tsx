import { useState, useEffect, useCallback } from 'react';
import { Package, Search, Printer, X, ChevronRight } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { Button } from '@/components/Button';
import { ErrorState, EmptyState } from '@/components/States';
import { formatINR, formatDate, classNames } from '@/lib/utils';
import { apiFetch, apiPost } from '@/lib/api';
import type { OrderWithItems, User, PaymentMethod } from '@/lib/types';

interface AdminOrdersPageProps {
  currentUser: User;
}

function statusBadge(order: OrderWithItems): { text: string; className: string } {
  if (order.payment_method === 'cod') {
    if (order.status === 'paid') return { text: 'Delivered', className: 'bg-green-50 text-green-700' };
    return { text: 'Awaiting delivery', className: 'bg-amber-50 text-amber-700' };
  }
  if (order.status === 'paid') return { text: 'Paid', className: 'bg-green-50 text-green-700' };
  if (order.status === 'failed') return { text: 'Failed', className: 'bg-red-50 text-red-700' };
  return { text: 'Awaiting payment', className: 'bg-amber-50 text-amber-700' };
}

function fulfilmentBadge(order: OrderWithItems): { text: string; className: string } {
  if (order.fulfilment_status === 'delivered') return { text: 'Delivered', className: 'bg-green-50 text-green-700' };
  if (order.fulfilment_status === 'shipped') return { text: 'Shipped', className: 'bg-blue-50 text-blue-700' };
  return { text: 'Pending', className: 'bg-gray-100 text-gray-600' };
}

export function AdminOrdersPage({ currentUser }: AdminOrdersPageProps) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/admin/orders') as { orders: OrderWithItems[] };
      setOrders(data.orders ?? []);
    } catch {
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleMarkShipped = async (orderId: string) => {
    setActioningId(orderId);
    try {
      await apiPost('/api/admin/order-status', { orderId, action: 'mark_shipped' });
      await loadOrders();
      setSelectedOrder((prev) => prev ? orders.find((o) => o.id === orderId) ?? prev : prev);
    } catch {
      setError('Failed to mark order as shipped.');
    } finally {
      setActioningId(null);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    setActioningId(orderId);
    try {
      await apiPost('/api/admin/order-status', { orderId, action: 'mark_delivered' });
      await loadOrders();
      setSelectedOrder((prev) => prev ? orders.find((o) => o.id === orderId) ?? prev : prev);
    } catch {
      setError('Failed to mark order as delivered.');
    } finally {
      setActioningId(null);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      order.id.toLowerCase().includes(q) ||
      (order.shipping_name ?? '').toLowerCase().includes(q) ||
      (order.shipping_phone ?? '').toLowerCase().includes(q)
    );
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <AdminLayout currentUser={currentUser}>
      <div className="mb-6 flex items-center gap-2">
        <Package className="h-5 w-5 text-gray-700" />
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Orders</h1>
      </div>

      <div className="no-print mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by order ID, customer name or phone"
          className="w-full max-w-md rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <ErrorState message={error}>
          <Button onClick={loadOrders}>Try again</Button>
        </ErrorState>
      ) : filteredOrders.length === 0 ? (
        <EmptyState message={searchQuery ? 'No orders match your search.' : 'No orders yet.'} />
      ) : (
        <div className="no-print overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const badge = statusBadge(order);
                  const fBadge = fulfilmentBadge(order);
                  const methodLabel: Record<PaymentMethod, string> = { online: 'Online', cod: 'COD' };
                  return (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">#{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-700">{order.shipping_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{order.shipping_phone ?? ''}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-700">{methodLabel[order.payment_method]}</span>
                        {order.cod_fee_paise > 0 && (
                          <p className="text-xs text-gray-400">+{formatINR(order.cod_fee_paise)} fee</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={classNames('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>
                            {badge.text}
                          </span>
                          <span className={classNames('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', fBadge.className)}>
                            {fBadge.text}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{formatINR(order.total_paise)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => setSelectedOrder(order)}
                            className="px-3 py-1.5 text-xs"
                          >
                            Details
                          </Button>
                          {order.payment_method === 'cod' && order.status !== 'paid' && (
                            <Button
                              variant="secondary"
                              onClick={() => handleMarkDelivered(order.id)}
                              loading={actioningId === order.id}
                              className="px-3 py-1.5 text-xs"
                            >
                              Mark delivered
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onMarkShipped={handleMarkShipped}
          onMarkDelivered={handleMarkDelivered}
          onPrint={handlePrint}
          actioningId={actioningId}
        />
      )}
    </AdminLayout>
  );
}

function OrderDetailPanel({
  order,
  onClose,
  onMarkShipped,
  onMarkDelivered,
  onPrint,
  actioningId,
}: {
  order: OrderWithItems;
  onClose: () => void;
  onMarkShipped: (id: string) => void;
  onMarkDelivered: (id: string) => void;
  onPrint: () => void;
  actioningId: string | null;
}) {
  const badge = statusBadge(order);
  const fBadge = fulfilmentBadge(order);
  const methodLabel: Record<PaymentMethod, string> = { online: 'Online payment', cod: 'Cash on delivery' };
  const itemsTotal = order.items.reduce((sum, i) => sum + i.price_paise_snapshot * i.quantity, 0);
  const canShip = order.fulfilment_status === 'pending';
  const canDeliver = order.fulfilment_status !== 'delivered' && (order.payment_method !== 'cod' || order.status !== 'paid');

  return (
    <>
      <div className="no-print fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 print:p-0 print:static print:overflow-visible">
        <div className="packing-slip w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl print:shadow-none print:rounded-none print:w-full print:max-w-none">
          {/* Header */}
          <div className="no-print flex items-center justify-between border-b border-gray-200 pb-4">
            <h2 className="text-lg font-bold text-gray-900">Order Details</h2>
            <button onClick={onClose} className="text-gray-400 transition-colors hover:text-gray-600" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Print header */}
          <div className="hidden print:block mb-6 pb-4 border-b border-gray-300">
            <h1 className="text-2xl font-bold text-black">Packing Slip</h1>
            <p className="text-sm text-gray-700">Order #{order.id}</p>
          </div>

          {/* Order meta */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm print:mt-0">
            <div>
              <p className="text-xs uppercase text-gray-500">Order ID</p>
              <p className="font-medium text-gray-900">#{order.id}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500">Date</p>
              <p className="font-medium text-gray-900">{formatDate(order.created_at)}</p>
            </div>
          </div>

          {/* Status chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={classNames('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium', badge.className)}>
              {badge.text}
            </span>
            <span className={classNames('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium', fBadge.className)}>
              {fBadge.text}
            </span>
          </div>

          {/* Customer info */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-4 print:bg-transparent print:p-0">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Customer</p>
              <p className="text-sm text-gray-900">{order.shipping_name ?? '—'}</p>
              <p className="text-sm text-gray-700">{order.shipping_phone ?? '—'}</p>
              {order.shipping_alt_phone && (
                <p className="text-sm text-gray-500">Alt: {order.shipping_alt_phone}</p>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 p-4 print:bg-transparent print:p-0">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Shipping Address</p>
              <p className="text-sm text-gray-700">{order.shipping_address ?? '—'}</p>
            </div>
          </div>

          {/* Delivery & payment */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Delivery</p>
              <p className="text-sm text-gray-900 capitalize">{order.delivery_mode} — {formatINR(order.delivery_fee_paise)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Payment</p>
              <p className="text-sm text-gray-900">{methodLabel[order.payment_method]}</p>
              {order.cod_fee_paise > 0 && (
                <p className="text-xs text-gray-500">COD handling: {formatINR(order.cod_fee_paise)}</p>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="mt-5 overflow-hidden rounded-lg border border-gray-200 print:border-gray-300">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 print:bg-transparent">
                <tr>
                  <th className="py-2 px-3">Item</th>
                  <th className="py-2 px-3">Option</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 print:border-gray-200">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        {item.product_id && (
                          <span className="text-gray-900">{item.name_snapshot}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {item.variant_label && item.variant_value ? `${item.variant_label}: ${item.variant_value}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center text-gray-700">{item.quantity}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{formatINR(item.price_paise_snapshot)}</td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900">{formatINR(item.price_paise_snapshot * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-4 space-y-1 border-t border-gray-200 pt-4 print:border-gray-300">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Items subtotal</span>
              <span>{formatINR(itemsTotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery fee</span>
              <span>{formatINR(order.delivery_fee_paise)}</span>
            </div>
            {order.cod_fee_paise > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>COD handling charge</span>
                <span>{formatINR(order.cod_fee_paise)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-bold text-gray-900">
              <span>Amount to collect</span>
              <span>{formatINR(order.total_paise)}</span>
            </div>
            {order.payment_method === 'cod' && order.status !== 'paid' && (
              <p className="pt-1 text-xs font-medium text-amber-700">Collect {formatINR(order.total_paise)} in cash on delivery</p>
            )}
          </div>

          {/* Actions */}
          <div className="no-print mt-6 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
            <Button variant="secondary" onClick={onPrint}>
              <Printer className="mr-1.5 h-4 w-4" /> Print packing slip
            </Button>
            <Button
              variant="secondary"
              onClick={() => onMarkShipped(order.id)}
              disabled={!canShip}
              loading={actioningId === order.id}
            >
              Mark shipped
            </Button>
            <Button
              onClick={() => onMarkDelivered(order.id)}
              disabled={!canDeliver}
              loading={actioningId === order.id}
            >
              Mark delivered
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

void ChevronRight;
