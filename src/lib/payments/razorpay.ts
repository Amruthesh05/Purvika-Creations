import type { PaymentProvider, CreateOrderResult } from './provider';

interface RazorpayEnv {
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
}

export class RazorpayNotConfiguredError extends Error {
  code = 'payments_not_configured' as const;
  constructor() {
    super('Razorpay keys are not configured');
  }
}

export class RazorpayProvider implements PaymentProvider {
  constructor(private env: RazorpayEnv) {}

  async createOrder(amountPaise: number, receipt: string): Promise<CreateOrderResult> {
    const keyId = this.env.RAZORPAY_KEY_ID;
    const keySecret = this.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new RazorpayNotConfiguredError();
    }

    const auth = btoa(`${keyId}:${keySecret}`);
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt,
        partial_payment: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`razorpay_order_failed (${res.status}): ${text}`);
    }

    const data = await res.json() as { id: string };
    return {
      providerOrderId: data.id,
      publicConfig: { keyId },
    };
  }
}
