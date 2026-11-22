export type Role = 'buyer' | 'admin' | 'superadmin';
export type ApprovalStatus = 'pending' | 'approved';
export type StockStatus = 'in_stock' | 'out_of_stock';
export type SaleMode = 'buy' | 'preorder' | 'preorder_closed';

export interface Variant {
  id: string;
  label: string;
  in_stock: boolean;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  approval_status: ApprovalStatus;
  created_at: string;
  display_name?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
}

export interface LoginCode {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
  ip_hash: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price_paise: number;
  stock_status: StockStatus;
  image_url: string;
  imageUrls: string[];
  active: boolean;
  saleMode: SaleMode;
  preorderLimit: number | null;
  mrpPaise: number | null;
  variantLabel: string;
  variants: Variant[];
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
}

export type MutateAction = 'ADD' | 'UPDATE' | 'DELETE' | 'SET_STATUS';

export interface SetStatusInput {
  productId: string;
  stock_status?: StockStatus;
  active?: boolean;
  sale_mode?: SaleMode;
}

export interface MutateRequest {
  action: MutateAction;
  product?: ProductInput;
  productId?: string;
  setStatus?: SetStatusInput;
}

export interface ProductInput {
  id?: string;
  name: string;
  description: string;
  price_paise: number;
  stock_status: StockStatus;
  image_url: string;
  imageUrls: string[];
  active: boolean;
  saleMode: SaleMode;
  preorderLimit: number | null;
  mrpPaise: number | null;
  variantLabel: string;
  variants: Variant[];
}

export interface Preorder {
  id: string;
  product_id: string;
  user_id: string;
  quantity: number;
  name: string;
  email?: string | null;
  phone: string;
  alt_phone: string | null;
  note: string | null;
  status: 'registered' | 'cancelled';
  created_at: string;
  updated_at: string;
  product_name?: string;
}

export interface MutateResult {
  success: boolean;
  error?: string;
  product?: Product;
}

export interface CatalogData {
  products: Product[];
  source: 'kv' | 'd1';
}

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
}

export type OrderStatus = 'created' | 'paid' | 'failed' | 'cancelled';

export type FulfilmentStatus = 'pending' | 'shipped' | 'delivered';

export type PaymentMethod = 'online' | 'cod';

export type DeliveryMode = 'courier' | 'founders';

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_paise: number;
  payment_method: PaymentMethod;
  cod_fee_paise: number;
  delivery_mode: DeliveryMode;
  delivery_fee_paise: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_alt_phone: string | null;
  shipping_address: string | null;
  fulfilment_status: FulfilmentStatus;
  cancelled_at: string | null;
  cancel_reason: string | null;
  payment_collected_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  name_snapshot: string;
  price_paise_snapshot: number;
  quantity: number;
  variant_id: string | null;
  variant_label: string | null;
  variant_value: string | null;
  mrp_paise_snapshot: number | null;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface OrderInput {
  userId: string;
  totalPaise: number;
  paymentMethod?: PaymentMethod;
  codFeePaise?: number;
  deliveryMode?: DeliveryMode;
  deliveryFeePaise?: number;
  providerOrderId?: string;
  shippingName?: string;
  shippingPhone?: string;
  shippingAltPhone?: string;
  shippingAddress?: string;
  items: Array<{
    productId: string;
    nameSnapshot: string;
    pricePaiseSnapshot: number;
    quantity: number;
    variantId?: string;
    variantLabel?: string;
    variantValue?: string;
    mrpPaiseSnapshot?: number | null;
  }>;
}

export interface CartItem {
  productId: string;
  quantity: number;
  variantId?: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  name: string;
  phone: string;
  alt_phone: string | null;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
}

export interface AddressInput {
  label: string;
  name: string;
  phone: string;
  alt_phone?: string | null;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  is_default?: boolean;
}

export interface ProfileInput {
  display_name?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
}

export interface PreorderInput {
  productId: string;
  userId: string;
  quantity: number;
  name: string;
  phone: string;
  altPhone?: string | null;
  note?: string | null;
}
