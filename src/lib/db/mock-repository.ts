import type { User, Product, CatalogData, ProductInput, ApprovalStatus, Role, Order, OrderItem, OrderWithItems, OrderInput, Address, AddressInput, ProfileInput, DeliveryMode, Preorder, PreorderInput, StockStatus, SaleMode, LoginCode, Variant } from '../types';
import type { Repository, SessionRecord } from './repository';
import { generateId } from '../utils';
import { normalizeImageUrls } from '../products/config';

export class MockRepository implements Repository {
  private users: Map<string, User> = new Map();
  private products: Map<string, Product> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();
  private orders: Map<string, OrderWithItems> = new Map();
  private addresses: Map<string, Address> = new Map();
  private preorders: Map<string, Preorder> = new Map();
  private loginCodes: Map<string, LoginCode> = new Map();
  private kvCache: Product[] | null = null;

  constructor() {
    const now = new Date().toISOString();
    const img1 = 'https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg';
    const img2 = 'https://images.pexels.com/photos/437037/pexels-photo-437037.jpeg';
    const img3 = 'https://images.pexels.com/photos/1666816/pexels-photo-1666816.jpeg';
    const demoProducts: Product[] = [
      { id: 'p1', name: 'Wireless Earbuds Pro', description: 'Premium noise-cancelling wireless earbuds with 30-hour battery life.', price_paise: 499900, stock_status: 'in_stock', image_url: img1, imageUrls: [img1, img2, img3], active: true, saleMode: 'buy', preorderLimit: null, mrpPaise: null, variantLabel: 'Size', variants: [], created_at: now, updated_at: now },
      { id: 'p2', name: 'Smart Watch Series 7', description: 'Health tracking, GPS, and always-on display.', price_paise: 249900, stock_status: 'in_stock', image_url: img2, imageUrls: [img2, img1, img3], active: true, saleMode: 'buy', preorderLimit: null, mrpPaise: null, variantLabel: 'Size', variants: [], created_at: now, updated_at: now },
      { id: 'p3', name: 'Bluetooth Speaker', description: 'Waterproof portable speaker with rich bass.', price_paise: 199900, stock_status: 'out_of_stock', image_url: img3, imageUrls: [img3, img1, img2], active: true, saleMode: 'buy', preorderLimit: null, mrpPaise: null, variantLabel: 'Size', variants: [], created_at: now, updated_at: now },
    ];
    demoProducts.forEach((p) => this.products.set(p.id, p));
    this.rebuildKVCache();

    const superadmin: User = { id: 'u1', email: 'amrutheshkn3@gmail.com', role: 'superadmin', approval_status: 'approved', created_at: now, display_name: null, phone: null, alt_phone: null };
    this.users.set(superadmin.id, superadmin);
  }

  private rebuildKVCache(): void {
    this.kvCache = Array.from(this.products.values())
      .filter((p) => p.active)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getCatalog(): Promise<CatalogData> {
    if (this.kvCache) {
      return { products: [...this.kvCache], source: 'kv' };
    }
    const products = Array.from(this.products.values()).filter((p) => p.active).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { products, source: 'd1' };
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.products.get(id) ?? null;
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async addProduct(input: ProductInput): Promise<Product> {
    const id = generateId();
    const now = new Date().toISOString();
    const imageUrls = input.imageUrls.length > 0 ? input.imageUrls : normalizeImageUrls([], input.image_url);
    const cover = imageUrls[0] ?? input.image_url;
    const product: Product = { ...input, id, image_url: cover, imageUrls, variantLabel: input.variantLabel ?? 'Size', variants: input.variants ?? [], created_at: now, updated_at: now };
    this.products.set(id, product);
    this.rebuildKVCache();
    return product;
  }

  async updateProduct(input: ProductInput): Promise<Product> {
    const existing = this.products.get(input.id!);
    if (!existing) throw new Error('Product not found');
    const now = new Date().toISOString();
    const imageUrls = input.imageUrls.length > 0 ? input.imageUrls : normalizeImageUrls([], input.image_url);
    const cover = imageUrls[0] ?? input.image_url;
    const updated: Product = { ...existing, ...input, id: input.id!, image_url: cover, imageUrls, variantLabel: input.variantLabel ?? 'Size', variants: input.variants ?? [], updated_at: now };
    this.products.set(input.id!, updated);
    this.rebuildKVCache();
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    this.products.delete(id);
    this.rebuildKVCache();
  }

  async setProductStatus(id: string, patch: { stock_status?: StockStatus; active?: boolean; sale_mode?: SaleMode }): Promise<Product> {
    const existing = this.products.get(id);
    if (!existing) throw new Error('Product not found');
    const now = new Date().toISOString();
    const updated: Product = {
      ...existing,
      stock_status: patch.stock_status ?? existing.stock_status,
      active: patch.active ?? existing.active,
      saleMode: patch.sale_mode ?? existing.saleMode,
      updated_at: now,
    };
    this.products.set(id, updated);
    this.rebuildKVCache();
    return updated;
  }

  async createOrReactivatePreorder(input: PreorderInput): Promise<Preorder> {
    const existing = Array.from(this.preorders.values()).find((p) => p.product_id === input.productId && p.user_id === input.userId);
    if (existing) {
      const updated = { ...existing, quantity: input.quantity, name: input.name, phone: input.phone, alt_phone: input.altPhone ?? null, note: input.note ?? null, status: 'registered' as const, updated_at: new Date().toISOString() };
      this.preorders.set(existing.id, updated);
      return updated;
    }
    const now = new Date().toISOString();
    const preorder: Preorder = { id: generateId(), product_id: input.productId, user_id: input.userId, quantity: input.quantity, name: input.name, phone: input.phone, alt_phone: input.altPhone ?? null, note: input.note ?? null, status: 'registered', created_at: now, updated_at: now };
    this.preorders.set(preorder.id, preorder);
    return preorder;
  }

  async cancelPreorder(id: string, userId: string): Promise<void> {
    const preorder = this.preorders.get(id);
    if (preorder && preorder.user_id === userId) this.preorders.set(id, { ...preorder, status: 'cancelled', updated_at: new Date().toISOString() });
  }

  async getPreordersForUser(userId: string): Promise<Preorder[]> {
    return Array.from(this.preorders.values()).filter((p) => p.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getAllPreorders(productId?: string): Promise<Preorder[]> {
    return Array.from(this.preorders.values())
      .filter((p) => !productId || p.product_id === productId)
      .map((p) => ({ ...p, product_name: this.products.get(p.product_id)?.name, email: this.users.get(p.user_id)?.email ?? null }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async countActivePreorders(productId: string): Promise<number> {
    return Array.from(this.preorders.values()).filter((p) => p.product_id === productId && p.status === 'registered').length;
  }

  async createLoginCode(code: LoginCode): Promise<void> {
    this.loginCodes.set(code.id, code);
  }

  async getLatestOpenCode(email: string, nowIso: string): Promise<LoginCode | null> {
    const open = Array.from(this.loginCodes.values())
      .filter((c) => c.email === email && c.consumed_at === null && c.expires_at > nowIso)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return open[0] ?? null;
  }

  async incrementCodeAttempts(id: string): Promise<void> {
    const code = this.loginCodes.get(id);
    if (code) this.loginCodes.set(id, { ...code, attempts: code.attempts + 1 });
  }

  async consumeCode(id: string, consumedAt: string): Promise<boolean> {
    const code = this.loginCodes.get(id);
    if (!code || code.consumed_at !== null) return false;
    this.loginCodes.set(id, { ...code, consumed_at: consumedAt });
    return true;
  }

  async countCodesSince(by: 'email' | 'ip_hash', value: string, sinceIso: string): Promise<number> {
    return Array.from(this.loginCodes.values())
      .filter((c) => (by === 'email' ? c.email : c.ip_hash) === value && c.created_at >= sinceIso).length;
  }

  async getLastCodeTime(email: string): Promise<string | null> {
    let last: string | null = null;
    for (const c of this.loginCodes.values()) {
      if (c.email === email && (last === null || c.created_at > last)) last = c.created_at;
    }
    return last;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email === email) return u;
    }
    return null;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getPendingAdminRequests(): Promise<User[]> {
    return Array.from(this.users.values())
      .filter((u) => u.approval_status === 'pending' && u.role !== 'buyer')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createUser(email: string): Promise<User> {
    const id = generateId();
    const now = new Date().toISOString();
    const user: User = { id, email, role: 'buyer', approval_status: 'approved', created_at: now, display_name: null, phone: null, alt_phone: null };
    this.users.set(id, user);
    return user;
  }

  async updateUserRole(id: string, role: Role): Promise<void> {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, role });
  }

  async updateUserApproval(id: string, status: ApprovalStatus): Promise<void> {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, approval_status: status });
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  async getSuperadminCount(): Promise<number> {
    return Array.from(this.users.values()).filter((u) => u.role === 'superadmin').length;
  }

  async getProfile(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async updateProfile(userId: string, input: ProfileInput): Promise<void> {
    const u = this.users.get(userId);
    if (u) this.users.set(userId, { ...u, display_name: input.display_name ?? u.display_name, phone: input.phone ?? u.phone, alt_phone: input.alt_phone ?? u.alt_phone });
  }

  async createSession(sessionHash: string, userId: string, expiresAt: string): Promise<SessionRecord> {
    const session: SessionRecord = { id: sessionHash, user_id: userId, expires_at: expiresAt };
    this.sessions.set(sessionHash, session);
    return session;
  }

  async getSessionByHash(sessionHash: string): Promise<SessionRecord | null> {
    const s = this.sessions.get(sessionHash);
    if (!s) return null;
    if (new Date(s.expires_at) < new Date()) {
      this.sessions.delete(sessionHash);
      return null;
    }
    return s;
  }

  async deleteSessionByHash(sessionHash: string): Promise<void> {
    this.sessions.delete(sessionHash);
  }

  async rebuildKVCacheWithRetry(): Promise<boolean> {
    this.rebuildKVCache();
    return true;
  }

  async createOrder(input: OrderInput): Promise<OrderWithItems> {
    const id = generateId();
    const now = new Date().toISOString();
    const paymentMethod = input.paymentMethod ?? 'online';
    const codFeePaise = input.codFeePaise ?? 0;
    const order: Order = { id, user_id: input.userId, status: 'created', total_paise: input.totalPaise, payment_method: paymentMethod, cod_fee_paise: codFeePaise, delivery_mode: input.deliveryMode ?? 'courier', delivery_fee_paise: input.deliveryFeePaise ?? 0, razorpay_order_id: input.providerOrderId ?? null, razorpay_payment_id: null, shipping_name: input.shippingName ?? null, shipping_phone: input.shippingPhone ?? null, shipping_alt_phone: input.shippingAltPhone ?? null, shipping_address: input.shippingAddress ?? null, fulfilment_status: 'pending', cancelled_at: null, cancel_reason: null, payment_collected_at: null, delivered_at: null, created_at: now, updated_at: now };
    const items: OrderItem[] = input.items.map((item) => ({ id: generateId(), order_id: id, product_id: item.productId, name_snapshot: item.nameSnapshot, price_paise_snapshot: item.pricePaiseSnapshot, quantity: item.quantity, variant_id: item.variantId ?? null, variant_label: item.variantLabel ?? null, variant_value: item.variantValue ?? null, mrp_paise_snapshot: item.mrpPaiseSnapshot ?? null }));
    const orderWithItems: OrderWithItems = { ...order, items };
    this.orders.set(id, orderWithItems);
    return orderWithItems;
  }

  async getOrderById(id: string): Promise<OrderWithItems | null> {
    return this.orders.get(id) ?? null;
  }

  async getOrderForUser(orderId: string, userId: string): Promise<OrderWithItems | null> {
    const o = this.orders.get(orderId);
    if (!o || o.user_id !== userId) return null;
    return o;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((o) => o.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getOrdersByUserWithItems(userId: string): Promise<OrderWithItems[]> {
    return Array.from(this.orders.values()).filter((o) => o.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getAllOrdersWithItems(): Promise<OrderWithItems[]> {
    return Array.from(this.orders.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<void> {
    const o = this.orders.get(id);
    if (o) {
      const now = new Date().toISOString();
      const updated: OrderWithItems = { ...o, status, updated_at: now };
      this.orders.set(id, updated);
    }
  }

  async markOrderPaymentCollected(id: string): Promise<void> {
    const o = this.orders.get(id);
    if (o) {
      const now = new Date().toISOString();
      const updated: OrderWithItems = { ...o, status: 'paid', payment_collected_at: now, updated_at: now };
      this.orders.set(id, updated);
    }
  }

  async cancelOrder(orderId: string, userId: string, reason: string | null): Promise<void> {
    const o = this.orders.get(orderId);
    if (o && o.user_id === userId) {
      const now = new Date().toISOString();
      this.orders.set(orderId, { ...o, status: 'cancelled', cancelled_at: now, cancel_reason: reason, updated_at: now });
    }
  }

  async updateOrderShipping(orderId: string, userId: string, name: string, phone: string, altPhone: string | null, address: string): Promise<void> {
    const o = this.orders.get(orderId);
    if (o && o.user_id === userId) {
      const now = new Date().toISOString();
      this.orders.set(orderId, { ...o, shipping_name: name, shipping_phone: phone, shipping_alt_phone: altPhone, shipping_address: address, updated_at: now });
    }
  }

  async setFulfilmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void> {
    const o = this.orders.get(orderId);
    if (o) {
      const now = new Date().toISOString();
      this.orders.set(orderId, { ...o, fulfilment_status: status, updated_at: now });
    }
  }

  async updateOrderDeliveryMode(orderId: string, userId: string, mode: DeliveryMode, feePaise: number, totalPaise: number): Promise<void> {
    const o = this.orders.get(orderId);
    if (o && o.user_id === userId) {
      const now = new Date().toISOString();
      this.orders.set(orderId, { ...o, delivery_mode: mode, delivery_fee_paise: feePaise, total_paise: totalPaise, updated_at: now });
    }
  }

  async markOrderDelivered(orderId: string): Promise<void> {
    const o = this.orders.get(orderId);
    if (o) {
      const now = new Date().toISOString();
      this.orders.set(orderId, { ...o, delivered_at: now, updated_at: now });
    }
  }

  async listAddresses(userId: string): Promise<Address[]> {
    return Array.from(this.addresses.values()).filter((a) => a.user_id === userId).sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || b.created_at.localeCompare(a.created_at));
  }

  async createAddress(userId: string, input: AddressInput): Promise<Address> {
    const count = await this.getAddressCount(userId);
    if (count >= 5) throw new Error('Maximum of 5 addresses allowed');
    const id = generateId();
    const now = new Date().toISOString();
    const isDefault = input.is_default ?? false;
    if (isDefault) {
      for (const a of this.addresses.values()) {
        if (a.user_id === userId) this.addresses.set(a.id, { ...a, is_default: false });
      }
    }
    const address: Address = { id, user_id: userId, label: input.label, name: input.name, phone: input.phone, alt_phone: input.alt_phone ?? null, address_line: input.address_line, city: input.city, state: input.state, pincode: input.pincode, is_default: isDefault, created_at: now };
    this.addresses.set(id, address);
    return address;
  }

  async updateAddress(addressId: string, userId: string, input: AddressInput): Promise<Address> {
    const existing = this.addresses.get(addressId);
    if (!existing || existing.user_id !== userId) throw new Error('Address not found');
    if (input.is_default) {
      for (const a of this.addresses.values()) {
        if (a.user_id === userId) this.addresses.set(a.id, { ...a, is_default: false });
      }
    }
    const updated: Address = { ...existing, label: input.label, name: input.name, phone: input.phone, alt_phone: input.alt_phone ?? null, address_line: input.address_line, city: input.city, state: input.state, pincode: input.pincode, is_default: input.is_default ?? existing.is_default };
    this.addresses.set(addressId, updated);
    return updated;
  }

  async deleteAddress(addressId: string, userId: string): Promise<void> {
    const a = this.addresses.get(addressId);
    if (a && a.user_id === userId) this.addresses.delete(addressId);
  }

  async setDefaultAddress(addressId: string, userId: string): Promise<void> {
    const existing = this.addresses.get(addressId);
    if (!existing || existing.user_id !== userId) throw new Error('Address not found');
    for (const a of this.addresses.values()) {
      if (a.user_id === userId) this.addresses.set(a.id, { ...a, is_default: a.id === addressId });
    }
  }

  async getAddressCount(userId: string): Promise<number> {
    return Array.from(this.addresses.values()).filter((a) => a.user_id === userId).length;
  }
}
