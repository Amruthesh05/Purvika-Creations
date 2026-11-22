ALTER TABLE products ADD COLUMN image_urls TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN sale_mode TEXT NOT NULL DEFAULT 'buy';
ALTER TABLE products ADD COLUMN preorder_limit INTEGER;

UPDATE products SET image_urls = json_array(image_url)
WHERE image_urls = '[]' AND image_url IS NOT NULL AND image_url <> '';

CREATE TABLE IF NOT EXISTS preorders (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_preorders_product_id ON preorders(product_id);
CREATE INDEX IF NOT EXISTS idx_preorders_user_id ON preorders(user_id);