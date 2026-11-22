import type { User, Product, CatalogData, ProductInput, ApprovalStatus, Role, Order, OrderItem, OrderWithItems, OrderInput, Address, AddressInput, ProfileInput, DeliveryMode, Preorder, PreorderInput, StockStatus, SaleMode, LoginCode } from '../types';

export interface SessionRecord {
  id: string;
  user_id: string;
  expires_at: string;
}

export interface Repository {
  // Catalog
  getCatalog(): Promise<CatalogData>;
  getProductById(id: string): Promise<Product | null>;
  getAllProducts(): Promise<Product[]>;
  // Mutations
  addProduct(input: ProductInput): Promise<Product>;
  updateProduct(input: ProductInput): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  setProductStatus(id: string, patch: { stock_status?: StockStatus; active?: boolean; sale_mode?: SaleMode }): Promise<Product>;
  // Users
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  getPendingAdminRequests(): Promise<User[]>;
  createUser(email: string): Promise<User>;
  updateUserRole(id: string, role: Role): Promise<void>;
  updateUserApproval(id: string, status: ApprovalStatus): Promise<void>;
  deleteUser(id: string): Promise<void>;
  getSuperadminCount(): Promise<number>;
  // Profile
  getProfile(userId: string): Promise<User | null>;
  updateProfile(userId: string, input: ProfileInput): Promise<void>;
  // Sessions (store hash, not raw id)
  createSession(sessionHash: string, userId: string, expiresAt: string): Promise<SessionRecord>;
  getSessionByHash(sessionHash: string): Promise<SessionRecord | null>;
  deleteSessionByHash(sessionHash: string): Promise<void>;
  // Email login codes (hash only)
  createLoginCode(code: LoginCode): Promise<void>;
  getLatestOpenCode(email: string, nowIso: string): Promise<LoginCode | null>;
  incrementCodeAttempts(id: string): Promise<void>;
  consumeCode(id: string, consumedAt: string): Promise<boolean>;
  countCodesSince(by: 'email' | 'ip_hash', value: string, sinceIso: string): Promise<number>;
  getLastCodeTime(email: string): Promise<string | null>;
  // KV cache rebuild (no-op in mock, writes to KV in D1 impl)
  rebuildKVCacheWithRetry(): Promise<boolean>;
  // Orders
  createOrder(input: OrderInput): Promise<OrderWithItems>;
  getOrderById(id: string): Promise<OrderWithItems | null>;
  getOrderForUser(orderId: string, userId: string): Promise<OrderWithItems | null>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  getOrdersByUserWithItems(userId: string): Promise<OrderWithItems[]>;
  getAllOrders(): Promise<Order[]>;
  getAllOrdersWithItems(): Promise<OrderWithItems[]>;
  updateOrderStatus(id: string, status: Order['status']): Promise<void>;
  markOrderPaymentCollected(id: string): Promise<void>;
  cancelOrder(orderId: string, userId: string, reason: string | null): Promise<void>;
  updateOrderShipping(orderId: string, userId: string, name: string, phone: string, altPhone: string | null, address: string): Promise<void>;
  setFulfilmentStatus(orderId: string, status: 'pending' | 'shipped' | 'delivered'): Promise<void>;
  updateOrderDeliveryMode(orderId: string, userId: string, mode: DeliveryMode, feePaise: number, totalPaise: number): Promise<void>;
  markOrderDelivered(orderId: string): Promise<void>;
  createOrReactivatePreorder(input: PreorderInput): Promise<Preorder>;
  cancelPreorder(id: string, userId: string): Promise<void>;
  getPreordersForUser(userId: string): Promise<Preorder[]>;
  getAllPreorders(productId?: string): Promise<Preorder[]>;
  countActivePreorders(productId: string): Promise<number>;
  // Addresses
  listAddresses(userId: string): Promise<Address[]>;
  createAddress(userId: string, input: AddressInput): Promise<Address>;
  updateAddress(addressId: string, userId: string, input: AddressInput): Promise<Address>;
  deleteAddress(addressId: string, userId: string): Promise<void>;
  setDefaultAddress(addressId: string, userId: string): Promise<void>;
  getAddressCount(userId: string): Promise<number>;
}
