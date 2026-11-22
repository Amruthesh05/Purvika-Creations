ALTER TABLE orders ADD COLUMN shipping_alt_phone TEXT;
ALTER TABLE orders ADD COLUMN fulfilment_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN cancel_reason TEXT;

ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN alt_phone TEXT;

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
