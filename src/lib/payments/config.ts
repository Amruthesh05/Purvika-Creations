export const COD_FEE_PAISE = 600;
export const COD_MAX_ORDER_PAISE = 500000;

export type PaymentMethod = 'online' | 'cod';

export function isCodAvailable(itemTotalPaise: number, codEnabled: boolean): boolean {
  return codEnabled && itemTotalPaise <= COD_MAX_ORDER_PAISE;
}

export function sanitizeReturnPath(path: string | null | undefined): string {
  if (!path || typeof path !== 'string') return '/';
  if (!path.startsWith('/')) return '/';
  if (path.startsWith('//')) return '/';
  if (path.includes(':')) return '/';
  if (path === '/') return '/';
  if (path.startsWith('/checkout')) return path;
  if (path.startsWith('/cart')) return path;
  if (path.startsWith('/my-orders')) return path;
  return '/';
}

export function mapCheckoutError(status: number, code: string | undefined): string {
  if (status === 401) return 'Please sign in to place your order';
  if (status === 409 && code === 'cod_not_available') return 'Cash on delivery is not available for this order';
  if (status === 400 && code === 'variant_required') return 'Please choose a size for all items in your cart';
  if (status === 400 && code === 'unknown_variant') return 'One of the selected sizes is no longer available';
  if (status === 409 && code === 'variant_out_of_stock') return 'One of the selected sizes is out of stock';
  if (status === 409) return 'Some items are no longer available';
  if (status === 503 && code === 'payments_not_configured') return 'Online payments are coming soon';
  if (status === 400) return 'Please check the details you entered and try again';
  return 'Something went wrong, please try again';
}
