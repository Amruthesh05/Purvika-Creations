import type { PaymentProvider, PaymentMode } from './provider';
import { RazorpayProvider } from './razorpay';

interface PaymentEnv {
  PAYMENT_MODE?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
}

export function resolvePaymentMode(_env: PaymentEnv): PaymentMode {
  return 'razorpay';
}

export function getPaymentProvider(env: PaymentEnv): { provider: PaymentProvider; mode: PaymentMode } {
  const mode = resolvePaymentMode(env);
  return { provider: new RazorpayProvider(env), mode };
}
