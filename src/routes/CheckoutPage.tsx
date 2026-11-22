import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { EmptyState, ErrorState } from '@/components/States';
import { formatINR } from '@/lib/utils';
import { apiPost, ApiError } from '@/lib/api';
import { useCartWithCatalog, useCart } from '@/lib/cart/context';
import { COD_FEE_PAISE, COD_MAX_ORDER_PAISE, isCodAvailable, mapCheckoutError } from '@/lib/payments/config';
import type { Product, User, PaymentMethod, Address } from '@/lib/types';

interface CreateOrderOnlineResponse {
  orderId: string;
  provider: 'mock' | 'razorpay';
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId?: string;
}

interface CreateOrderCodResponse {
  orderId: string;
  paymentMethod: 'cod';
  amount: number;
  codFeePaise: number;
}

type CreateOrderResponse = CreateOrderOnlineResponse | CreateOrderCodResponse;

const shippingSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().min(1, 'Phone is required').max(20),
  address: z.string().min(1, 'Address is required').max(2000),
});

type ShippingForm = z.infer<typeof shippingSchema>;

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  prefill?: { name?: string; contact?: string };
  theme?: { color?: string };
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (resp: { error: { code: string; description: string } }) => void): void;
}

function isCodResponse(r: CreateOrderResponse): r is CreateOrderCodResponse {
  return (r as CreateOrderCodResponse).paymentMethod === 'cod';
}

export function CheckoutPage() {
  const { clear } = useCart();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [form, setForm] = useState<ShippingForm>({ name: '', phone: '', address: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingForm, string>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfStockProduct, setOutOfStockProduct] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [orderResult, setOrderResult] = useState<CreateOrderResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'paid' | 'failed' | 'submitted'>('idle');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setUser(data.user as User | null))
      .catch(() => setUser(null));
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    fetch('/api/catalog')
      .then((res) => res.json())
      .then((data) => setProducts(data as Product[]))
      .catch(() => setProducts([]));
  }, []);

  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  useEffect(() => {
    if (!user) return;
    fetch('/api/account/addresses')
      .then((res) => res.json())
      .then((data) => setSavedAddresses((data as { addresses: Address[] }).addresses ?? []))
      .catch(() => setSavedAddresses([]));
  }, [user]);

  const defaultAddress = savedAddresses.find((a) => a.is_default);
  useEffect(() => {
    if (defaultAddress && !form.name && !form.phone && !form.address) {
      setForm({
        name: defaultAddress.name,
        phone: defaultAddress.phone,
        address: `${defaultAddress.address_line}, ${defaultAddress.city}, ${defaultAddress.state} - ${defaultAddress.pincode}`,
      });
    }
  }, [defaultAddress, form.name, form.phone, form.address]);

  const handleChooseSavedAddress = (addrId: string) => {
    setSelectedAddressId(addrId);
    if (!addrId) return;
    const addr = savedAddresses.find((a) => a.id === addrId);
    if (!addr) return;
    setForm({
      name: addr.name,
      phone: addr.phone,
      address: `${addr.address_line}, ${addr.city}, ${addr.state} - ${addr.pincode}`,
    });
  };

  const cartData = useCartWithCatalog(products);
  const cartItems = cartData.enriched;
  const subtotalPaise = cartData.subtotalPaise;

  const codAvailable = isCodAvailable(subtotalPaise, true);
  const codDisabledReason: string | null = !codAvailable
    ? subtotalPaise > COD_MAX_ORDER_PAISE
      ? 'Cash on delivery is only available for orders up to Rs 5,000.'
      : 'Cash on delivery is not available for this order.'
    : null;

  const effectivePaymentMethod: PaymentMethod =
    paymentMethod === 'cod' && !codAvailable ? 'online' : paymentMethod;

  const totalPaise = effectivePaymentMethod === 'cod' ? subtotalPaise + COD_FEE_PAISE : subtotalPaise;

  const validateForm = (): boolean => {
    const parsed = shippingSchema.safeParse(form);
    if (parsed.success) {
      setErrors({});
      return true;
    }
    const newErrors: Partial<Record<keyof ShippingForm, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ShippingForm;
      if (!newErrors[key]) newErrors[key] = issue.message;
    }
    setErrors(newErrors);
    return false;
  };

  const handleCreateOrder = useCallback(async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    setOutOfStockProduct(null);
    try {
      const body = {
        items: cartItems.map((i) => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId })),
        shipping: form,
        paymentMethod: effectivePaymentMethod,
      };
      const result = await apiPost('/api/checkout/create-order', body) as CreateOrderResponse;
      setOrderResult(result);
      if (isCodResponse(result)) {
        setPaymentStatus('paid');
        clear();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const message = mapCheckoutError(err.status, err.code);
        setError(message);
        if (err.status === 409 && err.code === 'out_of_stock') {
          setOutOfStockProduct('An item in your cart is no longer available.');
        } else if (err.code === 'variant_required' || err.code === 'unknown_variant' || err.code === 'variant_out_of_stock') {
          setOutOfStockProduct('Please choose a valid size for all items in your cart.');
        }
      } else {
        setError('Something went wrong, please try again');
      }
    } finally {
      setLoading(false);
    }
  }, [cartItems, form, effectivePaymentMethod, clear]);

  const openRazorpay = useCallback(async () => {
    if (!orderResult || isCodResponse(orderResult) || !orderResult.keyId || !window.Razorpay) return;
    setPaymentStatus('processing');

    const rzp = new window.Razorpay({
      key: orderResult.keyId,
      amount: orderResult.amount,
      currency: orderResult.currency,
      name: 'Styvio',
      description: 'Order payment',
      order_id: orderResult.providerOrderId,
      prefill: { name: form.name, contact: form.phone },
      theme: { color: '#2563eb' },
      handler: () => {
        setPaymentStatus('submitted');
      },
    });
    rzp.on('payment.failed', () => {
      setPaymentStatus('failed');
    });
    rzp.open();
  }, [orderResult, form]);

  useEffect(() => {
    if (!orderResult || isCodResponse(orderResult) || orderResult.provider !== 'razorpay') return;
    if (window.Razorpay) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, [orderResult]);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header user={user} />
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
        <Header user={null} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="mb-2 text-xl font-bold text-gray-900">Sign in to place your order</h1>
            <p className="mb-6 text-sm text-gray-500">You need to be signed in to place an order. Your cart will be kept.</p>
            <Link to="/login?return=/checkout" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
              Sign in with Google
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (paymentStatus === 'paid' && orderResult) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header user={user} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-bold text-gray-900">
              {isCodResponse(orderResult) ? 'Order placed successfully' : 'Payment successful'}
            </h1>
            <p className="text-sm text-gray-600">
              Your order <span className="font-semibold">#{orderResult.orderId.slice(0, 8)}</span> has been placed.
              {isCodResponse(orderResult) && ' Pay the full amount in cash when the order is delivered.'}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link to="/my-orders" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                View my orders
              </Link>
              <Link to="/" className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                Back to catalog
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (paymentStatus === 'submitted') {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50">
        <Header user={user} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-bold text-gray-900">Payment submitted, confirming your order</h1>
            <p className="text-sm text-gray-600">We're verifying your payment with Razorpay. You'll receive a confirmation shortly.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">Checkout</h1>

        {cartItems.length === 0 && !orderResult ? (
          <EmptyState message="Your cart is empty. Add items from the catalog to checkout." />
        ) : error ? (
          <ErrorState message={error}>
            {outOfStockProduct && (
              <p className="mb-3 text-sm text-gray-500">{outOfStockProduct}</p>
            )}
            <div className="flex gap-2">
              <Button onClick={handleCreateOrder}>Try again</Button>
              <Link to="/cart" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                Back to cart
              </Link>
            </div>
          </ErrorState>
        ) : !orderResult ? (
          <div className="space-y-6">
            {/* Order summary */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Order Summary</h2>
              <div className="space-y-3">
                {cartItems.map(({ product, quantity, variant, variantId }) => (
                  <div key={variantId ? `${product.id}-${variantId}` : product.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-lg object-cover" />
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">Qty: {quantity}{variant ? ` · ${product.variantLabel || 'Size'}: ${variant.label}` : ''}</p>
                      </div>
                    </div>
                    <span className="font-medium text-gray-900">{formatINR(product.price_paise * quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatINR(subtotalPaise)}</span>
                </div>
                {effectivePaymentMethod === 'cod' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">COD handling charge</span>
                    <span className="font-medium text-gray-900">{formatINR(COD_FEE_PAISE)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-medium text-gray-700">Total</span>
                  <span className="text-lg font-bold text-gray-900">{formatINR(totalPaise)}</span>
                </div>
              </div>
            </div>

            {/* Payment method choice */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Payment Method</h2>
              <div className="space-y-3">
                <label className={cnRadio(effectivePaymentMethod === 'online')}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="online"
                    checked={effectivePaymentMethod === 'online'}
                    onChange={() => setPaymentMethod('online')}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-900">Pay online</span>
                    <span className="block text-xs text-gray-500">Pay by card, UPI or net banking via Razorpay</span>
                  </div>
                </label>
                <label className={cnRadio(effectivePaymentMethod === 'cod', !codAvailable)}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={effectivePaymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    disabled={!codAvailable}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div>
                    <span className="block text-sm font-medium text-gray-900">
                      Cash on delivery <span className="font-normal text-gray-500">(Rs 11 handling charge)</span>
                    </span>
                    {codDisabledReason ? (
                      <span className="block text-xs text-amber-600">{codDisabledReason}</span>
                    ) : (
                      <span className="block text-xs text-gray-500">Pay the full amount in cash when the order is delivered.</span>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Shipping form */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-900">Shipping Details</h2>
              {savedAddresses.length > 0 && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Choose a saved address</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={selectedAddressId}
                    onChange={(e) => handleChooseSavedAddress(e.target.value)}
                  >
                    <option value="">Enter manually</option>
                    {savedAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label} — {addr.name}, {addr.address_line}, {addr.city}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-4">
                <Field label="Full name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} required />
                <Field label="Phone number" name="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} required />
                <Field label="Shipping address" name="address" type="textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} error={errors.address} required />
              </div>
              <div className="mt-5">
                <Button onClick={handleCreateOrder} loading={loading} disabled={cartItems.length === 0} className="w-full">
                  {effectivePaymentMethod === 'cod' ? 'Place order' : 'Proceed to payment'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Razorpay payment */}
            {!isCodResponse(orderResult) && orderResult.provider === 'razorpay' && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                <h2 className="mb-2 text-lg font-bold text-gray-900">Pay with Razorpay</h2>
                <p className="mb-5 text-sm text-gray-600">Order created ({formatINR(orderResult.amount)}). Click below to open Razorpay Checkout.</p>
                {paymentStatus === 'failed' && (
                  <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">Payment failed or was cancelled. You can try again.</p>
                )}
                <Button onClick={openRazorpay} loading={paymentStatus === 'processing'} disabled={!orderResult.keyId}>
                  Pay {formatINR(orderResult.amount)}
                </Button>
                {!orderResult.keyId && (
                  <p className="mt-3 text-xs text-red-600">Online payments are coming soon. Please try again later.</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function cnRadio(checked: boolean, disabled = false): string {
  return [
    'flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors',
    checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
  ].join(' ');
}
