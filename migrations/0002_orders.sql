-- Migration: 0002_orders
-- Creates orders and order_items tables

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('created', 'paid', 'failed', 'cancelled')) DEFAULT 'created',
  total_paise INTEGER NOT NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  shipping_name TEXT,
  shipping_phone TEXT,
  shipping_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  price_paise_snapshot INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);


ALTER TABLE order_items ADD COLUMN variant_id TEXT;
ALTER TABLE order_items ADD COLUMN variant_label TEXT;
ALTER TABLE order_items ADD COLUMN variant_value TEXT;
ALTER TABLE order_items ADD COLUMN mrp_paise_snapshot INTEGER;