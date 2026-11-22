import type { User, Product, CatalogData, ProductInput, ApprovalStatus, Role, Order, OrderItem, OrderWithItems, OrderInput, Address, AddressInput, ProfileInput, DeliveryMode, Preorder, PreorderInput, StockStatus, SaleMode, LoginCode, Variant } from '../types';
import type { Repository, SessionRecord } from './repository';
import { generateId } from '../utils';
import { normalizeImageUrls } from '../products/config';

type RawProductRow = Omit<Product, 'imageUrls' | 'saleMode' | 'preorderLimit' | 'active' | 'mrpPaise' | 'variantLabel' | 'variants'> & {
  image_urls?: string | null;
  imageUrls?: string[] | null;
  mrp_paise?: number | null;
  mrpPaise?: number | null;
  sale_mode?: SaleMode;
  preorder_limit?: number | null;
  saleMode?: SaleMode;
  preorderLimit?: number | null;
  active: boolean | number;
  variant_label?: string | null;
  variants?: string | null;
};

function normalizeProduct(row: RawProductRow | null | undefined): Product | null {
  if (!row) return null;
  const imageUrls = normalizeImageUrls(row.image_urls ?? row.imageUrls, row.image_url);
  const cover = imageUrls[0] ?? row.image_url ?? '';
  const { image_urls: _omitted, sale_mode, preorder_limit, mrp_paise, variant_label, variants: variantsRaw, ...rest } = row;
  void _omitted;
  
  let parsedVariants: Variant[] = [];
  if (variantsRaw) {
    try {
      const arr = typeof variantsRaw === 'string' ? JSON.parse(variantsRaw) : variantsRaw;
      if (Array.isArray(arr)) parsedVariants = arr as Variant[];
    } catch (err) {
      console.error(`Failed to parse variants JSON for product ${row.id}:`, err);
    }
  }

  return {
    ...rest,
    active: Boolean(row.active),
    saleMode: row.saleMode ?? sale_mode ?? 'buy',
    preorderLimit: row.preorderLimit ?? preorder_limit ?? null,
    mrpPaise: row.mrpPaise ?? mrp_paise ?? null,
    variantLabel: variant_label ?? 'Size',
    variants: parsedVariants,
    image_url: cover,
    imageUrls,
  } as Product;
}

function normalizeProducts(rows: RawProductRow[]): Product[] {
  return rows.map((r) => normalizeProduct(r)).filter((p): p is Product => p !== null);
}

interface D1Result {
  results?: Record<string, unknown>[];
  meta?: { changes?: number };
}

interface D1Database {
  prepare(sql: string): { bind(...values: unknown[]): { all(): Promise<D1Result>; run(): Promise<D1Result>; first<T>(): Promise<T | null> } };
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const KV_KEY = 'LIVE_STOREFRONT_DATA';

export class D1KVRepository implements Repository {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async getCatalog(): Promise<CatalogData> {
    try {
      const raw = await this.kv.get(KV_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RawProductRow[];
        const products = normalizeProducts(parsed);
        return { products, source: 'kv' };
      }
    } catch {
      // fall through to D1
    }
    const result = await this.db
      .prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC')
      .bind()
      .all();
    const products = normalizeProducts((result.results ?? []) as RawProductRow[]);
    return { products, source: 'd1' };
  }

  async getProductById(id: string): Promise<Product | null> {
    const row = await this.db
      .prepare('SELECT * FROM products WHERE id = ?')
      .bind(id)
      .first<RawProductRow>();
    return normalizeProduct(row);
  }

  async getAllProducts(): Promise<Product[]> {
    const result = await this.db
      .prepare('SELECT * FROM products ORDER BY created_at DESC')
      .bind()
      .all();
    return normalizeProducts((result.results ?? []) as RawProductRow[]);
  }

  async addProduct(input: ProductInput): Promise<Product> {
    const id = generateId();
    const now = new Date().toISOString();
    const imageUrls = input.imageUrls.length > 0 ? input.imageUrls : [input.image_url];
    const cover = imageUrls[0] ?? input.image_url;
    await this.db
      .prepare('INSERT INTO products (id, name, description, price_paise, stock_status, image_url, image_urls, active, sale_mode, preorder_limit, created_at, updated_at, mrp_paise, variant_label, variants) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, input.name, input.description, input.price_paise, input.stock_status, cover, JSON.stringify(imageUrls), input.active ? 1 : 0, input.saleMode, input.preorderLimit, now, now, input.mrpPaise ?? null, input.variantLabel ?? 'Size', JSON.stringify(input.variants ?? []))
      .run();
    return { ...input, id, image_url: cover, imageUrls, created_at: now, updated_at: now };
  }

  async updateProduct(input: ProductInput): Promise<Product> {
    const now = new Date().toISOString();
    const imageUrls = input.imageUrls.length > 0 ? input.imageUrls : [input.image_url];
    const cover = imageUrls[0] ?? input.image_url;
    await this.db
      .prepare('UPDATE products SET name = ?, description = ?, price_paise = ?, stock_status = ?, image_url = ?, image_urls = ?, active = ?, sale_mode = ?, preorder_limit = ?, mrp_paise = ?, variant_label = ?, variants = ?, updated_at = ? WHERE id = ?')
      .bind(input.name, input.description, input.price_paise, input.stock_status, cover, JSON.stringify(imageUrls), input.active ? 1 : 0, input.saleMode, input.preorderLimit, input.mrpPaise ?? null, input.variantLabel ?? 'Size', JSON.stringify(input.variants ?? []), now, input.id)
      .run();
    const updated = await this.getProductById(input.id!);
    if (!updated) throw new Error('Product not found after update');
    return { ...updated, updated_at: now };
  }

  async deleteProduct(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  }

  async setProductStatus(id: string, patch: { stock_status?: StockStatus; active?: boolean; sale_mode?: SaleMode }): Promise<Product> {
    const existing = await this.getProductById(id);
    if (!existing) throw new Error('Product not found');
    const now = new Date().toISOString();
    const stockStatus = patch.stock_status ?? existing.stock_status;
    const active = patch.active ?? existing.active;
    const saleMode = patch.sale_mode ?? existing.saleMode;
    await this.db
      .prepare('UPDATE products SET stock_status = ?, active = ?, sale_mode = ?, updated_at = ? WHERE id = ?')
      .bind(stockStatus, active ? 1 : 0, saleMode, now, id)
      .run();
    const updated = await this.getProductById(id);
    if (!updated) throw new Error('Product not found after status update');
    return { ...updated, updated_at: now };
  }

  async getUserById(id: string): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
  }

  async getAllUsers(): Promise<User[]> {
    const result = await this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').bind().all();
    return (result.results ?? []) as unknown as User[];
  }

  async getPendingAdminRequests(): Promise<User[]> {
    const result = await this.db
      .prepare("SELECT * FROM users WHERE approval_status = 'pending' AND role != 'buyer' ORDER BY created_at DESC")
      .bind()
      .all();
    return (result.results ?? []) as unknown as User[];
  }

  async createUser(email: string): Promise<User> {
    const id = generateId();
    const now = new Date().toISOString();
    await this.db
      .prepare('INSERT INTO users (id, email, role, approval_status, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, 'buyer', 'approved', now)
      .run();
    return { id, email, role: 'buyer', approval_status: 'approved', created_at: now, display_name: null, phone: null, alt_phone: null };
  }

  async updateUserRole(id: string, role: Role): Promise<void> {
    await this.db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
  }

  async updateUserApproval(id: string, status: ApprovalStatus): Promise<void> {
    await this.db.prepare('UPDATE users SET approval_status = ? WHERE id = ?').bind(status, id).run();
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  }

  async getSuperadminCount(): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'superadmin'").bind().first<{ count: number }>();
    return row?.count ?? 0;
  }

  async getProfile(userId: string): Promise<User | null> {
    return this.db.prepare('SELECT id, email, role, approval_status, created_at, display_name, phone, alt_phone FROM users WHERE id = ?').bind(userId).first<User>();
  }

  async updateProfile(userId: string, input: ProfileInput): Promise<void> {
    await this.db
      .prepare('UPDATE users SET display_name = ?, phone = ?, alt_phone = ? WHERE id = ?')
      .bind(input.display_name ?? null, input.phone ?? null, input.alt_phone ?? null, userId)
      .run();
  }

  async createSession(sessionHash: string, userId: string, expiresAt: string): Promise<SessionRecord> {
    const id = generateId();
    await this.db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(sessionHash, userId, expiresAt).run();
    return { id: sessionHash, user_id: userId, expires_at: expiresAt };
  }

  async getSessionByHash(sessionHash: string): Promise<SessionRecord | null> {
    const session = await this.db.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionHash).first<SessionRecord>();
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
      await this.deleteSessionByHash(sessionHash);
      return null;
    }
    return session;
  }

  async deleteSessionByHash(sessionHash: string): Promise<void> {
    await this.db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionHash).run();
  }

  async createLoginCode(code: LoginCode): Promise<void> {
    await this.db
      .prepare('INSERT INTO login_codes (id, email, code_hash, expires_at, attempts, consumed_at, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(code.id, code.email, code.code_hash, code.expires_at, code.attempts, code.consumed_at, code.ip_hash, code.created_at)
      .run();
  }

  async getLatestOpenCode(email: string, nowIso: string): Promise<LoginCode | null> {
    return this.db
      .prepare('SELECT * FROM login_codes WHERE email = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1')
      .bind(email, nowIso)
      .first<LoginCode>();
  }

  async incrementCodeAttempts(id: string): Promise<void> {
    await this.db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').bind(id).run();
  }

  async consumeCode(id: string, consumedAt: string): Promise<boolean> {
    const result = await this.db
      .prepare('UPDATE login_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL')
      .bind(consumedAt, id)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async countCodesSince(by: 'email' | 'ip_hash', value: string, sinceIso: string): Promise<number> {
    const sql = by === 'email'
      ? 'SELECT COUNT(*) as count FROM login_codes WHERE email = ? AND created_at >= ?'
      : 'SELECT COUNT(*) as count FROM login_codes WHERE ip_hash = ? AND created_at >= ?';
    const row = await this.db.prepare(sql).bind(value, sinceIso).first<{ count: number }>();
    return row?.count ?? 0;
  }

  async getLastCodeTime(email: string): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT created_at FROM login_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1')
      .bind(email)
      .first<{ created_at: string }>();
    return row?.created_at ?? null;
  }

  async rebuildKVCache(): Promise<void> {
    const result = await this.db
      .prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC')
      .bind()
      .all();
    await this.kv.put(KV_KEY, JSON.stringify(result.results ?? []));
  }

  async rebuildKVCacheWithRetry(): Promise<boolean> {
    try {
      await this.rebuildKVCache();
      return true;
    } catch (err) {
      console.error('KV write failed, retrying once:', err);
      try {
        await this.rebuildKVCache();
        return true;
      } catch (err2) {
        console.error('KV write retry also failed:', err2);
        return false;
      }
    }
  }

  async createOrder(input: OrderInput): Promise<OrderWithItems> {
    const id = generateId();
    const now = new Date().toISOString();
    const paymentMethod = input.paymentMethod ?? 'online';
    const codFeePaise = input.codFeePaise ?? 0;
    const deliveryMode = input.deliveryMode ?? 'courier';
    const deliveryFeePaise = input.deliveryFeePaise ?? 0;
    await this.db
      .prepare('INSERT INTO orders (id, user_id, status, total_paise, payment_method, cod_fee_paise, delivery_mode, delivery_fee_paise, razorpay_order_id, shipping_name, shipping_phone, shipping_alt_phone, shipping_address, fulfilment_status, cancelled_at, cancel_reason, payment_collected_at, delivered_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, input.userId, 'created', input.totalPaise, paymentMethod, codFeePaise, deliveryMode, deliveryFeePaise, input.providerOrderId ?? null, input.shippingName ?? null, input.shippingPhone ?? null, input.shippingAltPhone ?? null, input.shippingAddress ?? null, 'pending', null, null, null, null, now, now)
      .run();
    const items: OrderItem[] = [];
    for (const item of input.items) {
      const itemId = generateId();
      await this.db
        .prepare('INSERT INTO order_items (id, order_id, product_id, name_snapshot, price_paise_snapshot, quantity, variant_id, variant_label, variant_value, mrp_paise_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(itemId, id, item.productId, item.nameSnapshot, item.pricePaiseSnapshot, item.quantity, item.variantId ?? null, item.variantLabel ?? null, item.variantValue ?? null, item.mrpPaiseSnapshot ?? null)
        .run();
      items.push({ id: itemId, order_id: id, product_id: item.productId, name_snapshot: item.nameSnapshot, price_paise_snapshot: item.pricePaiseSnapshot, quantity: item.quantity, variant_id: item.variantId ?? null, variant_label: item.variantLabel ?? null, variant_value: item.variantValue ?? null, mrp_paise_snapshot: item.mrpPaiseSnapshot ?? null });
    }
    const order: Order = { id, user_id: input.userId, status: 'created', total_paise: input.totalPaise, payment_method: paymentMethod, cod_fee_paise: codFeePaise, delivery_mode: deliveryMode, delivery_fee_paise: deliveryFeePaise, razorpay_order_id: input.providerOrderId ?? null, razorpay_payment_id: null, shipping_name: input.shippingName ?? null, shipping_phone: input.shippingPhone ?? null, shipping_alt_phone: input.shippingAltPhone ?? null, shipping_address: input.shippingAddress ?? null, fulfilment_status: 'pending', cancelled_at: null, cancel_reason: null, payment_collected_at: null, delivered_at: null, created_at: now, updated_at: now };
    return { ...order, items };
  }

  async getOrderById(id: string): Promise<OrderWithItems | null> {
    const order = await this.db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Order>();
    if (!order) return null;
    const itemsResult = await this.db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all();
    const items = (itemsResult.results ?? []) as unknown as OrderItem[];
    return { ...order, items };
  }

  async getOrderForUser(orderId: string, userId: string): Promise<OrderWithItems | null> {
    const order = await this.db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').bind(orderId, userId).first<Order>();
    if (!order) return null;
    const itemsResult = await this.db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(orderId).all();
    const items = (itemsResult.results ?? []) as unknown as OrderItem[];
    return { ...order, items };
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    const result = await this.db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
    return (result.results ?? []) as unknown as Order[];
  }

  async getOrdersByUserWithItems(userId: string): Promise<OrderWithItems[]> {
    const result = await this.db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
    const orders = (result.results ?? []) as unknown as Order[];
    const withItems: OrderWithItems[] = [];
    for (const order of orders) {
      const itemsResult = await this.db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all();
      const items = (itemsResult.results ?? []) as unknown as OrderItem[];
      withItems.push({ ...order, items });
    }
    return withItems;
  }

  async getAllOrders(): Promise<Order[]> {
    const result = await this.db.prepare('SELECT * FROM orders ORDER BY created_at DESC').bind().all();
    return (result.results ?? []) as unknown as Order[];
  }

  async getAllOrdersWithItems(): Promise<OrderWithItems[]> {
    const result = await this.db.prepare('SELECT * FROM orders ORDER BY created_at DESC').bind().all();
    const orders = (result.results ?? []) as unknown as Order[];
    const withItems: OrderWithItems[] = [];
    for (const order of orders) {
      const itemsResult = await this.db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all();
      const items = (itemsResult.results ?? []) as unknown as OrderItem[];
      withItems.push({ ...order, items });
    }
    return withItems;
  }

  async updateOrderStatus(id: string, status: Order['status']): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id).run();
  }

  async markOrderPaymentCollected(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare("UPDATE orders SET status = 'paid', payment_collected_at = ?, updated_at = ? WHERE id = ?").bind(now, now, id).run();
  }

  async cancelOrder(orderId: string, userId: string, reason: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare("UPDATE orders SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(now, reason, now, orderId, userId)
      .run();
  }

  async updateOrderShipping(orderId: string, userId: string, name: string, phone: string, altPhone: string | null, address: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare('UPDATE orders SET shipping_name = ?, shipping_phone = ?, shipping_alt_phone = ?, shipping_address = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .bind(name, phone, altPhone, address, now, orderId, userId)
      .run();
  }

  async setFulfilmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare('UPDATE orders SET fulfilment_status = ?, updated_at = ? WHERE id = ?').bind(status, now, orderId).run();
  }

  async updateOrderDeliveryMode(orderId: string, userId: string, mode: DeliveryMode, feePaise: number, totalPaise: number): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare('UPDATE orders SET delivery_mode = ?, delivery_fee_paise = ?, total_paise = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .bind(mode, feePaise, totalPaise, now, orderId, userId)
      .run();
  }

  async markOrderDelivered(orderId: string): Promise<void> {
    const now = new Date().toISOString();
    const order = await this.db.prepare('SELECT payment_method FROM orders WHERE id = ?').bind(orderId).first<{ payment_method: string }>();
    if (!order) return;
    if (order.payment_method === 'cod') {
      await this.db
        .prepare("UPDATE orders SET fulfilment_status = 'delivered', status = 'paid', payment_collected_at = ?, delivered_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, now, orderId)
        .run();
    } else {
      await this.db
        .prepare("UPDATE orders SET fulfilment_status = 'delivered', delivered_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, orderId)
        .run();
    }
  }

  async createOrReactivatePreorder(input: PreorderInput): Promise<Preorder> {
    const existing = await this.db.prepare('SELECT * FROM preorders WHERE product_id = ? AND user_id = ?').bind(input.productId, input.userId).first<Preorder>();
    const now = new Date().toISOString();
    if (existing) {
      await this.db.prepare("UPDATE preorders SET quantity = ?, name = ?, phone = ?, alt_phone = ?, note = ?, status = 'registered', updated_at = ? WHERE id = ?").bind(input.quantity, input.name, input.phone, input.altPhone ?? null, input.note ?? null, now, existing.id).run();
      return { ...existing, product_id: input.productId, user_id: input.userId, quantity: input.quantity, name: input.name, phone: input.phone, alt_phone: input.altPhone ?? null, note: input.note ?? null, status: 'registered', updated_at: now };
    }
    const id = generateId();
    await this.db.prepare('INSERT INTO preorders (id, product_id, user_id, quantity, name, phone, alt_phone, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, input.productId, input.userId, input.quantity, input.name, input.phone, input.altPhone ?? null, input.note ?? null, 'registered', now, now).run();
    return { id, product_id: input.productId, user_id: input.userId, quantity: input.quantity, name: input.name, phone: input.phone, alt_phone: input.altPhone ?? null, note: input.note ?? null, status: 'registered', created_at: now, updated_at: now };
  }

  async cancelPreorder(id: string, userId: string): Promise<void> {
    await this.db.prepare("UPDATE preorders SET status = 'cancelled', updated_at = ? WHERE id = ? AND user_id = ?").bind(new Date().toISOString(), id, userId).run();
  }

  async getPreordersForUser(userId: string): Promise<Preorder[]> {
    const result = await this.db.prepare('SELECT preorders.*, products.name AS product_name FROM preorders JOIN products ON products.id = preorders.product_id WHERE preorders.user_id = ? ORDER BY preorders.created_at DESC').bind(userId).all();
    return (result.results ?? []) as unknown as Preorder[];
  }

  async getAllPreorders(productId?: string): Promise<Preorder[]> {
    const query = productId ? 'SELECT preorders.*, products.name AS product_name, users.email FROM preorders JOIN products ON products.id = preorders.product_id JOIN users ON users.id = preorders.user_id WHERE preorders.product_id = ? ORDER BY preorders.created_at DESC' : 'SELECT preorders.*, products.name AS product_name, users.email FROM preorders JOIN products ON products.id = preorders.product_id JOIN users ON users.id = preorders.user_id ORDER BY preorders.created_at DESC';
    const result = productId ? await this.db.prepare(query).bind(productId).all() : await this.db.prepare(query).bind().all();
    return (result.results ?? []) as unknown as Preorder[];
  }

  async countActivePreorders(productId: string): Promise<number> {
    const row = await this.db.prepare("SELECT COUNT(*) AS count FROM preorders WHERE product_id = ? AND status = 'registered'").bind(productId).first<{ count: number }>();
    return row?.count ?? 0;
  }

  async listAddresses(userId: string): Promise<Address[]> {
    const result = await this.db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').bind(userId).all();
    return (result.results ?? []) as unknown as Address[];
  }

  async createAddress(userId: string, input: AddressInput): Promise<Address> {
    const count = await this.getAddressCount(userId);
    if (count >= 5) throw new Error('Maximum of 5 addresses allowed');
    const id = generateId();
    const now = new Date().toISOString();
    const isDefault = input.is_default ?? false;
    if (isDefault) {
      await this.db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(userId).run();
    }
    await this.db
      .prepare('INSERT INTO addresses (id, user_id, label, name, phone, alt_phone, address_line, city, state, pincode, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, userId, input.label, input.name, input.phone, input.alt_phone ?? null, input.address_line, input.city, input.state, input.pincode, isDefault ? 1 : 0, now)
      .run();
    return { id, user_id: userId, label: input.label, name: input.name, phone: input.phone, alt_phone: input.alt_phone ?? null, address_line: input.address_line, city: input.city, state: input.state, pincode: input.pincode, is_default: isDefault, created_at: now };
  }

  async updateAddress(addressId: string, userId: string, input: AddressInput): Promise<Address> {
    const existing = await this.db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').bind(addressId, userId).first<Address>();
    if (!existing) throw new Error('Address not found');
    if (input.is_default) {
      await this.db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(userId).run();
    }
    await this.db
      .prepare('UPDATE addresses SET label = ?, name = ?, phone = ?, alt_phone = ?, address_line = ?, city = ?, state = ?, pincode = ?, is_default = ? WHERE id = ? AND user_id = ?')
      .bind(input.label, input.name, input.phone, input.alt_phone ?? null, input.address_line, input.city, input.state, input.pincode, input.is_default ?? existing.is_default ? 1 : 0, addressId, userId)
      .run();
    const updated = await this.db.prepare('SELECT * FROM addresses WHERE id = ?').bind(addressId).first<Address>();
    if (!updated) throw new Error('Address not found after update');
    return updated;
  }

  async deleteAddress(addressId: string, userId: string): Promise<void> {
    await this.db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').bind(addressId, userId).run();
  }

  async setDefaultAddress(addressId: string, userId: string): Promise<void> {
    const existing = await this.db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').bind(addressId, userId).first<Address>();
    if (!existing) throw new Error('Address not found');
    await this.db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').bind(userId).run();
    await this.db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?').bind(addressId, userId).run();
  }

  async getAddressCount(userId: string): Promise<number> {
    const row = await this.db.prepare('SELECT COUNT(*) as count FROM addresses WHERE user_id = ?').bind(userId).first<{ count: number }>();
    return row?.count ?? 0;
  }
}
