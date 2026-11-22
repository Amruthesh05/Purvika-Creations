ALTER TABLE orders ADD COLUMN delivery_mode TEXT NOT NULL DEFAULT 'courier';
ALTER TABLE orders ADD COLUMN delivery_fee_paise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN delivered_at TEXT;

UPDATE orders SET delivered_at = updated_at
WHERE fulfilment_status = 'delivered' AND delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS order_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('return', 'replacement')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_requests_order_id ON order_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_order_requests_user_id ON order_requests(user_id);