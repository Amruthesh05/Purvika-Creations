export type DeliveryMode = 'courier' | 'founders';

export const DELIVERY_MODES: Record<DeliveryMode, { label: string; feePaise: number }> = {
  courier: { label: 'Courier', feePaise: 2000 },
  founders: { label: 'Delivery by the founders', feePaise: 20000 },
};

export function isDeliveryMode(value: unknown): value is DeliveryMode {
  return value === 'courier' || value === 'founders';
}

export function getDeliveryFeePaise(mode: DeliveryMode): number {
  return DELIVERY_MODES[mode].feePaise;
}
