export interface PaymentProviderConfig {
  keyId?: string;
}

export interface CreateOrderResult {
  providerOrderId: string;
  publicConfig: PaymentProviderConfig;
}

export interface PaymentProvider {
  createOrder(amountPaise: number, receipt: string): Promise<CreateOrderResult>;
}

export type PaymentMode = 'razorpay';
